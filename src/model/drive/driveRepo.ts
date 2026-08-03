/**
 * Model layer — Google Drive REST client (implements DriveClient).
 *
 * All files are created inside the "ripassiProgrammati" folder in the
 * user's own Drive. With the `drive.file` scope the app only sees files it
 * has created itself, so the queries below stay naturally scoped.
 *
 * Two-step upload (metadata, then media) to avoid loading the whole file
 * into memory as base64: the binary travels via FileSystem.uploadAsync.
 */
import * as FileSystem from "expo-file-system/legacy";
import { driveTokenManager } from "./driveAuth";
import { DRIVE_APP_FOLDER } from "@/config/driveConfig";
import {
  DriveNotAuthorizedError,
  type DriveAccount,
  type DriveClient,
  type DriveFileRef,
  type DriveUploadInput,
} from "./driveTypes";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

// In-memory cache of the folder ID: avoids a query on every upload.
let folderIdCache: string | null = null;

async function authHeader(): Promise<Record<string, string>> {
  const token = await driveTokenManager.getValidAccessToken();
  if (!token) throw new DriveNotAuthorizedError();
  return { Authorization: `Bearer ${token}` };
}

async function apiJson<T>(url: string, init: RequestInit): Promise<T> {
  const headers = { ...(await authHeader()), ...(init.headers ?? {}) };
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive API ${res.status}: ${body || res.statusText}`);
  }
  return (await res.json()) as T;
}

export const driveClient: DriveClient = {
  async ensureAppFolder(): Promise<string> {
    if (folderIdCache) return folderIdCache;

    // 1. Look for an existing folder with that name created by the app.
    const q = encodeURIComponent(
      `name='${DRIVE_APP_FOLDER}' and mimeType='${FOLDER_MIME}' and trashed=false`
    );
    const found = await apiJson<{ files: { id: string }[] }>(
      `${DRIVE_API}/files?q=${q}&spaces=drive&fields=files(id)`,
      { method: "GET" }
    );
    if (found.files.length > 0) {
      folderIdCache = found.files[0].id;
      return folderIdCache;
    }

    // 2. Doesn't exist: create it.
    const created = await apiJson<{ id: string }>(`${DRIVE_API}/files?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: DRIVE_APP_FOLDER, mimeType: FOLDER_MIME }),
    });
    folderIdCache = created.id;
    return folderIdCache;
  },

  /**
   * Which account the attachments are going to. `about.get` is reachable with
   * the `drive.file` scope alone, so this needs no extra consent — asking for
   * userinfo/email just to show the address would widen what the app can read.
   */
  async account(): Promise<DriveAccount> {
    const cartellaId = await this.ensureAppFolder();
    const info = await apiJson<{ user?: { emailAddress?: string; displayName?: string } }>(
      `${DRIVE_API}/about?fields=user(emailAddress,displayName)`,
      { method: "GET" }
    );
    return {
      email: info.user?.emailAddress ?? null,
      nome: info.user?.displayName ?? null,
      cartella: DRIVE_APP_FOLDER,
      cartellaId,
    };
  },

  async uploadFile(input: DriveUploadInput): Promise<DriveFileRef> {
    const parentId = await this.ensureAppFolder();
    const mimeType = input.mimeType ?? "application/octet-stream";

    // Step 1 — create the metadata (an empty file inside the folder).
    const meta = await apiJson<{ id: string; name: string }>(
      `${DRIVE_API}/files?fields=id,name`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: input.name, parents: [parentId], mimeType }),
      }
    );

    // Step 2 — upload the binary content (uploadType=media).
    const header = await authHeader();
    const uploadRes = await FileSystem.uploadAsync(
      `${DRIVE_UPLOAD}/files/${meta.id}?uploadType=media`,
      input.localUri,
      {
        httpMethod: "PATCH",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { ...header, "Content-Type": mimeType },
      }
    );
    if (uploadRes.status < 200 || uploadRes.status >= 300) {
      // Rollback: delete the "empty" file just created to avoid orphans.
      await this.deleteFile(meta.id).catch(() => undefined);
      throw new Error(`Drive upload ${uploadRes.status}: ${uploadRes.body}`);
    }

    return { id: meta.id, name: meta.name, mimeType };
  },

  async downloadFile(fileId: string, destUri: string): Promise<string> {
    const header = await authHeader();
    const { uri } = await FileSystem.downloadAsync(
      `${DRIVE_API}/files/${fileId}?alt=media`,
      destUri,
      { headers: header }
    );
    return uri;
  },

  async deleteFile(fileId: string): Promise<void> {
    const headers = await authHeader();
    const res = await fetch(`${DRIVE_API}/files/${fileId}`, { method: "DELETE", headers });
    // 404 = already gone: treat as success (idempotency).
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => "");
      throw new Error(`Drive delete ${res.status}: ${body || res.statusText}`);
    }
  },
};

/** Resets the folder ID cache (e.g. on logout / account switch). */
export function resetDriveFolderCache(): void {
  folderIdCache = null;
}
