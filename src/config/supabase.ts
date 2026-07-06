/**
 * Model layer — client Supabase tipizzato e centralizzato.
 * Unico punto in cui il client viene istanziato. Nessuna View lo importa
 * direttamente (regola sezione 4): l'accesso passa sempre da un repo/hook.
 */
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

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
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const ALLEGATI_BUCKET = "allegati";
