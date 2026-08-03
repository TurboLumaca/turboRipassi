/**
 * Controller — attachment state and operations for one ripasso.
 *
 * Mediates between the Model (allegatiRepo / localCache) and the View. Picking
 * and opening files live in fileDispositivo.ts: this file is only about what
 * needs React state or a repo call.
 *
 * Picking is separate from uploading: while a ripasso is being created it has
 * no id yet, so the View buffers the picked files and uploads them as a batch
 * once the row exists (spec section 9.2).
 */
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import {
  deleteAllegato,
  materializzaTemporaneo,
  renameAllegato,
  reorderAllegati,
  uploadAllegato,
} from "@/model/allegati/allegatiRepo";
import { getLocalUri, rimuoviDaCache } from "@/model/cache/localCache";
import { driveTokenManager } from "@/model/drive/driveAuth";
import { conRetry } from "@/model/shared/retry";
import { mostraErrore } from "../avvisoErrore";
import { apriUriLocale, type ApriEsito, type FileScelto } from "./fileDispositivo";
import type { Allegato } from "@/model/types";

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

export function useAllegati(ripassoId: string | null, onChange?: () => void) {
  const [busy, setBusy] = useState(false);

  /**
   * Uploads a batch to a ripasso that already exists, preserving the given
   * order. Returns the files that failed, so the caller can keep them and let
   * the user retry instead of losing what they picked.
   */
  const caricaSuRipasso = useCallback(
    async (id: string, files: FileScelto[], primoIndice = 0): Promise<FileScelto[]> => {
      if (files.length === 0) return [];
      if (!(await assicuraAccessoDrive())) return files;

      setBusy(true);
      const falliti: FileScelto[] = [];
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
            mostraErrore(e, "uploadAllegato", { ripassoId: id, file: file.name });
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
    async (scegli: () => Promise<FileScelto | null>, orderIndex: number) => {
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
        mostraErrore(e, operazione);
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
    aggiungi,
    rinomina,
    riordina,
    elimina,
    apri,
    risolviUri,
  };
}
