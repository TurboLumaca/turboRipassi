/**
 * Config layer — reading runtime configuration.
 *
 * Every value follows the same two-step lookup: an EXPO_PUBLIC_ env var (from
 * .env, or from EAS in a cloud build) first, then app.json → extra. Placeholder
 * detection is shared too, so a freshly cloned repo fails the same way
 * everywhere instead of one module treating "…PLACEHOLDER" as a real value.
 *
 * This is the only place that reads process.env / Constants.expoConfig: the
 * modules below it (supabase.ts, driveConfig.ts, crashReporting.ts) declare
 * *which* key they need, not *how* to find it.
 *
 * The env vars are spelled out one by one, and never reached through a
 * computed name. Expo's Babel transform replaces `process.env.EXPO_PUBLIC_X`
 * textually at build time: there is no environment left to look up at runtime,
 * so `process.env[nome]` compiles to a lookup that is always undefined in an
 * installed build. That silently reduced every value to the app.json fallback
 * and made the variables registered on EAS dead weight.
 */
import Constants from "expo-constants";

/** Values that mean "not configured yet" in .env.example and app.json. */
const MARCATORI_PLACEHOLDER = ["PLACEHOLDER", "xxxxxxxx"];

/** Every configuration value the app reads, and where each one comes from. */
export type ChiaveConfig =
  | "supabaseUrl"
  | "supabaseAnonKey"
  | "googleClientId"
  | "googleIosClientId"
  | "googleAndroidClientId"
  | "sentryDsn";

/**
 * Env var for each key, read lazily but always by its literal name so the
 * build-time substitution can see it. The `extra` key in app.json is the
 * property name itself.
 */
const DA_ENV: Record<ChiaveConfig, () => string | undefined> = {
  supabaseUrl: () => process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: () => process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  googleClientId: () => process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  googleIosClientId: () => process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  googleAndroidClientId: () => process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  sentryDsn: () => process.env.EXPO_PUBLIC_SENTRY_DSN,
};

/** Name of the env var behind a key, for messages that tell the dev what to set. */
export const NOME_ENV: Record<ChiaveConfig, string> = {
  supabaseUrl: "EXPO_PUBLIC_SUPABASE_URL",
  supabaseAnonKey: "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  googleClientId: "EXPO_PUBLIC_GOOGLE_CLIENT_ID",
  googleIosClientId: "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
  googleAndroidClientId: "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID",
  sentryDsn: "EXPO_PUBLIC_SENTRY_DSN",
};

/** Raw value from env or app.json → extra. Empty string when neither is set. */
export function readConfigValue(chiave: ChiaveConfig): string {
  const fromEnv = DA_ENV[chiave]();
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  return fromEnv ?? extra?.[chiave] ?? "";
}

/** True when the value is missing or still one of the example placeholders. */
export function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;
  return MARCATORI_PLACEHOLDER.some((marcatore) => value.includes(marcatore));
}

/** Value only when it is actually configured; null for missing/placeholder. */
export function readValidConfig(chiave: ChiaveConfig): string | null {
  const value = readConfigValue(chiave);
  return isPlaceholder(value) ? null : value;
}
