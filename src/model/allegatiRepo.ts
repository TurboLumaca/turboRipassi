/**
 * Model layer — allegati: upload su Storage, righe DB, download, riordino, rename.
 * Convenzione path Storage (coerente con la policy RLS): <user_id>/<ripasso_id>/<file>.
 */
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { ALLEGATI_BUCKET, supabase } from "@/config/supabase";
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

function estensione(name: string, mime?: string | null): string {
  const dot = name.lastIndexOf(".");
  if (dot !== -1 && dot < name.length - 1) return name.slice(dot);
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  return "";
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
  await Promise.all(
    idsInOrdine.map((id, index) =>
      supabase.from("allegati").update({ order_index: index }).eq("id", id)
    )
  );
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

// --- utilità: base64 -> Uint8Array (senza dipendenze native) ---
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeBase64(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const bytes: number[] = [];
  for (let i = 0; i < len; i += 4) {
    const e1 = B64.indexOf(clean[i]);
    const e2 = B64.indexOf(clean[i + 1]);
    const e3 = B64.indexOf(clean[i + 2]);
    const e4 = B64.indexOf(clean[i + 3]);
    const c1 = (e1 << 2) | (e2 >> 4);
    bytes.push(c1);
    if (e3 !== -1) {
      const c2 = ((e2 & 15) << 4) | (e3 >> 2);
      bytes.push(c2);
    }
    if (e4 !== -1) {
      const c3 = ((e3 & 3) << 6) | e4;
      bytes.push(c3);
    }
  }
  return new Uint8Array(bytes);
}
