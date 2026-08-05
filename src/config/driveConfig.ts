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
import { isPlaceholder, readConfigValue } from "./env";

/**
 * Per-platform client ID, with the generic one as fallback.
 *
 * On Google Cloud a client has a *type* fixed at creation (Web / Android /
 * iOS) and the three behave differently: the Android one is bound to package
 * name + SHA-1 and the `<applicationId>:/oauthredirect` scheme, the iOS one to
 * the bundle identifier, the Web one to registered HTTPS redirects. One id
 * therefore cannot be valid as all three.
 *
 * Today only the generic client exists, so both platforms fall through to it
 * and this selection has no effect yet: app.json used to carry the same value
 * copied into all three keys, which asserted a distinction that was not there.
 * The two per-platform keys are read as soon as they are set — the procedure
 * for creating those clients is in BUILD.md, and the release SHA-1 it depends
 * on is the open risk documented in the relazione.
 */
export const GOOGLE_CLIENT_ID: string = (() => {
  const generico = readConfigValue("googleClientId");
  if (Platform.OS === "ios") return readConfigValue("googleIosClientId") || generico;
  if (Platform.OS === "android") return readConfigValue("googleAndroidClientId") || generico;
  return generico;
})();

/** Required OAuth scopes: access only to files created by the app. */
export const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"];

/** Name of the dedicated folder in the user's Drive. */
export const DRIVE_APP_FOLDER = "ripassiProgrammati";

/** True if the Google configuration is present (for clear error messages). */
export function isDriveConfigured(): boolean {
  return !isPlaceholder(GOOGLE_CLIENT_ID);
}
