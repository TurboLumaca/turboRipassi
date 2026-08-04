/**
 * Controller — authentication (spec section 2/3: Supabase Auth, Google OAuth).
 * Exposes the session and login/logout actions. The View never touches
 * supabase.auth.
 *
 * Drive authorization is composed in from useDriveAuth rather than handled
 * here: it is a separate grant with its own tokens, and keeping it in this
 * file made one hook responsible for two unrelated OAuth flows. The returned
 * shape is unchanged, so AuthContext and its consumers see the same API.
 */
import { useCallback, useEffect, useRef, useState } from "react";
// React Native's own Linking, not expo-linking: the redirect url is all this
// needs, and expo-linking is only present here as a transitive dependency.
import { Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import { reportError } from "@/config/crashReporting";
import { assicuraAccount } from "@/model/shared/account";
import { svuotaCache } from "@/model/cache/localCache";
import { driveRedirectUri } from "@/model/drive/driveAuth";
import { messaggioErrore } from "@/model/shared/errorMessages";
import { corrispondeRedirect, parametriRedirect } from "@/model/auth/oauthRedirect";
import { dimenticaCodiciUsati, marcaUsato } from "@/model/auth/codiciUsati";
import { attendiRedirect, erroreBrowserChiuso, erroreLogin, redirectLogin } from "./oauthLogin";
import { useDriveAuth } from "./useDriveAuth";

WebBrowser.maybeCompleteAuthSession();

/**
 * What the authentication Controller offers to the rest of the app.
 *
 * Declared explicitly rather than inferred from the hook: this is the contract
 * AuthContext hands to every screen, and an inferred one changes shape
 * silently whenever the implementation is refactored.
 */
export interface StatoAuth {
  /** Current Supabase session; null when signed out. */
  session: Session | null;
  /** True until the stored session (and any launch redirect) has been read. */
  loading: boolean;
  /** Last error to show on the login screen; null when there is none. */
  error: string | null;
  /** Whether the app currently holds tokens for the user's Drive. */
  driveAutorizzato: boolean;
  /** Starts the Drive consent flow. True when access was granted. */
  autorizzaDrive: () => Promise<boolean>;
  /**
   * Guarantees a usable Drive access token, asking for consent if needed.
   * Single entry point for any code about to touch Drive.
   */
  assicuraAccessoDrive: () => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): StatoAuth {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Google Drive access authorization (separate from identity login: the user
  // grants access to their own files when they choose to upload attachments).
  const {
    driveAutorizzato,
    autorizzaDrive,
    assicuraAccesso: assicuraAccessoDrive,
    completaRedirectDrive,
    dimenticaDrive,
  } = useDriveAuth(setError, session);

  /** In-flight exchange, so the browser branch can wait for the listener's. */
  const scambioInCorso = useRef<Promise<boolean> | null>(null);

  /**
   * Turns an authorization code into a session, at most once per code. A
   * repeated code returns the original attempt rather than a stale `true`:
   * the two paths race, and the loser must be able to await the winner.
   */
  const scambiaCodice = useCallback((code: string): Promise<boolean> => {
    // Single-use code, and the redirect can reach us twice — once resolving
    // the browser session, once as a deep link (see model/auth/codiciUsati).
    if (marcaUsato(code)) return scambioInCorso.current ?? Promise.resolve(true);

    const scambio = (async () => {
      const { data, error: err } = await supabase.auth.exchangeCodeForSession(code);
      if (err) {
        // A spent code is not necessarily a failed login: the redirect reaches
        // the app by more than one route, and whichever arrives second finds
        // the flow state already consumed by the first. Only the absence of a
        // session makes this an error worth showing — otherwise the user was
        // already in, staring at "operazione non riuscita".
        const { data: attuale } = await supabase.auth.getSession();
        if (attuale.session) return true;
        setError(erroreLogin(err, "scambio codice"));
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
        await completaRedirectDrive(url);
      }
    },
    [scambiaCodice, completaRedirectDrive]
  );

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /**
   * Make sure the signed-in identity is attached to an account.
   *
   * Ownership is by account, and an identity without one reads and writes
   * nothing at all — every policy compares against it. The database attaches
   * it on sign-up, so this is a repair for the case where it did not, and
   * normally a single no-op round trip per session.
   *
   * Failure is reported but not surfaced: it does not stop the user from
   * doing anything the next screen wouldn't stop them from doing anyway, and
   * an error banner over a working app is worse than a silent retry at the
   * next launch.
   */
  const utenteId = session?.user.id;
  useEffect(() => {
    if (!utenteId) return;
    void assicuraAccount().catch((e) => reportError(e, { operazione: "assicuraAccount" }));
  }, [utenteId]);

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
      setError(erroreLogin(err, "avvio OAuth"));
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
      setError(erroreBrowserChiuso(result.type, redirectTo));
      return;
    }

    const params = parametriRedirect(result.url);
    const oauthError = params.error_description ?? params.error;
    if (oauthError) {
      setError(erroreLogin(oauthError, "risposta Google"));
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

  /** Sign-in and sign-up differ only in the Supabase call they make. */
  const eseguiAccessoEmail = useCallback(
    async (azione: () => Promise<{ error: unknown }>) => {
      setError(null);
      const { error: err } = await azione();
      if (err) setError(messaggioErrore(err));
    },
    []
  );

  const signInWithEmail = useCallback(
    (email: string, password: string) =>
      eseguiAccessoEmail(() => supabase.auth.signInWithPassword({ email, password })),
    [eseguiAccessoEmail]
  );

  const signUpWithEmail = useCallback(
    (email: string, password: string) =>
      eseguiAccessoEmail(() => supabase.auth.signUp({ email, password })),
    [eseguiAccessoEmail]
  );

  const signOut = useCallback(async () => {
    // Cached files belong to the user: remove them on logout.
    try {
      await svuotaCache();
    } catch {
      // Cache not initialized or already empty: don't block logout.
    }
    await dimenticaDrive();
    dimenticaCodiciUsati();
    await supabase.auth.signOut();
  }, [dimenticaDrive]);

  // Not wrapped in useMemo on purpose: the React Compiler (enabled in
  // app.json) memoizes this object from the same dependencies a hand-written
  // useMemo would list, and a nine-entry dependency array kept by hand is a
  // stale-closure bug waiting to happen. The useCallback above stay, because
  // there the identity has meaning: those functions feed effect dependencies.
  return {
    session,
    loading,
    error,
    driveAutorizzato,
    autorizzaDrive,
    assicuraAccessoDrive,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
