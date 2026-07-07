/**
 * Model layer — allegati: upload su Storage, righe DB, download, riordino, rename.
 * Convenzione path Storage (coerente con la policy RLS): <user_id>/<ripasso_id>/<file>.
 */
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { ALLEGATI_BUCKET, supabase } from "@/config/supabase";
import { decodeBase64, estensione } from "./fileUtils";
import type { Allegato } from "./types";

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Utente non autenticato.");
  return data.user.id;
}

function randomId(): string {
  // UUID v4 semplice, sufficiente per nomi file univoci.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Comprime un'immagine prima dell'upload (mitigazione tetto storage, sezione 3).
 * Ridimensiona a max 1600px lato lungo e riesporta in JPEG 70%.
 * Ritorna un nuovo uri locale; per i non-immagine ritorna l'uri originale.
 */
export async function comprimiSeImmagine(
  uri: string,
  mime: string | null
): Promise<{ uri: string; mime: string | null }> {
  if (!mime || !mime.startsWith("image/")) return { uri, mime };
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return { uri: result.uri, mime: "image/jpeg" };
  } catch {
    // In caso di errore (es. PDF passato per sbaglio) usa l'originale.
    return { uri, mime };
  }
}

/**
 * Carica un file su Storage e crea la riga in `allegati`.
 * `localUri` è un file già sul dispositivo (fotocamera/galleria/document picker).
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
  const storage_path = `${user_id}/${input.ripassoId}/${randomId()}${ext}`;

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = decodeBase64(base64);

  const { error: upErr } = await supabase.storage
    .from(ALLEGATI_BUCKET)
    .upload(storage_path, bytes, {
      contentType: mime ?? "application/octet-stream",
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("allegati")
    .insert({
      ripasso_id: input.ripassoId,
      user_id,
      display_name: input.originalFileName,
      original_file_name: input.originalFileName,
      storage_path,
      order_index: input.orderIndex,
      mime_type: mime,
      size_bytes: input.sizeBytes,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Allegato;
}

export async function renameAllegato(id: string, display_name: string): Promise<void> {
  const { error } = await supabase.from("allegati").update({ display_name }).eq("id", id);
  if (error) throw error;
}

/** Persiste un nuovo ordinamento: applica order_index secondo l'array di id. */
export async function reorderAllegati(idsInOrdine: string[]): Promise<void> {
  const results = await Promise.all(
    idsInOrdine.map((id, index) =>
      supabase.from("allegati").update({ order_index: index }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

/** Elimina la riga e il file remoto su Storage. */
export async function deleteAllegato(allegato: Allegato): Promise<void> {
  const { error } = await supabase.from("allegati").delete().eq("id", allegato.id);
  if (error) throw error;
  await supabase.storage.from(ALLEGATI_BUCKET).remove([allegato.storage_path]);
}

/** URL firmato temporaneo per visualizzare/scaricare un allegato. */
export async function getSignedUrl(storage_path: string, seconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ALLEGATI_BUCKET)
    .createSignedUrl(storage_path, seconds);
  if (error) throw error;
  return data.signedUrl;
}

/** Scarica un allegato nel filesystem locale, restituendo l'uri locale. */
export async function downloadAllegato(
  storage_path: string,
  destUri: string
): Promise<string> {
  const url = await getSignedUrl(storage_path);
  const { uri } = await FileSystem.downloadAsync(url, destUri);
  return uri;
}

