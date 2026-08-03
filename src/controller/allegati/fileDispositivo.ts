/**
 * Controller — picking and opening files on the device.
 *
 * Stateless wrappers around the Expo native modules: no React state, so they
 * live beside the hook rather than inside it. Keeping them separate is what
 * lets a screen offer "add a photo" without also pulling in the upload state
 * machine, and it confines the native SDK imports to one file.
 *
 * Local files NEVER go through WebBrowser (which only accepts http/https):
 * images come back to the View, everything else goes to the system viewer.
 */
import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import * as FileSystem from "expo-file-system/legacy";
import { isImmagine } from "@/model/shared/fileUtils";

/** A file chosen by the user, not yet uploaded anywhere. */
export interface FileScelto {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
}

/** Outcome of opening: the View displays images in-app, the rest is already handled. */
export type ApriEsito = { tipo: "immagine"; uri: string } | { tipo: "esterno" };

/** The two image sources differ only in these four values. */
const SORGENTI_IMMAGINE = {
  fotocamera: {
    chiediPermesso: () => ImagePicker.requestCameraPermissionsAsync(),
    apri: () => ImagePicker.launchCameraAsync({ quality: 1 }),
    permessoNegato: "Serve l'accesso alla fotocamera.",
    prefissoNome: "foto",
  },
  galleria: {
    chiediPermesso: () => ImagePicker.requestMediaLibraryPermissionsAsync(),
    apri: () => ImagePicker.launchImageLibraryAsync({ quality: 1 }),
    permessoNegato: "Serve l'accesso alla galleria.",
    prefissoNome: "immagine",
  },
} as const;

type SorgenteImmagine = keyof typeof SORGENTI_IMMAGINE;

/**
 * Asks for the permission, opens the picker and normalizes the asset.
 * Returns null when the user cancels or denies the permission — both are
 * ordinary outcomes, not errors.
 */
async function scegliImmagine(sorgente: SorgenteImmagine): Promise<FileScelto | null> {
  const { chiediPermesso, apri, permessoNegato, prefissoNome } = SORGENTI_IMMAGINE[sorgente];

  const permesso = await chiediPermesso();
  if (!permesso.granted) {
    Alert.alert("Permesso negato", permessoNegato);
    return null;
  }

  const esito = await apri();
  if (esito.canceled) return null;

  const asset = esito.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? `${prefissoNome}-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
    size: asset.fileSize ?? null,
  };
}

/** Camera capture. Null if the user cancels or denies the permission. */
export function scegliDaFotocamera(): Promise<FileScelto | null> {
  return scegliImmagine("fotocamera");
}

/** Gallery picker. Null if the user cancels or denies the permission. */
export function scegliDaGalleria(): Promise<FileScelto | null> {
  return scegliImmagine("galleria");
}

/** Document picker (PDF and images). Null if the user cancels. */
export async function scegliDocumento(): Promise<FileScelto | null> {
  const esito = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
  });
  if (esito.canceled) return null;

  const asset = esito.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? null,
    size: asset.size ?? null,
  };
}

/**
 * Opens a local file that is already on the device. Images are handed back to
 * the View (shown in-app); PDF and everything else go to the system viewer —
 * an intent on Android, the share sheet / Quick Look on iOS.
 */
export async function apriUriLocale(uri: string, mimeType: string | null): Promise<ApriEsito> {
  if (isImmagine(mimeType)) return { tipo: "immagine", uri };

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
