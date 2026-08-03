/**
 * Model layer — attachments: binary files on Google Drive, metadata on Postgres.
 *
 * The binary (photo/PDF) lives in the "ripassiProgrammati" folder of the
 * user's own Drive; the row in `allegati` (Supabase) holds the metadata and,
 * in the `storage_path` field, the Drive file ID.
 *
 * The local cache (yesterday/today/tomorrow) does not go through this module:
 * it takes a downloader of its own, so copying bytes to disk needs no
 * Supabase session. See localCache.ScaricaAllegato.
 */
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "@/config/supabase";
import { driveClient } from "@/model/drive/driveRepo";
import { currentUserId } from "@/model/shared/currentUser";
import { estensione, isImmagine } from "@/model/shared/fileUtils";
import type { Allegato } from "../types";

/**
 * Compresses an image before upload (storage usage mitigation).
 * Resizes to max 1600px on the long side and re-exports as JPEG 70%.
 * Returns a new local uri; for non-images returns the original uri.
 */
export async function comprimiSeImmagine(
  uri: string,
  mime: string | null
): Promise<{ uri: string; mime: string | null }> {
  if (!isImmagine(mime)) return { uri, mime };
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return { uri: result.uri, mime: "image/jpeg" };
  } catch {
    // On error (e.g. a PDF passed by mistake) fall back to the original.
    return { uri, mime };
  }
}

/**
 * Uploads a file to Google Drive and creates the row in `allegati`.
 * `localUri` is a file already on the device (camera/gallery/document picker).
 * If the metadata insert fails, the file on Drive is removed to avoid
 * leaving orphans.
 */
export async function uploadAllegato(input: {
  ripassoId: string;
  localUri: string;
  originalFileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  orderIndex: number;
}): Promise<Allegato> {
  const user_id = await currentUserId();

  const { uri, mime } = await comprimiSeImmagine(input.localUri, input.mimeType);
  const ext = estensione(input.originalFileName, mime);
  // Readable name on Drive; uniqueness is guaranteed by the ID Drive assigns.
  const driveName = `${input.ripassoId}-${Date.now()}${ext}`;

  const fileRef = await driveClient.uploadFile({
    localUri: uri,
    name: driveName,
    mimeType: mime,
  });

  const { data, error } = await supabase
    .from("allegati")
    .insert({
      ripasso_id: input.ripassoId,
      user_id,
      display_name: input.originalFileName,
      original_file_name: input.originalFileName,
      storage_path: fileRef.id, // Drive file ID
      order_index: input.orderIndex,
      mime_type: mime,
      size_bytes: input.sizeBytes,
    })
    .select()
    .single();

  if (error) {
    // Roll back the binary on Drive: avoid a file with no metadata row.
    await driveClient.deleteFile(fileRef.id).catch(() => undefined);
    throw error;
  }
  return data as Allegato;
}

export async function renameAllegato(id: string, display_name: string): Promise<void> {
  const { error } = await supabase.from("allegati").update({ display_name }).eq("id", id);
  if (error) throw error;
}

/** Persists a new ordering: applies order_index following the id array. */
export async function reorderAllegati(idsInOrdine: string[]): Promise<void> {
  const results = await Promise.all(
    idsInOrdine.map((id, index) =>
      supabase.from("allegati").update({ order_index: index }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

/** Deletes the row (Postgres) and the remote file (Drive). */
export async function deleteAllegato(allegato: Allegato): Promise<void> {
  const { error } = await supabase.from("allegati").delete().eq("id", allegato.id);
  if (error) throw error;
  await driveClient.deleteFile(allegato.storage_path).catch(() => undefined);
}

/**
 * Downloads an attachment to a TEMPORARY local file (system cache) for
 * display only, when it isn't already in the "window" cache. Replaces the
 * old signed URL: with the `drive.file` scope, files on Drive are private
 * and not reachable via a public URL, so they must be materialized locally.
 */
export async function materializzaTemporaneo(allegato: Allegato): Promise<string> {
  const ext = estensione(allegato.original_file_name, allegato.mime_type);
  const dest = `${FileSystem.cacheDirectory}tmp-${allegato.id}${ext}`;
  return driveClient.downloadFile(allegato.storage_path, dest);
}
