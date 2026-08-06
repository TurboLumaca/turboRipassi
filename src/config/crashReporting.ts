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
 * Sends a problem report written by the user.
 *
 * Handled errors — a failed Drive upload, a rejected write — are translated,
 * shown and forgotten: only unhandled crashes reached Sentry, so the failures
 * users actually run into left no trace anyone could act on. This is the way
 * back: the person who saw it says what happened, and the report carries the
 * context they would otherwise have to describe.
 *
 * The flush is what makes the confirmation honest. captureMessage only queues
 * the event, so without waiting for the queue to drain the screen would say
 * "sent" to someone in a tunnel with no connection. It resolves false when the
 * queue did not empty within the client's own timeout, which is exactly the
 * question being asked here.
 */
export async function inviaSegnalazione(dati: DatiSegnalazione): Promise<EsitoSegnalazione> {
  if (!initialized) {
    console.warn(
      "[crashReporting] No Sentry DSN configured: problem report not sent. Descrizione: " +
        dati.descrizione
    );
    return "nonConfigurato";
  }

  Sentry.captureMessage("Segnalazione utente", {
    level: "info",
    extra: {
      descrizione: dati.descrizione,
      email: dati.email ?? null,
      ultimoErrore: dati.ultimoErrore ?? null,
      piattaforma: Platform.OS,
      versioneApp: Constants.expoConfig?.version ?? "sconosciuta",
    },
  });

  try {
    return (await Sentry.flush()) ? "inviata" : "nonRiuscita";
  } catch {
    // flush rejects when the transport is in a state it cannot recover from.
    // Either way the report did not leave: that is all the caller needs.
    return "nonRiuscita";
  }
}
