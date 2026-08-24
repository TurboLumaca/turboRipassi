/**
 * Config layer — crash reporting (Sentry).
 * Centralizes Sentry init and reporting so the rest of the app never imports
 * the SDK directly. Reading the DSN follows the same env/extra priority as
 * supabase.ts. Without a DSN the module no-ops gracefully: the app runs and
 * builds normally, it just doesn't send crashes (useful in local dev / tests).
 */
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { readValidConfig } from "./env";
import { supabase } from "./supabase";

/**
 * Edge Function that turns a report into an email. Named here and implemented
 * in supabase/functions/segnala-problema: the recipient address and the mail
 * provider's key stay on the server, where they cannot be read out of the
 * shipped binary.
 */
const FUNZIONE_SEGNALAZIONI = "segnala-problema";

/**
 * Resolve the DSN. Priority 1: EXPO_PUBLIC_SENTRY_DSN (.env). Priority 2:
 * app.json → extra.sentryDsn. Placeholders count as "not configured".
 */
export function resolveSentryDsn(): string | null {
  return readValidConfig("sentryDsn");
}

let initialized = false;

/**
 * Initialize Sentry once, at app startup. Safe to call when no DSN is set:
 * it warns and returns without touching the SDK.
 */
export function initCrashReporting(): void {
  if (initialized) return;
  const dsn = resolveSentryDsn();
  if (!dsn) {
    console.warn(
      "[crashReporting] No Sentry DSN configured (EXPO_PUBLIC_SENTRY_DSN / extra.sentryDsn). Crash reporting disabled."
    );
    return;
  }
  Sentry.init({
    dsn,
    // Report the release channel so dashboard filtering separates dev from
    // production crashes.
    environment: __DEV__ ? "development" : "production",
    // Don't send events while developing, only capture them in installed builds.
    enabled: !__DEV__,
    // No performance tracing for now: crash reporting is the goal, and tracing
    // adds cost/noise. Can be raised later.
    tracesSampleRate: 0,
  });
  initialized = true;
}

/**
 * Report an error caught by the app (e.g. the root ErrorBoundary). No-ops when
 * reporting is disabled, so callers don't need to guard.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Re-export the Sentry wrap HOC so App.tsx doesn't import the SDK directly. */
export const wrapWithCrashReporting = Sentry.wrap;

/** What the user typed, plus whatever the app already knows about them. */
export interface DatiSegnalazione {
  /** Free text written by the user. */
  descrizione: string;
  /** Address of the signed-in account, so a reply has somewhere to go. */
  email?: string | null;
  /** The last error the app showed, when there was one. */
  ultimoErrore?: string | null;
}

/**
 * Three outcomes, and not a boolean: "reporting is off in this build" and "it
 * did not leave the device" are the same failure for the code and completely
 * different sentences for the user, who can act on the second one and not on
 * the first.
 */
export type EsitoSegnalazione = "inviata" | "nonConfigurato" | "nonRiuscita";

/**
 * Sends a problem report written by the user, as an email.
 *
 * Handled errors — a failed Drive upload, a rejected write — are translated,
 * shown and forgotten: only unhandled crashes reached Sentry, so the failures
 * users actually run into left no trace anyone could act on. This is the way
 * back: the person who saw it says what happened, and the report carries the
 * context they would otherwise have to describe.
 *
 * It used to go to Sentry alone, and that was the wrong destination for this
 * one message. A crash is telemetry, something you find when you go looking; a
 * person writing "ho allegato una foto e non è stata caricata" is writing *to*
 * someone, and that belongs in an inbox. The Edge Function is what does the
 * sending: the recipient and the mail provider's key live there, because an
 * address and an API key shipped inside an APK are an address anyone can spam
 * and a key anyone can send mail with.
 *
 * Sentry still gets a copy when it is configured, as a breadcrumb next to the
 * crashes of the same session — but it no longer decides whether the report
 * was sent. That answer now comes from the function's reply.
 */
export async function inviaSegnalazione(dati: DatiSegnalazione): Promise<EsitoSegnalazione> {
  const contesto = {
    descrizione: dati.descrizione,
    email: dati.email ?? null,
    ultimoErrore: dati.ultimoErrore ?? null,
    piattaforma: Platform.OS,
    versioneApp: Constants.expoConfig?.version ?? "sconosciuta",
  };

  // Best effort and deliberately not awaited into the outcome: a missing DSN
  // must not stop a report that is on its way to a mailbox.
  if (initialized) {
    Sentry.captureMessage("Segnalazione utente", { level: "info", extra: contesto });
  }

  try {
    const { error } = await supabase.functions.invoke(FUNZIONE_SEGNALAZIONI, {
      body: contesto,
    });
    if (!error) return "inviata";

    // 501 is the function saying it has no mail provider configured: nothing
    // the user can retry, and a different sentence from "it did not leave".
    const stato = (error as { context?: { status?: number } }).context?.status;
    if (stato === 501) {
      console.warn("[crashReporting] Edge Function segnala-problema senza RESEND_API_KEY.");
      return "nonConfigurato";
    }
    reportError(error, { operazione: "inviaSegnalazione" });
    return "nonRiuscita";
  } catch (e) {
    // Offline, DNS, the function not deployed: the report did not leave, which
    // is all the caller needs to know.
    reportError(e, { operazione: "inviaSegnalazione" });
    return "nonRiuscita";
  }
}
