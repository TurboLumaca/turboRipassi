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
import { allegatiRepo, type AllegatiRepo } from "@/model/allegati/allegatiRepo";
import { getLocalUri, rimuoviDaCache } from "@/model/cache/localCache";
import { DriveNotAuthorizedError } from "@/model/drive/driveTypes";
import { conRetry } from "@/model/shared/retry";
import { useAuthCtx } from "../AuthContext";
import { mostraErrore } from "../avvisoErrore";
import { apriUriLocale, type ApriEsito, type FileScelto } from "./fileDispositivo";
import type { Allegato } from "@/model/types";

export function useAllegati(
  ripassoId: string | null,
  onChange?: () => void,
  repo: AllegatiRepo = allegatiRepo
) {
  const [busy, setBusy] = useState(false);
  // Drive access is granted once and belongs to the auth Controller, which is
  // the only place that knows whether the app currently holds a token. Asking
  // the token manager from here used to authorize correctly but leave that
  // state stale, so the account panel disagreed with reality.
  const { assicuraAccessoDrive } = useAuthCtx();

  /**
   * Uploads a batch to a ripasso that already exists, preserving the given
   * order. Returns the files that failed, so the caller can keep them and let
   * the user retry instead of losing what they picked.
   */
  const caricaSuRipasso = useCallback(
    async (id: string, files: FileScelto[], primoIndice = 0): Promise<FileScelto[]> => {
      if (files.length === 0) return [];
      if (!(await assicuraAccessoDrive())) {
        // Same wording as any other Drive failure: the translation table
        // already knows what to tell the user about a missing authorization.
        mostraErrore(new DriveNotAuthorizedError(), "assicuraAccessoDrive");
        return files;
      }

      setBusy(true);
      const falliti: FileScelto[] = [];
      try {
        for (const [i, file] of files.entries()) {
          try {
            // Deliberately NOT retried: carica creates a new Drive file and
            // inserts a new row, so it is not idempotent. A lost reply after a
            // successful upload would leave a duplicate file and row — worse
            // than asking the user to tap again.
            await repo.carica({
              ripassoId: id,
              localUri: file.uri,
              originalFileName: file.name,
              mimeType: file.mimeType,
              sizeBytes: file.size,
              orderIndex: primoIndice + i,
            });
          } catch (e) {
            falliti.push(file);
            mostraErrore(e, "caricaAllegato", { ripassoId: id, file: file.name });
          }
        }
      } finally {
        setBusy(false);
      }
      onChange?.();
      return falliti;
    },
    [onChange, assicuraAccessoDrive, repo]
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
      eseguiIdempotente("rinominaAllegato", () => repo.rinomina(id, nome)),
    [repo, eseguiIdempotente]
  );

  const riordina = useCallback(
    (idsInOrdine: string[]) =>
      eseguiIdempotente("riordinaAllegati", () => repo.riordina(idsInOrdine)),
    [repo, eseguiIdempotente]
  );

  const elimina = useCallback(
    (allegato: Allegato) =>
      eseguiIdempotente("eliminaAllegato", async () => {
        await repo.elimina(allegato);
        await rimuoviDaCache(allegato.id);
      }),
    [repo, eseguiIdempotente]
  );

  /**
   * Uri to display an attachment: local cache if present, otherwise
   * downloads from Drive into a temp file. Always returns a local `file://`
   * (Drive files under the `drive.file` scope are private, no public URL).
   */
  const risolviUri = useCallback(
    async (a: Allegato): Promise<string> => {
      const locale = await getLocalUri(a.id);
      if (locale) {
        const info = await FileSystem.getInfoAsync(locale);
        if (info.exists) return locale;
      }
      // A download is idempotent: safe to retry on a flaky connection.
      return conRetry(() => repo.materializzaTemporaneo(a));
    },
    [repo]
  );

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
