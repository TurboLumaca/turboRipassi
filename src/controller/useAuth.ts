/**
 * Controller — authentication (spec section 2/3: Supabase Auth, Google OAuth).
 * Exposes the session and login/logout actions. The View never touches supabase.auth.
 */
import { useEffect, useRef, useState, useCallback } from "react";
// React Native's own Linking, not expo-linking: the redirect url is all this
// needs, and expo-linking is only present here as a transitive dependency.
import { Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import { svuotaCache } from "@/model/localCache";
import { driveTokenManager } from "@/config/driveAuth";
import { resetDriveFolderCache } from "@/model/driveRepo";
import { messaggioErrore } from "@/model/errorMessages";
import { parametriRedirect } from "@/model/oauthRedirect";

WebBrowser.maybeCompleteAuthSession();

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Authorization codes are single-use and the redirect can reach us twice —
  // once resolving the browser session, once as a deep link — so remember
  // which ones were already spent.
  const codiciUsati = useRef(new Set<string>());
  /** In-flight exchange, so the browser branch can wait for the listener's. */
  const scambioInCorso = useRef<Promise<boolean> | null>(null);

  /**
   * Turns an authorization code into a session, at most once per code. A
   * repeated code returns the original attempt rather than a stale `true`:
   * the two paths race, and the loser must be able to await the winner.
   */
  const scambiaCodice = useCallback((code: string): Promise<boolean> => {
    if (codiciUsati.current.has(code)) return scambioInCorso.current ?? Promise.resolve(true);
    codiciUsati.current.add(code);

    const scambio = (async () => {
      const { data, error: err } = await supabase.auth.exchangeCodeForSession(code);
      if (err) {
        setError(messaggioErrore(err));
        return false;
      }
      // A successful exchange with no session means it could not be written
      // to secure storage: without this branch the app just re-rendered the
      // login screen as if nothing had happened.
      if (!data.session) {
        setError(
          "Accesso riuscito ma non sono riuscito a salvare la sessione sul dispositivo. Riprova."
        );
        return false;
      }
      return true;
    })();

    scambioInCorso.current = scambio;
    return scambio;
  }, []);

  // The redirect does not always come back through the browser session that
  // opened it: Android can hand the deep link to the app as a fresh intent,
  // and openAuthSessionAsync then reports a plain dismissal. Listening for
  // the url as well means the login still completes in that case.
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      const { code } = parametriRedirect(url);
      if (code) void scambiaCodice(code);
    });
    return () => sub.remove();
  }, [scambiaCodice]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    scambioInCorso.current = null;
    const redirectTo = AuthSession.makeRedirectUri({ scheme: "ripassa" });
    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (err) {
      setError(messaggioErrore(err));
      return;
    }
    if (!data.url) {
      setError("Non riesco ad avviare l'accesso con Google. Riprova tra poco.");
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    // "cancel" is the user deliberately closing the browser: no error to show.
    if (result.type === "cancel") return;

    if (result.type !== "success" || !result.url) {
      // The deep-link listener above may have finished the job already; on
      // Android a completed login and a user-dismissed tab look the same
      // here. Wait for any exchange it started before calling this a failure.
      if (await scambioInCorso.current) return;
      const { data: attuale } = await supabase.auth.getSession();
      if (attuale.session) return;
      // Otherwise the browser really did go away without reaching the
      // redirect. Both plausible causes are outside the app, so name them
      // rather than dropping the user back on the login screen in silence.
      setError(
        "Il browser si è chiuso senza tornare all'app. Di solito è la schermata di consenso Google che blocca l'accesso (progetto in \"Testing\": il tuo account deve essere fra i Test users), " +
          `oppure "${redirectTo}" non è fra i Redirect URLs del progetto Supabase.`
      );
      return;
    }

    const params = parametriRedirect(result.url);
    const oauthError = params.error_description ?? params.error;
    if (oauthError) {
      setError(messaggioErrore(oauthError));
      return;
    }
    // PKCE flow: the redirect carries code=... (no longer access_token=...).
    if (!params.code) {
      setError(
        "Google ha risposto ma il redirect non conteneva il codice di autorizzazione. Riprova; se persiste, verifica la configurazione del provider Google su Supabase."
      );
      return;
    }
    await scambiaCodice(params.code);
  }, [scambiaCodice]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(messaggioErrore(err));
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) setError(messaggioErrore(err));
  }, []);

  // Google Drive access authorization (separate from identity login: the
  // user grants access to their own files when they choose to upload attachments).
  const [driveAutorizzato, setDriveAutorizzato] = useState(false);

  useEffect(() => {
    driveTokenManager.isAuthorized().then(setDriveAutorizzato);
  }, [session]);

  const autorizzaDrive = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const ok = await driveTokenManager.authorize();
      setDriveAutorizzato(ok);
      return ok;
    } catch (e) {
      setError(messaggioErrore(e));
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    // Cached files belong to the user: remove them on logout.
    try {
      await svuotaCache();
    } catch {
      // Cache not initialized or already empty: don't block logout.
    }
    // Revoke the local Drive access and reset the folder cache.
    try {
      await driveTokenManager.clear();
      resetDriveFolderCache();
    } catch {
      // Tokens already absent: proceed with logout.
    }
    setDriveAutorizzato(false);
    await supabase.auth.signOut();
  }, []);

  return {
    session,
    loading,
    error,
    driveAutorizzato,
    autorizzaDrive,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
