/**
 * Controller — selezione, gestione e apertura allegati (fotocamera, galleria, file/PDF).
 * Media tra i picker Expo, il Model (allegatiRepo/localCache) e la View.
 * L'apertura preferisce il file in cache locale (offline, sezione 7); i file
 * locali non passano MAI da WebBrowser (che accetta solo http/https).
 */
import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import * as FileSystem from "expo-file-system/legacy";
import {
  deleteAllegato,
  getSignedUrl,
  renameAllegato,
  reorderAllegati,
  uploadAllegato,
} from "@/model/allegatiRepo";
import { getLocalUri, rimuoviDaCache } from "@/model/localCache";
import type { Allegato } from "@/model/types";

/** Esito di apri(): le immagini le mostra la View in-app, il resto è già gestito. */
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
      setBusy(true);
      try {
        await uploadAllegato({
          ripassoId,
          localUri: file.uri,
          originalFileName: file.name,
          mimeType: file.mimeType,
          sizeBytes: file.size,
          orderIndex,
        });
        onChange?.();
      } catch (e: any) {
        Alert.alert("Errore upload", e?.message ?? "Impossibile caricare il file.");
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

  const rinomina = useCallback(
    async (id: string, nome: string) => {
      await renameAllegato(id, nome);
      onChange?.();
    },
    [onChange]
  );

  const riordina = useCallback(
    async (idsInOrdine: string[]) => {
      await reorderAllegati(idsInOrdine);
      onChange?.();
    },
    [onChange]
  );

  const elimina = useCallback(
    async (allegato: Allegato) => {
      await deleteAllegato(allegato);
      await rimuoviDaCache(allegato.id);
      onChange?.();
    },
    [onChange]
  );

  /** Uri per visualizzare un allegato: cache locale se presente, altrimenti URL firmato. */
  const risolviUri = useCallback(async (a: Allegato): Promise<string> => {
    const locale = await getLocalUri(a.id);
    if (locale) {
      const info = await FileSystem.getInfoAsync(locale);
      if (info.exists) return locale;
    }
    return getSignedUrl(a.storage_path);
  }, []);

  /**
   * Apre un allegato. Immagini: la View le mostra in-app (funziona con file://
   * e https). PDF/altro in cache: viewer di sistema (intent su Android, share
   * sheet/Quick Look su iOS); se fallisce, fallback all'URL firmato nel browser.
   */
  const apri = useCallback(
    async (a: Allegato): Promise<ApriEsito> => {
      const uri = await risolviUri(a);
      if ((a.mime_type ?? "").startsWith("image/")) return { tipo: "immagine", uri };

      if (uri.startsWith("file://")) {
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
          return { tipo: "esterno" };
        } catch {
          // Nessuna app locale in grado di aprirlo: riprova via URL firmato.
        }
      }

      const url = uri.startsWith("file://") ? await getSignedUrl(a.storage_path) : uri;
      await WebBrowser.openBrowserAsync(url);
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
