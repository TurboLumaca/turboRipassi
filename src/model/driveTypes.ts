/**
 * Model layer — Google Drive storage backend interfaces.
 *
 * Attachments NO LONGER live on Supabase Storage but in the user's own
 * Drive, inside a dedicated "ripassiProgrammati" folder. The user grants
 * access via OAuth (scope `drive.file`: the app only sees files it created,
 * not the whole Drive). Metadata (title, order, mime, etc.) stays on
 * Postgres in `allegati`; the `storage_path` field now holds the Drive
 * file ID (no longer a bucket path).
 *
 * This file declares ONLY interfaces: implementations live in
 * `config/driveAuth.ts` (token) and `model/driveRepo.ts` (REST calls).
 */

/** Persisted Google OAuth tokens (in SecureStore, never sent to Supabase). */
export interface DriveTokens {
  /** Short-lived (~1h) Google access token. */
  accessToken: string;
  /** Google refresh token (offline access); absent if not granted. */
  refreshToken: string | null;
  /** Access token expiry, epoch ms. */
  expiresAt: number;
  /** Granted scopes, space-separated. */
  scope: string;
}

/** Drive token management: get/refresh/revoke the access token. */
export interface DriveTokenManager {
  /** Valid access token, refreshed via refresh token if expired. Null if not authorized. */
  getValidAccessToken(): Promise<string | null>;
  /** True if the user has already authorized Drive access. */
  isAuthorized(): Promise<boolean>;
  /** Starts the OAuth consent flow. Returns true if authorization succeeded. */
  authorize(): Promise<boolean>;
  /**
   * Finishes an authorization whose redirect arrived as a deep link instead of
   * as the browser result — which is what happens when Android killed the app
   * while the consent page was in front. False when the url carries no code or
   * nothing was pending.
   */
  completaAutorizzazione(url: string): Promise<boolean>;
  /** Deletes the local tokens (logout / access revocation). */
  clear(): Promise<void>;
}

/** Reference to a Drive file after upload. */
export interface DriveFileRef {
  /** Unique Drive file ID → ends up in allegati.storage_path. */
  id: string;
  /** File name on Drive. */
  name: string;
  /** MIME type declared to Drive. */
  mimeType: string | null;
}

/** Input for uploading a local file to Drive. */
export interface DriveUploadInput {
  /** Local file URI (after any compression). */
  localUri: string;
  /** Name to save it under on Drive. */
  name: string;
  /** MIME type; defaults to application/octet-stream. */
  mimeType: string | null;
}

/** Which Google account the attachments are going to, and where. */
export interface DriveAccount {
  /** Address of the authorized Google account. */
  email: string | null;
  /** Display name on the account, when Google returns one. */
  nome: string | null;
  /** Name of the folder the app writes into. */
  cartella: string;
  /** Drive ID of that folder, so it can be opened in a browser. */
  cartellaId: string;
}

/**
 * Drive client: file operations inside the app's dedicated folder.
 * Every method assumes the token manager is already authorized; otherwise
 * it throws `DriveNotAuthorizedError`.
 */
export interface DriveClient {
  /** Creates (or reuses) the "ripassiProgrammati" folder and returns its ID. */
  ensureAppFolder(): Promise<string>;
  /** Authorized account and destination folder, for the account panel. */
  account(): Promise<DriveAccount>;
  /** Uploads a file into the app folder; returns the reference. */
  uploadFile(input: DriveUploadInput): Promise<DriveFileRef>;
  /** Downloads file `fileId` to local path `destUri`; returns the local URI. */
  downloadFile(fileId: string, destUri: string): Promise<string>;
  /** Permanently deletes file `fileId` from Drive. */
  deleteFile(fileId: string): Promise<void>;
}

/** Error thrown when Drive access hasn't been authorized. */
export class DriveNotAuthorizedError extends Error {
  constructor(message = "Accesso a Google Drive non autorizzato.") {
    super(message);
    this.name = "DriveNotAuthorizedError";
  }
}
