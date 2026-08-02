/**
 * Controller — authentication (spec section 2/3: Supabase Auth, Google OAuth).
 * Exposes the session and login/logout actions. The View never touches supabase.auth.
 */
import { useEffect, useState, useCallback } from "react";
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

  const signInWithGoogle = useCallback(async () => {
    setError(null);
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
    // Anything else that isn't a success means the browser went away without
    // ever reaching our redirect. The usual cause is the redirect URL missing
    // from the Supabase allow-list: Supabase then silently sends the browser
    // to the project's Site URL, which never comes back to the app. Say so
    // instead of dropping the user back on the login screen with no message.
    if (result.type !== "success" || !result.url) {
      setError(
        `Il browser si è chiuso senza tornare all'app. Controlla che "${redirectTo}" sia fra i Redirect URLs del progetto Supabase (Authentication → URL Configuration).`
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
    const { data: scambio, error: exchErr } = await supabase.auth.exchangeCodeForSession(
      params.code
    );
    if (exchErr) {
      setError(messaggioErrore(exchErr));
      return;
    }
    // A successful exchange with no session means the session could not be
    // written to secure storage: without this branch the app just re-rendered
    // the login screen as if nothing had happened.
    if (!scambio.session) {
      setError(
        "Accesso riuscito ma non sono riuscito a salvare la sessione sul dispositivo. Riprova."
      );
    }
  }, []);

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
