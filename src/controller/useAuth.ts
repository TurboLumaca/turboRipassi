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
    if (result.type !== "success" || !result.url) return; // cancelled by the user

    // PKCE flow: the redirect carries ?code=... (no longer #access_token=...).
    const params = new URL(result.url).searchParams;
    const oauthError = params.get("error_description") ?? params.get("error");
    if (oauthError) {
      setError(messaggioErrore(oauthError));
      return;
    }
    const code = params.get("code");
    if (!code) {
      setError("Accesso con Google non completato. Riprova.");
      return;
    }
    const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchErr) setError(messaggioErrore(exchErr));
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
