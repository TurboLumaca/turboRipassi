/**
 * Controller — autenticazione (sezione 2/3: Supabase Auth, Google OAuth).
 * Espone la sessione e le azioni di login/logout. La View non tocca supabase.auth.
 */
import { useEffect, useState, useCallback } from "react";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import { svuotaCache } from "@/model/localCache";

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
      setError(err.message);
      return;
    }
    if (!data.url) {
      setError("URL OAuth non disponibile.");
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === "success" && result.url) {
      const params = new URL(result.url).hash.replace(/^#/, "");
      const parsed = new URLSearchParams(params);
      const access_token = parsed.get("access_token");
      const refresh_token = parsed.get("refresh_token");
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) setError(err.message);
  }, []);

  const signOut = useCallback(async () => {
    // I file in cache appartengono all'utente: al logout vanno rimossi.
    try {
      await svuotaCache();
    } catch {
      // cache non inizializzata o già vuota: non bloccare il logout
    }
    await supabase.auth.signOut();
  }, []);

  return {
    session,
    loading,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
