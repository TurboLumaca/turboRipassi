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
import { dimenticaCoda } from "@/model/outbox/coda";
import { dimenticaPercorso } from "@/model/percorso/percorsoRepo";
import { notificheRepo } from "@/model/notifiche/notificheRepo";
import { erroreLogin, redirectLogin } from "./oauthLogin";
import { useDriveAuth } from "./useDriveAuth";
import { useGoogleAuth } from "./useGoogleAuth";

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
  /**
   * Whether Drive is writable right now without asking for consent. For work
   * the user did not just start — the queue draining by itself — where opening
   * a consent browser unprompted would be the wrong way to ask.
   */
  accessoDrivePronto: () => Promise<boolean>;
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
    accessoPronto: accessoDrivePronto,
    completaRedirectDrive,
    dimenticaDrive,
  } = useDriveAuth(setError, session);

  const puliziaLocaleCompleta = useCallback(async () => {
    sessioneDaDispositivo.current = false;
    await dimenticaSessione();
    await dimenticaRipassiSalvati();
    await dimenticaCoda();
    try {
      await svuotaCache();
    } catch {
      // Cache not initialized or already empty: don't block logout.
    }
    await dimenticaDrive();
    await dimenticaPercorso();
    dimenticaCodiciUsati();
    try {
      await notificheRepo.cancellaTutte();
    } catch {
      // Ignore notification cancellation failure during teardown.
    }
  }, [dimenticaDrive]);

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

  const { googleCollegato, signInWithGoogle, collegaGoogle } = useGoogleAuth(
    session,
    scambiaCodice,
    scambioInCorso,
    setError
  );

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
        setSession(null);
        void puliziaLocaleCompleta();
        return;
      }
      if (!sessioneDaDispositivo.current) setSession(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [puliziaLocaleCompleta]);

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
          setSession(null);
          await puliziaLocaleCompleta();
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
  }, [gestisciRedirect, puliziaLocaleCompleta]);

  // The redirect does not always come back through the browser session that
  // opened it: Android can hand the deep link to a still-running app as a
  // fresh intent, and openAuthSessionAsync then reports a plain dismissal.
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => void gestisciRedirect(url));
    return () => sub.remove();
  }, [gestisciRedirect]);

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
    setError(null);
    try {
      const { error: err } = await supabase.auth.signOut();
      if (err) throw err;
    } catch (e) {
      setError(messaggioErrore(e));
      reportError(e, { operazione: "signOut" });
    }

    setSession(null);
    await puliziaLocaleCompleta();
  }, [puliziaLocaleCompleta]);

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
    googleCollegato,
    collegaGoogle,
    autorizzaDrive,
    assicuraAccessoDrive,
    accessoDrivePronto,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
