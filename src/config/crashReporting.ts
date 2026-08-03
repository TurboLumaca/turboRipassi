/**
 * Config layer — crash reporting (Sentry).
 * Centralizes Sentry init and reporting so the rest of the app never imports
 * the SDK directly. Reading the DSN follows the same env/extra priority as
 * supabase.ts. Without a DSN the module no-ops gracefully: the app runs and
 * builds normally, it just doesn't send crashes (useful in local dev / tests).
 */
import * as Sentry from "@sentry/react-native";
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
