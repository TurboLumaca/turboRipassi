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
import {
  estensione,
  isImmagine,
  SOTTOCARTELLA_TEMPORANEI,
} from "@/model/shared/fileUtils";
import type { Allegato } from "../types";

/** A file on the device, ready to be uploaded. */
export interface CaricamentoAllegato {
  ripassoId: string;
  localUri: string;
  originalFileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  orderIndex: number;
}

/** Everything the Controller needs from the attachments store. */
export interface AllegatiRepo {
  /** Uploads the binary to Drive and creates the metadata row. */
  carica(input: CaricamentoAllegato): Promise<Allegato>;
  rinomina(id: string, displayName: string): Promise<void>;
  /** Persists a new ordering, atomically, following the id array. */
  riordina(idsInOrdine: string[]): Promise<void>;
  /** Deletes the metadata row and the file on Drive. */
  elimina(allegato: Allegato): Promise<void>;
  /** Downloads to a temporary local file, for display only. */
  materializzaTemporaneo(allegato: Allegato): Promise<string>;
}

/**
 * Compresses an image before upload (storage usage mitigation).
 * Resizes to max 1600px on the long side and re-exports as JPEG 70%.
 * Returns a new local uri; for non-images returns the original uri.
 */
async function comprimiSeImmagine(
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
 * Size in bytes of the file that is actually being uploaded.
 *
 * The picker reports the size of the file the user chose, but images are
 * compressed first, so storing that number overstates the space used by
 * roughly an order of magnitude — on exactly the class of files that dominates
 * the volume, and while storage consumption is the one figure this project has
 * to keep an eye on. Falls back to the declared size when the file system
 * cannot answer.
 */
async function dimensioneCaricata(uri: string, dichiarata: number | null): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && typeof info.size === "number" ? info.size : dichiarata;
  } catch {
    return dichiarata;
  }
}

export const allegatiRepo: AllegatiRepo = {
  /**
   * `localUri` is a file already on the device (camera/gallery/document
   * picker). If the metadata insert fails, the file on Drive is removed to
   * avoid leaving orphans.
   */
  async carica(input: CaricamentoAllegato): Promise<Allegato> {
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
        // Ownership columns omitted on purpose: Postgres fills them from the
        // session (see model/shared/account).
        ripasso_id: input.ripassoId,
        display_name: input.originalFileName,
        original_file_name: input.originalFileName,
        storage_path: fileRef.id, // Drive file ID
        order_index: input.orderIndex,
        mime_type: mime,
        size_bytes: await dimensioneCaricata(uri, input.sizeBytes),
      })
      .select()
      .single();

    if (error) {
      // Roll back the binary on Drive: avoid a file with no metadata row.
      await driveClient.deleteFile(fileRef.id).catch(() => undefined);
      throw error;
    }
    return data as Allegato;
  },

  async rinomina(id: string, displayName: string): Promise<void> {
    const { error } = await supabase
      .from("allegati")
      .update({ display_name: displayName })
      .eq("id", id);
    if (error) throw error;
  },

  /**
   * One transactional call, not one UPDATE per row. The previous version fired
   * N independent updates in parallel: a partial failure left the list with
   * duplicated or missing order_index values and no way back, and reordering
   * by one position cost one round trip per attachment. The database function
   * `riordina_allegati` (supabase/schema.sql) does the whole thing atomically
   * and stays subject to the same RLS policy.
   */
  async riordina(idsInOrdine: string[]): Promise<void> {
    const { error } = await supabase.rpc("riordina_allegati", { ids: idsInOrdine });
    if (error) throw error;
  },

  async elimina(allegato: Allegato): Promise<void> {
    const { error } = await supabase.from("allegati").delete().eq("id", allegato.id);
    if (error) throw error;
    await driveClient.deleteFile(allegato.storage_path).catch(() => undefined);
  },

  /**
   * Downloads an attachment to a TEMPORARY local file (system cache) for
   * display only, when it isn't already in the "window" cache. Replaces the
   * old signed URL: with the `drive.file` scope, files on Drive are private
   * and not reachable via a public URL, so they must be materialized locally.
   */
  async materializzaTemporaneo(allegato: Allegato): Promise<string> {
    const ext = estensione(allegato.original_file_name, allegato.mime_type);
    const dir = `${FileSystem.cacheDirectory}${SOTTOCARTELLA_TEMPORANEI}`;
    // The download fails outright if the folder does not exist yet.
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}${allegato.id}${ext}`;
    return driveClient.downloadFile(allegato.storage_path, dest);
  },
};
