/**
 * Controller — attachment selection, management and opening (camera, gallery, file/PDF).
 * Mediates between the Expo pickers, the Model (allegatiRepo/localCache) and
 * the View. Opening prefers the local cache file (offline, spec section 7);
 * local files NEVER go through WebBrowser (which only accepts http/https).
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
import { traduciErrore } from "@/model/errorMessages";
import { conRetry } from "@/model/retry";
import { reportError } from "@/config/crashReporting";
import type { Allegato } from "@/model/types";

/** Outcome of apri(): the View displays images in-app, everything else is already handled. */
export type ApriEsito = { tipo: "immagine"; uri: string } | { tipo: "esterno" };

interface FilePicked {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
}

export function useAllegati(ripassoId: string | null, onChange?: () => void) {
  const [busy, setBusy] = useState(false);

  const carica = useCallback(
    async (file: FilePicked, orderIndex: number) => {
      if (!ripassoId) {
        Alert.alert("Salva prima il ripasso", "Aggiungi allegati dopo aver creato il ripasso.");
        return;
      }
      // Attachments live on the user's Google Drive: authorization is required.
      if (!(await driveTokenManager.isAuthorized())) {
        const ok = await driveTokenManager.authorize();
        if (!ok) {
          Alert.alert(
            "Accesso a Google Drive",
            "Per salvare gli allegati serve autorizzare l'accesso al tuo Google Drive."
          );
          return;
        }
      }
      setBusy(true);
      try {
        // Deliberately NOT retried: uploadAllegato creates a new Drive file
        // (unique name from Date.now()) and inserts a new row, so it is not
        // idempotent. A lost reply after a successful upload would leave a
        // duplicate file and row — worse than asking the user to tap again.
        await uploadAllegato({
          ripassoId,
          localUri: file.uri,
          originalFileName: file.name,
          mimeType: file.mimeType,
          sizeBytes: file.size,
          orderIndex,
        });
        onChange?.();
      } catch (e) {
        reportError(e, { operazione: "uploadAllegato", ripassoId });
        const { titolo, messaggio } = traduciErrore(e);
        Alert.alert(titolo, messaggio);
      } finally {
        setBusy(false);
      }
    },
    [ripassoId, onChange]
  );

  const scattaFoto = useCallback(
    async (orderIndex: number) => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permesso negato", "Serve l'accesso alla fotocamera.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 1 });
      if (res.canceled) return;
      const a = res.assets[0];
      await carica(
        { uri: a.uri, name: a.fileName ?? `foto-${Date.now()}.jpg`, mimeType: a.mimeType ?? "image/jpeg", size: a.fileSize ?? null },
        orderIndex
      );
    },
    [carica]
  );

  const scegliDallaGalleria = useCallback(
    async (orderIndex: number) => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permesso negato", "Serve l'accesso alla galleria.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
      if (res.canceled) return;
      const a = res.assets[0];
      await carica(
        { uri: a.uri, name: a.fileName ?? `immagine-${Date.now()}.jpg`, mimeType: a.mimeType ?? "image/jpeg", size: a.fileSize ?? null },
        orderIndex
      );
    },
    [carica]
  );

  const scegliFile = useCallback(
    async (orderIndex: number) => {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const a = res.assets[0];
      await carica(
        { uri: a.uri, name: a.name, mimeType: a.mimeType ?? null, size: a.size ?? null },
        orderIndex
      );
    },
    [carica]
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
        reportError(e, { operazione });
        const { titolo, messaggio } = traduciErrore(e);
        Alert.alert(titolo, messaggio);
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

  /**
   * Opens an attachment. Images: the View shows them in-app. PDF/other:
   * system viewer (intent on Android, share sheet/Quick Look on iOS) on the
   * local file (from cache or downloaded on the fly from Drive).
   */
  const apri = useCallback(
    async (a: Allegato): Promise<ApriEsito> => {
      const uri = await risolviUri(a); // always a local file://
      if ((a.mime_type ?? "").startsWith("image/")) return { tipo: "immagine", uri };

      try {
        if (Platform.OS === "android") {
          const contentUri = await FileSystem.getContentUriAsync(uri);
          await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
            data: contentUri,
            flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
            type: a.mime_type ?? undefined,
          });
        } else {
          await Sharing.shareAsync(uri, {
            mimeType: a.mime_type ?? undefined,
            UTI: a.mime_type === "application/pdf" ? "com.adobe.pdf" : undefined,
          });
        }
      } catch {
        Alert.alert("Impossibile aprire il file", "Nessuna app disponibile per questo tipo di file.");
      }
      return { tipo: "esterno" };
    },
    [risolviUri]
  );

  return {
    busy,
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
