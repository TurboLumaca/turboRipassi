/**
 * Model layer — centralized, typed Supabase client.
 * Single instantiation point. No View imports it directly (section 4 rule):
 * access always goes through a repo/hook.
 */
import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { secureAuthStorage } from "./secureAuthStorage";

function readConfig(key: "supabaseUrl" | "supabaseAnonKey", envName: string): string {
  // Priority 1: EXPO_PUBLIC_ env vars (.env file). Priority 2: app.json → extra.
  const fromEnv = process.env[envName];
  const fromExtra = (Constants.expoConfig?.extra as Record<string, string> | undefined)?.[key];
  const value = fromEnv ?? fromExtra;
  if (!value || value.includes("PLACEHOLDER") || value.includes("xxxxxxxx")) {
    console.warn(
      `[supabase] Missing config: ${envName}. Copy .env.example to .env and fill in your Supabase project values.`
    );
    return value ?? "";
  }
  return value;
}

export const SUPABASE_URL = readConfig("supabaseUrl", "EXPO_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = readConfig("supabaseAnonKey", "EXPO_PUBLIC_SUPABASE_ANON_KEY");

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // SecureStore (Keychain/Keystore) instead of AsyncStorage: the session
    // (JWT + refresh token) stays encrypted at rest, not in plaintext on disk.
    storage: secureAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE instead of the implicit flow: the exchange code travels in the
    // redirect's query string (not the fragment) and requires a code_verifier
    // known only to the client, so an intercepted redirect alone isn't enough
    // to obtain a session (see useAuth.signInWithGoogle).
    flowType: "pkce",
  },
});

// Pattern recommended by Supabase for React Native: the token refresh timer
// doesn't run in the background, so it must be restarted when the app becomes
// active again. Without this, after a long pause the session appears expired
// and forces a re-login.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
