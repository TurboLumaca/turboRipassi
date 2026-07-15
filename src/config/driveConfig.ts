/**
 * Config — OAuth parameters for Google Drive access.
 * Client IDs are created in Google Cloud Console (APIs & Services →
 * Credentials → OAuth client ID) and go in the .env file with the
 * EXPO_PUBLIC_ prefix (readable at runtime). See .env.example.
 *
 * Minimal scope: `drive.file` — the app can access ONLY the files it
 * creates, not the user's whole Drive (principle of least privilege).
 */
import { Platform } from "react-native";
import Constants from "expo-constants";

function read(envName: string, extraKey: string): string {
  const fromEnv = process.env[envName];
  const fromExtra = (Constants.expoConfig?.extra as Record<string, string> | undefined)?.[extraKey];
  return fromEnv ?? fromExtra ?? "";
}

/**
 * Per-platform client ID. iOS and Android use distinct native client IDs;
 * as a fallback, a single generic client is used (handy for Web/dev). If
 * the platform-specific value isn't set, falls back to GOOGLE_CLIENT_ID.
 */
export const GOOGLE_CLIENT_ID: string = (() => {
  const generic = read("EXPO_PUBLIC_GOOGLE_CLIENT_ID", "googleClientId");
  if (Platform.OS === "ios") {
    return read("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID", "googleIosClientId") || generic;
  }
  if (Platform.OS === "android") {
    return read("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID", "googleAndroidClientId") || generic;
  }
  return generic;
})();

/** Required OAuth scopes: access only to files created by the app. */
export const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"];

/** Name of the dedicated folder in the user's Drive. */
export const DRIVE_APP_FOLDER = "ripassiProgrammati";

/** True if the Google configuration is present (for clear error messages). */
export function isDriveConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0 && !GOOGLE_CLIENT_ID.includes("PLACEHOLDER");
}
