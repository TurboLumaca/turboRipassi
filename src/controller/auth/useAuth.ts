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
import { isErroreDiRete, messaggioErrore } from "@/model/shared/errorMessages";
import { corrispondeRedirect, parametriRedirect } from "@/model/auth/oauthRedirect";
import { dimenticaCodiciUsati, marcaUsato } from "@/model/auth/codiciUsati";
import { dimenticaSessione, leggiSessione, salvaSessione } from "@/model/auth/sessioneLocale";
import { dimenticaRipassiSalvati } from "@/model/ripassi/ripassiOffline";
import {
  attendiRedirect,
  erroreBrowserChiuso,
  erroreLogin,
  providerCollegati,
  redirectLogin,
} from "./oauthLogin";
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
  /** Whether Google is one of the ways this account can be signed in to. */
  googleCollegato: boolean;
  /** Attaches Google to the current account. True when it was linked. */
  collegaGoogle: () => Promise<boolean>;
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
   * True while the session on screen is the copy restored from the device
   * rather than one Supabase has confirmed.
   *
   * It is what tells "no session" apart from "no answer". Both reach this hook
   * as a null, from `getSession()` and from the INITIAL_SESSION event, and
   * offline they are the *normal* outcome: the stored access token has expired
   * and the refresh cannot leave the device. Treating that as a sign-out is how
   * a cold start in airplane mode ended on the login screen, which is the one
   * screen that needs a connection to be of any use.
   *
   * Cleared as soon as a real session or a real sign-out arrives — and one
   * will: in React Native the token ticker keeps running, so the first refresh
   * that gets through settles the question on its own.
   */
  const sessioneDaDispositivo = useRef(false);

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

  /**
   * Every session that arrives is also written to the device, so the next
   * launch has something to open with before it has spoken to anyone.
   *
   * A null needs reading, not obeying. Only SIGNED_OUT is a decision; the null
   * that comes with INITIAL_SESSION merely reports what `getSession()` could
   * work out, and offline that is nothing. Closing the app on it would undo
   * the session restored a moment earlier from disk.
   */
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (s) {
        sessioneDaDispositivo.current = false;
        setSession(s);
        void salvaSessione(s);
        return;
      }
      if (evento === "SIGNED_OUT") {
        sessioneDaDispositivo.current = false;
        setSession(null);
        void dimenticaSessione();
        return;
      }
      if (!sessioneDaDispositivo.current) setSession(null);
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
    void assicuraAccount().catch((e) => {
      // Now that the app also opens with no connection, this round trip fails
      // at every launch on a train. Being unreachable is the expected outcome
      // there, not an incident: reporting it would fill the dashboard with
      // events nobody can act on, and hide the ones that mean something.
      if (!isErroreDiRete(e)) reportError(e, { operazione: "assicuraAccount" });
    });
  }, [utenteId]);

  /**
   * Startup, in two steps: open on what the device already knows, then let
   * Supabase confirm or correct it.
   *
   * The order is the whole point. `getSession()` is not a local read — an
   * access token older than an hour sends it to refresh first, and with no
   * connection that attempt retries with backoff for about half a minute and
   * then reports no session at all. Waiting for it meant a long spinner and
   * then the login screen: the app was unusable in airplane mode even though
   * everything it needed was already on the device.
   *
   * So the copy on disk decides the first frame, and `loading` ends there.
   * What comes back afterwards can only improve it — a confirmed session
   * replaces the copy, and a real sign-out clears it. A failure to *reach* the
   * server changes nothing, which is the case this whole shape exists for.
   *
   * getInitialURL is what makes a login started before a cold start work at
   * all. Android kills a backgrounded process freely, and a custom tab showing
   * Google's consent page makes that likely; the redirect then cold-starts the
   * app, so the "url" event never fires and the promise awaiting the browser
   * died with the old process. The whole flow simply reopened the login screen
   * with no error — the app had genuinely forgotten it had ever started a
   * login. It still gates `loading` in the one case where it can help: when
   * there is no session to open with, the login screen must not flash before
   * the redirect has had its say.
   */
  useEffect(() => {
    let vivo = true;
    void (async () => {
      // 1. The device's own answer. No network, so it arrives in milliseconds.
      const salvata = await leggiSessione();
      if (!vivo) return;
      if (salvata) {
        sessioneDaDispositivo.current = true;
        setSession(salvata);
        setLoading(false);
      }

      // 2. The server's answer, whenever it comes — or doesn't.
      try {
        const [{ data, error: err }, urlIniziale] = await Promise.all([
          supabase.auth.getSession(),
          Linking.getInitialURL(),
        ]);
        if (!vivo) return;

        if (data.session) {
          sessioneDaDispositivo.current = false;
          setSession(data.session);
          await salvaSessione(data.session);
        } else if (!salvata || !isErroreDiRete(err)) {
          // A null that is an answer and not a silence: the session is over.
          // The one case left out is the point of all this — unreachable, with
          // a copy on the device — and there the screen stays as it opened.
          sessioneDaDispositivo.current = false;
          setSession(null);
          if (salvata) await dimenticaSessione();
        }

        // An already valid session means this is an ordinary launch, or a
        // relaunch whose code was spent: don't replay a stale redirect.
        if (!data.session && !salvata && urlIniziale) await gestisciRedirect(urlIniziale);
      } catch (e) {
        // getSession is not supposed to reject, and a rejection used to strand
        // the app on the spinner for good: nothing else cleared `loading`.
        if (!isErroreDiRete(e)) reportError(e, { operazione: "avvioSessione" });
      } finally {
        if (vivo) setLoading(false);
      }
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

  /**
   * The Google browser round trip, shared by signing in and by attaching
   * Google to an account that already exists.
   *
   * The two differ only in the Supabase call that produces the consent URL
   * and in what counts as success. Everything between — opening the tab, the
   * Android redirect race, the PKCE exchange — is identical, and was worth
   * one implementation rather than two that drift.
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
      scambioInCorso.current = null;
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
        // The deep-link listener above may have finished the job already; on
        // Android a completed flow and a user-dismissed tab look the same
        // here. Wait for any exchange it started before calling this a failure.
        if (await attendiRedirect(() => scambioInCorso.current)) return true;
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
    [scambiaCodice]
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
    // Closing the session comes first, and its failure is reported: doing it
    // last meant that a failed sign-out left the device half-way — cache and
    // Drive token already destroyed, session still open — with nothing on
    // screen to say so. The rejection also had nowhere to go, because the
    // caller is an onPress that does not await.
    setError(null);
    try {
      const { error: err } = await supabase.auth.signOut();
      if (err) throw err;
    } catch (e) {
      setError(messaggioErrore(e));
      reportError(e, { operazione: "signOut" });
      return;
    }

    // Everything kept on the device to make the app work offline belongs to
    // the user who just left: the attachments, the list they hang off, and the
    // session that would otherwise reopen the app as them.
    sessioneDaDispositivo.current = false;
    await dimenticaSessione();
    await dimenticaRipassiSalvati();
    try {
      await svuotaCache();
    } catch {
      // Cache not initialized or already empty: don't block logout.
    }
    await dimenticaDrive();
    dimenticaCodiciUsati();
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
    googleCollegato: providerCollegati(session?.user).includes("google"),
    collegaGoogle,
    autorizzaDrive,
    assicuraAccessoDrive,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
