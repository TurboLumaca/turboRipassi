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
import { driveTokenManager, driveRedirectUri } from "@/config/driveAuth";
import { resetDriveFolderCache } from "@/model/driveRepo";
import { messaggioErrore } from "@/model/errorMessages";
import { corrispondeRedirect, parametriRedirect } from "@/model/oauthRedirect";

WebBrowser.maybeCompleteAuthSession();

/** Where Supabase sends the browser back after the Google login. */
function redirectLogin(): string {
  return AuthSession.makeRedirectUri({ scheme: "ripassa" });
}

/**
 * Gives a redirect that may still be in flight a moment to land.
 *
 * The browser result and the deep link are two sides of the same native
 * transition and arrive in no guaranteed order, so a dismissal is only really
 * a dismissal once nothing has shown up in the meantime.
 */
async function attendiRedirect(
  inCorso: () => Promise<boolean> | null,
  attesaMs = 1500
): Promise<boolean> {
  const scadenza = Date.now() + attesaMs;
  for (;;) {
    const scambio = inCorso();
    if (scambio) return scambio;
    if (Date.now() >= scadenza) return false;
    await new Promise((r) => setTimeout(r, 100));
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Google Drive access authorization (separate from identity login: the user
  // grants access to their own files when they choose to upload attachments).
  const [driveAutorizzato, setDriveAutorizzato] = useState(false);

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

  /**
   * Routes an OAuth redirect to the flow it belongs to.
   *
   * Both flows come back carrying a `code`, so the target is the only thing
   * that tells them apart. Without the check the login listener also caught
   * the Drive redirect and spent its code against Supabase, which loses the
   * authorization for good.
   */
  const gestisciRedirect = useCallback(
    async (url: string) => {
      if (corrispondeRedirect(url, redirectLogin())) {
        const { code } = parametriRedirect(url);
        if (code) await scambiaCodice(code);
        return;
      }
      if (corrispondeRedirect(url, driveRedirectUri())) {
        try {
          if (await driveTokenManager.completaAutorizzazione(url)) setDriveAutorizzato(true);
        } catch (e) {
          setError(messaggioErrore(e));
        }
      }
    },
    [scambiaCodice]
  );

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /**
   * Startup: restore the stored session and, if the app was launched *by* the
   * redirect, finish that login.
   *
   * getInitialURL is what makes the second case work at all. Android kills a
   * backgrounded process freely, and a custom tab showing Google's consent
   * page makes that likely; the redirect then cold-starts the app, so the
   * "url" event never fires and the promise awaiting the browser died with
   * the old process. The whole flow simply reopened the login screen with no
   * error — the app had genuinely forgotten it had ever started a login.
   *
   * Both checks gate `loading`, so the login screen doesn't flash before the
   * session lands.
   */
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [{ data }, urlIniziale] = await Promise.all([
        supabase.auth.getSession(),
        Linking.getInitialURL(),
      ]);
      if (!vivo) return;
      setSession(data.session);
      // An already valid session means this is an ordinary launch, or a
      // relaunch whose code was spent: don't replay a stale redirect.
      if (!data.session && urlIniziale) await gestisciRedirect(urlIniziale);
      if (vivo) setLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, [gestisciRedirect]);

  // The redirect does not always come back through the browser session that
  // opened it: Android can hand the deep link to a still-running app as a
  // fresh intent, and openAuthSessionAsync then reports a plain dismissal.
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => void gestisciRedirect(url));
    return () => sub.remove();
  }, [gestisciRedirect]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    scambioInCorso.current = null;
    const redirectTo = redirectLogin();
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
      if (await attendiRedirect(() => scambioInCorso.current)) return;
      const { data: attuale } = await supabase.auth.getSession();
      if (attuale.session) return;
      // Otherwise the browser really did go away without reaching the
      // redirect. The outcome type is included because it separates the two
      // causes: "dismiss" is the browser closing on its own or the redirect
      // never firing, while "locked" means a previous attempt is still open.
      setError(
        `Il browser si è chiuso senza tornare all'app (esito: ${result.type}). ` +
          `Verifica che "${redirectTo}" sia fra i Redirect URLs di Supabase e riprova.`
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
