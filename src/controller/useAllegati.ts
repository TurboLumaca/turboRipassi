/**
 * Controller — attachment selection, management and opening (camera, gallery, file/PDF).
 * Mediates between the Expo pickers, the Model (allegatiRepo/localCache) and
 * the View. Opening prefers the local cache file (offline, spec section 7);
 * local files NEVER go through WebBrowser (which only accepts http/https).
 *
 * Picking is separate from uploading: while a ripasso is being created it has
 * no id yet, so the View buffers the picked files and uploads them as a batch
 * once the row exists (spec section 9.2).
 */
import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import * as FileSystem from "expo-file-system/legacy";
import {
  deleteAllegato,
  materializzaTemporaneo,
  renameAllegato,
  reorderAllegati,
  uploadAllegato,
} from "@/model/allegatiRepo";
import { getLocalUri, rimuoviDaCache } from "@/model/localCache";
import { driveTokenManager } from "@/config/driveAuth";
import { dettaglioTecnico, traduciErrore } from "@/model/errorMessages";
import { conRetry } from "@/model/retry";
import { reportError } from "@/config/crashReporting";
import type { Allegato } from "@/model/types";

/** Outcome of apri(): the View displays images in-app, everything else is already handled. */
export type ApriEsito = { tipo: "immagine"; uri: string } | { tipo: "esterno" };

/** A file chosen by the user, not yet uploaded anywhere. */
export interface FilePicked {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
}

/**
 * Alert for a failed operation. Unclassifiable errors also carry the original
 * text: an attachment can fail in Drive, in Postgres or on the filesystem, and
 * "Operazione non riuscita" alone gives the user nothing to report.
 */
function segnalaErrore(e: unknown, operazione: string, contesto?: Record<string, unknown>) {
  reportError(e, { operazione, ...contesto });
  const { titolo, messaggio, categoria } = traduciErrore(e);
  const dettaglio = categoria === "sconosciuto" ? dettaglioTecnico(e) : null;
  Alert.alert(titolo, dettaglio ? `${messaggio}\n\nDettagli: ${dettaglio}` : messaggio);
}

/**
 * Makes sure the app can actually write to the user's Drive, asking for
 * authorization when it can't.
 *
 * Checks for a usable access token rather than isAuthorized(): stored tokens
 * whose refresh Google has revoked still count as authorized but yield no
 * access token, so every upload failed deep inside the Drive client with an
 * error the user had no way to act on.
 *
 * Tokens are deliberately not cleared on failure — a refresh also comes back
 * empty when the device is offline, and discarding a good refresh token over
 * a dropped connection would force a pointless re-authorization.
 */
async function assicuraAccessoDrive(): Promise<boolean> {
  if (await driveTokenManager.getValidAccessToken()) return true;
  if (await driveTokenManager.authorize()) return true;
  Alert.alert(
    "Accesso a Google Drive",
    "Per salvare gli allegati serve autorizzare l'accesso al tuo Google Drive. Se l'avevi già fatto, controlla la connessione e riprova."
  );
  return false;
}

/** Camera capture. Returns null if the user cancels or denies the permission. */
export async function scegliDaFotocamera(): Promise<FilePicked | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permesso negato", "Serve l'accesso alla fotocamera.");
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ quality: 1 });
  if (res.canceled) return null;
  const a = res.assets[0];
  return {
    uri: a.uri,
    name: a.fileName ?? `foto-${Date.now()}.jpg`,
    mimeType: a.mimeType ?? "image/jpeg",
    size: a.fileSize ?? null,
  };
}

/** Gallery picker. Returns null if the user cancels or denies the permission. */
export async function scegliDaGalleria(): Promise<FilePicked | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permesso negato", "Serve l'accesso alla galleria.");
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
  if (res.canceled) return null;
  const a = res.assets[0];
  return {
    uri: a.uri,
    name: a.fileName ?? `immagine-${Date.now()}.jpg`,
    mimeType: a.mimeType ?? "image/jpeg",
    size: a.fileSize ?? null,
  };
}

/** Document picker (PDF and images). Returns null if the user cancels. */
export async function scegliDocumento(): Promise<FilePicked | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? null, size: a.size ?? null };
}

/**
 * Opens a local file that is already on the device. Images are handed back to
 * the View (shown in-app); PDF and everything else go to the system viewer —
 * an intent on Android, the share sheet / Quick Look on iOS.
 */
export async function apriUriLocale(uri: string, mimeType: string | null): Promise<ApriEsito> {
  if ((mimeType ?? "").startsWith("image/")) return { tipo: "immagine", uri };

  try {
    if (Platform.OS === "android") {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: mimeType ?? undefined,
      });
    } else {
      await Sharing.shareAsync(uri, {
        mimeType: mimeType ?? undefined,
        UTI: mimeType === "application/pdf" ? "com.adobe.pdf" : undefined,
      });
    }
  } catch {
    Alert.alert("Impossibile aprire il file", "Nessuna app disponibile per questo tipo di file.");
  }
  return { tipo: "esterno" };
}

export function useAllegati(ripassoId: string | null, onChange?: () => void) {
  const [busy, setBusy] = useState(false);

  /**
   * Uploads a batch to a ripasso that already exists, preserving the given
   * order. Returns the files that failed, so the caller can keep them and let
   * the user retry instead of losing what they picked.
   */
  const caricaSuRipasso = useCallback(
    async (id: string, files: FilePicked[], primoIndice = 0): Promise<FilePicked[]> => {
      if (files.length === 0) return [];
      if (!(await assicuraAccessoDrive())) return files;

      setBusy(true);
      const falliti: FilePicked[] = [];
      try {
        for (const [i, file] of files.entries()) {
          try {
            // Deliberately NOT retried: uploadAllegato creates a new Drive
            // file and inserts a new row, so it is not idempotent. A lost
            // reply after a successful upload would leave a duplicate file
            // and row — worse than asking the user to tap again.
            await uploadAllegato({
              ripassoId: id,
              localUri: file.uri,
              originalFileName: file.name,
              mimeType: file.mimeType,
              sizeBytes: file.size,
              orderIndex: primoIndice + i,
            });
          } catch (e) {
            falliti.push(file);
            segnalaErrore(e, "uploadAllegato", { ripassoId: id, file: file.name });
          }
        }
      } finally {
        setBusy(false);
      }
      onChange?.();
      return falliti;
    },
    [onChange]
  );

  /** Picks a file and uploads it straight away (edit mode: the id exists). */
  const aggiungi = useCallback(
    async (scegli: () => Promise<FilePicked | null>, orderIndex: number) => {
      if (!ripassoId) {
        Alert.alert("Salva prima il ripasso", "Aggiungi allegati dopo aver creato il ripasso.");
        return;
      }
      const file = await scegli();
      if (!file) return;
      await caricaSuRipasso(ripassoId, [file], orderIndex);
    },
    [ripassoId, caricaSuRipasso]
  );

  const scattaFoto = useCallback(
    (orderIndex: number) => aggiungi(scegliDaFotocamera, orderIndex),
    [aggiungi]
  );

  const scegliDallaGalleria = useCallback(
    (orderIndex: number) => aggiungi(scegliDaGalleria, orderIndex),
    [aggiungi]
  );

  const scegliFile = useCallback(
    (orderIndex: number) => aggiungi(scegliDocumento, orderIndex),
    [aggiungi]
  );

  /**
   * Runs an idempotent attachment operation: retries transient failures and
   * turns anything that still fails into a translated alert. Without this
   * these actions were fire-and-forget from the View, so a failure surfaced
   * only as an unhandled rejection and the UI silently kept the stale state.
   */
  const eseguiIdempotente = useCallback(
    async (operazione: string, azione: () => Promise<void>) => {
      try {
        await conRetry(azione);
        onChange?.();
      } catch (e) {
        segnalaErrore(e, operazione);
      }
    },
    [onChange]
  );

  const rinomina = useCallback(
    (id: string, nome: string) =>
      eseguiIdempotente("renameAllegato", () => renameAllegato(id, nome)),
    [eseguiIdempotente]
  );

  const riordina = useCallback(
    (idsInOrdine: string[]) =>
      eseguiIdempotente("reorderAllegati", () => reorderAllegati(idsInOrdine)),
    [eseguiIdempotente]
  );

  const elimina = useCallback(
    (allegato: Allegato) =>
      eseguiIdempotente("deleteAllegato", async () => {
        await deleteAllegato(allegato);
        await rimuoviDaCache(allegato.id);
      }),
    [eseguiIdempotente]
  );

  /**
   * Uri to display an attachment: local cache if present, otherwise
   * downloads from Drive into a temp file. Always returns a local `file://`
   * (Drive files under the `drive.file` scope are private, no public URL).
   */
  const risolviUri = useCallback(async (a: Allegato): Promise<string> => {
    const locale = await getLocalUri(a.id);
    if (locale) {
      const info = await FileSystem.getInfoAsync(locale);
      if (info.exists) return locale;
    }
    // A download is idempotent: safe to retry on a flaky connection.
    return conRetry(() => materializzaTemporaneo(a));
  }, []);

  /** Opens a stored attachment, fetching it from Drive if it isn't cached. */
  const apri = useCallback(
    async (a: Allegato): Promise<ApriEsito> => apriUriLocale(await risolviUri(a), a.mime_type),
    [risolviUri]
  );

  return {
    busy,
    caricaSuRipasso,
    scattaFoto,
    scegliDallaGalleria,
    scegliFile,
    rinomina,
    riordina,
    elimina,
    apri,
    risolviUri,
  };
}
