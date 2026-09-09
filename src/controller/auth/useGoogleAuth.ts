/**
 * Controller — the Google browser round trip: signing in with Google, and
 * attaching Google to an account that already exists.
 *
 * Split out of useAuth for the same reason useDriveAuth was: useAuth was one
 * 500-line file responsible for session restore, redirect routing, email
 * auth *and* this, and the two Google flows below differ only in the
 * Supabase call that produces the consent URL and in what counts as
 * success — everything between (opening the tab, the Android redirect race,
 * the PKCE exchange) is one implementation shared by both.
 *
 * `scambiaCodice` and its in-flight ref stay in useAuth rather than moving
 * here: turning a code into a session touches `session` itself, which is
 * core useAuth state that the redirect listener also has to update, and
 * duplicating that would let the two paths disagree about what "signed in"
 * means. This hook is handed both as parameters, the same way it is handed
 * `session` to read and `setError` to report through — composition, not
 * ownership.
 */
import { useCallback } from "react";
import type { RefObject } from "react";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import { parametriRedirect } from "@/model/auth/oauthRedirect";
import {
  attendiRedirect,
  erroreBrowserChiuso,
  erroreLogin,
  providerCollegati,
  redirectLogin,
} from "./oauthLogin";

export interface StatoGoogleAuth {
  /** Whether Google is one of the ways this account can be signed in to. */
  googleCollegato: boolean;
  signInWithGoogle: () => Promise<void>;
  /** Attaches Google to the current account. True when it was linked. */
  collegaGoogle: () => Promise<boolean>;
}

export function useGoogleAuth(
  session: Session | null,
  scambiaCodice: (code: string) => Promise<boolean>,
  scambioInCorsoRef: RefObject<Promise<boolean> | null>,
  setError: (messaggio: string | null) => void
): StatoGoogleAuth {
  /**
   * The Google browser round trip, shared by signing in and by attaching
   * Google to an account that already exists.
   *
   * `giaRiuscito` answers "did this work anyway?" when the browser result is
   * inconclusive. It has to be supplied per flow: for a login the mere
   * existence of a session settles it, but a link starts from a session that
   * was already there, so the same check would call every failure a success.
   */
  const flussoGoogle = useCallback(
    async (
      avvia: (redirectTo: string) => Promise<{ url: string | null; error: unknown }>,
      giaRiuscito: () => Promise<boolean>,
      azione: string
    ): Promise<boolean> => {
      setError(null);
      scambioInCorsoRef.current = null;
      const redirectTo = redirectLogin();

      const { url, error: err } = await avvia(redirectTo);
      if (err) {
        setError(erroreLogin(err, `avvio ${azione}`));
        return false;
      }
      if (!url) {
        setError(`Non riesco ad avviare ${azione} con Google. Riprova tra poco.`);
        return false;
      }

      const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);

      // "cancel" is the user deliberately closing the browser: no error to show.
      if (result.type === "cancel") return false;

      if (result.type !== "success" || !result.url) {
        // The deep-link listener in useAuth may have finished the job already;
        // on Android a completed flow and a user-dismissed tab look the same
        // here. Wait for any exchange it started before calling this a failure.
        if (await attendiRedirect(() => scambioInCorsoRef.current)) return true;
        if (await giaRiuscito()) return true;
        setError(erroreBrowserChiuso(result.type, redirectTo));
        return false;
      }

      const params = parametriRedirect(result.url);
      const oauthError = params.error_description ?? params.error;
      if (oauthError) {
        setError(erroreLogin(oauthError, "risposta Google"));
        return false;
      }
      // PKCE flow: the redirect carries code=... (no longer access_token=...).
      if (!params.code) {
        setError(
          "Google ha risposto ma il redirect non conteneva il codice di autorizzazione. Riprova; se persiste, verifica la configurazione del provider Google su Supabase."
        );
        return false;
      }
      return scambiaCodice(params.code);
    },
    [scambiaCodice, scambioInCorsoRef, setError]
  );

  const signInWithGoogle = useCallback(async () => {
    await flussoGoogle(
      async (redirectTo) => {
        const { data, error: err } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, skipBrowserRedirect: true },
        });
        return { url: data?.url ?? null, error: err };
      },
      async () => (await supabase.auth.getSession()).data.session !== null,
      "l'accesso"
    );
  }, [flussoGoogle]);

  /**
   * Attaches Google to the account the user is already signed in to, so both
   * buttons lead to the same place next time.
   *
   * Not what makes the data line up — that is the account/identity split in
   * the database, which already gives one set of ripassi to one verified
   * address however it was reached. This is the convenience on top: one auth
   * user with two ways in, instead of two that happen to agree.
   *
   * Requires "Manual linking" enabled in Supabase (Authentication → Settings).
   * Without it the call comes back refused and the user sees the error.
   */
  const collegaGoogle = useCallback(
    () =>
      flussoGoogle(
        async (redirectTo) => {
          const { data, error: err } = await supabase.auth.linkIdentity({
            provider: "google",
            options: { redirectTo, skipBrowserRedirect: true },
          });
          return { url: data?.url ?? null, error: err };
        },
        async () => {
          const { data } = await supabase.auth.getUser();
          return providerCollegati(data.user).includes("google");
        },
        "il collegamento"
      ),
    [flussoGoogle]
  );

  return {
    googleCollegato: providerCollegati(session?.user).includes("google"),
    signInWithGoogle,
    collegaGoogle,
  };
}
