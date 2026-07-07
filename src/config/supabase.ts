/**
 * Model layer — client Supabase tipizzato e centralizzato.
 * Unico punto in cui il client viene istanziato. Nessuna View lo importa
 * direttamente (regola sezione 4): l'accesso passa sempre da un repo/hook.
 */
import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { secureAuthStorage } from "./secureAuthStorage";

function readConfig(key: "supabaseUrl" | "supabaseAnonKey", envName: string): string {
  // Priorità 1: variabili EXPO_PUBLIC_ (file .env). Priorità 2: app.json → extra.
  const fromEnv = process.env[envName];
  const fromExtra = (Constants.expoConfig?.extra as Record<string, string> | undefined)?.[key];
  const value = fromEnv ?? fromExtra;
  if (!value || value.includes("PLACEHOLDER") || value.includes("xxxxxxxx")) {
    console.warn(
      `[supabase] Config mancante: ${envName}. Copia .env.example in .env e inserisci i valori del progetto Supabase.`
    );
    return value ?? "";
  }
  return value;
}

export const SUPABASE_URL = readConfig("supabaseUrl", "EXPO_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = readConfig("supabaseAnonKey", "EXPO_PUBLIC_SUPABASE_ANON_KEY");

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // SecureStore (Keychain/Keystore) invece di AsyncStorage: la sessione
    // (JWT + refresh token) resta cifrata a riposo, non in chiaro sul filesystem.
    storage: secureAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE invece del flusso implicit: il codice di scambio viaggia nella
    // query string del redirect (non nel frammento) e richiede un code_verifier
    // noto solo al client, quindi un redirect intercettato da solo non basta
    // a ottenere una sessione (vedi useAuth.signInWithGoogle).
    flowType: "pkce",
  },
});

// Pattern raccomandato da Supabase per React Native: il timer di refresh del
// token non gira in background, quindi va riavviato quando l'app torna attiva.
// Senza questo, dopo una lunga pausa la sessione risulta scaduta e costringe
// a rifare il login.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export const ALLEGATI_BUCKET = "allegati";
