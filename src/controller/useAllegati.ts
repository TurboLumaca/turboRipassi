/**
 * Controller — selezione e gestione allegati (fotocamera, galleria, file/PDF).
 * Media tra i picker Expo, il Model (allegatiRepo) e la View del form.
 */
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  deleteAllegato,
  renameAllegato,
  reorderAllegati,
  uploadAllegato,
} from "@/model/allegatiRepo";
import type { Allegato } from "@/model/types";

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
      onChange?.();
    },
    [onChange]
  );

  return {
    busy,
    scattaFoto,
    scegliDallaGalleria,
    scegliFile,
    rinomina,
    riordina,
    elimina,
  };
}
