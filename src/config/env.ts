/**
 * Config layer — reading runtime configuration.
 *
 * Every value follows the same two-step lookup: an EXPO_PUBLIC_ env var (from
 * .env) first, then app.json → extra. Placeholder detection is shared too, so
 * a freshly cloned repo fails the same way everywhere instead of one module
 * treating "…PLACEHOLDER" as a real value.
 *
 * This is the only place that reads process.env / Constants.expoConfig: the
 * modules below it (supabase.ts, driveConfig.ts, crashReporting.ts) declare
 * *which* keys they need, not *how* to find them.
 */
import Constants from "expo-constants";

/** Values that mean "not configured yet" in .env.example and app.json. */
const MARCATORI_PLACEHOLDER = ["PLACEHOLDER", "xxxxxxxx"];

/** Raw value from env or app.json → extra. Empty string when neither is set. */
export function readConfigValue(envName: string, extraKey: string): string {
  const fromEnv = process.env[envName];
  const fromExtra = (Constants.expoConfig?.extra as Record<string, string> | undefined)?.[extraKey];
  return fromEnv ?? fromExtra ?? "";
}

/** True when the value is missing or still one of the example placeholders. */
export function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;
  return MARCATORI_PLACEHOLDER.some((marcatore) => value.includes(marcatore));
}

/** Value only when it is actually configured; null for missing/placeholder. */
export function readValidConfig(envName: string, extraKey: string): string | null {
  const value = readConfigValue(envName, extraKey);
  return isPlaceholder(value) ? null : value;
}
