/**
 * Controller — the ripasso form: field state, saving, and the attachments
 * picked before the row exists.
 *
 * Extracted from FormRipassoScreen, which had grown to hold the whole save
 * orchestration inline. The project rule is that the View carries no business
 * logic; "create or update, then upload the buffered files, then decide
 * whether the screen may close" is exactly that.
 *
 * Navigation stays with the caller: `salva` and `elimina` report whether the
 * screen is done, they don't move anyone.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useRipassiCtx } from "../RipassiContext";
import { useAllegati } from "../allegati/useAllegati";
import { mostraErrore } from "../avvisoErrore";
import { calcolaOccorrenze } from "@/model/ripassi/occorrenzeDates";
import type { FileScelto } from "../allegati/fileDispositivo";

/** A file waiting for the ripasso to exist, with a key that survives removals. */
export interface AllegatoInAttesa {
  chiave: string;
  file: FileScelto;
}

/**
 * Message for a partially failed batch. Split out because the singular and
 * plural forms are otherwise an inline ternary in the middle of the save path.
 */
function messaggioAllegatiFalliti(quanti: number): string {
  const soggetto =
    quanti === 1
      ? "un allegato non è arrivato"
      : `${quanti} allegati non sono arrivati`;
  return `Il ripasso è salvato, ma ${soggetto} su Google Drive. Tocca di nuovo Salva per riprovare.`;
}

export function useFormRipasso(ripassoIdIniziale?: string) {
  const { ripassi, reload, crea, modifica, elimina: eliminaRipasso } = useRipassiCtx();

  // A ripasso created during this visit keeps the screen usable instead of
  // creating a second one: after the first save the form behaves as an edit.
  const [idCreato, setIdCreato] = useState<string | null>(null);
  const editId = ripassoIdIniziale ?? idCreato;
  const isEdit = editId !== null;

  const corrente = useMemo(
    () => ripassi.find((r) => r.id === editId) ?? null,
    [ripassi, editId]
  );

  const { busy, caricaSuRipasso, risolviUri } = useAllegati(editId, reload);

  const [titolo, setTitolo] = useState(corrente?.titolo ?? "");
  const [note, setNote] = useState(corrente?.note ?? "");
  const [includi1h, setIncludi1h] = useState(false);
  const [saving, setSaving] = useState(false);

  // Files picked before the ripasso exists: uploaded on save. Anything that
  // fails to upload stays here so the user can retry instead of losing it.
  // Each carries its own key: two photos can share a name, and a key derived
  // from the position would follow the wrong file once one is removed.
  const [inAttesa, setInAttesa] = useState<AllegatoInAttesa[]>([]);
  const contatoreAttesa = useRef(0);

  /** Preview of the occurrences that will be generated (creation only). */
  const anteprima = useMemo(() => calcolaOccorrenze(new Date(), includi1h), [includi1h]);

  /** Creates or updates the row, returning the id the attachments belong to. */
  const salvaRiga = useCallback(
    async (id: string | null): Promise<string> => {
      const campi = { titolo: titolo.trim(), note: note.trim() || null };
      if (id) {
        await modifica(id, campi);
        return id;
      }
      const creato = await crea({ ...campi, includi1h });
      setIdCreato(creato.id);
      return creato.id;
    },
    [titolo, note, includi1h, modifica, crea]
  );

  /**
   * Saves the ripasso and uploads whatever was picked before it existed.
   * Returns true when the screen has nothing left to do and may close; false
   * keeps it open, either because the input was rejected or because some
   * attachment still has to be retried.
   */
  const salva = useCallback(async (): Promise<boolean> => {
    if (titolo.trim() === "") {
      Alert.alert("Titolo mancante", "Inserisci un titolo per il ripasso.");
      return false;
    }

    setSaving(true);
    const daCaricare = inAttesa;
    const primoIndice = corrente?.allegati.length ?? 0;
    try {
      const id = await salvaRiga(editId);
      if (daCaricare.length === 0) return true;

      const falliti = await caricaSuRipasso(
        id,
        daCaricare.map((v) => v.file),
        primoIndice
      );
      // The uploader hands back the very objects it was given, so identity is
      // enough to keep each failure paired with its key.
      setInAttesa(daCaricare.filter((v) => falliti.includes(v.file)));
      if (falliti.length === 0) return true;

      // The ripasso itself is saved: staying here keeps the failed files in
      // hand so another tap on Salva retries just those.
      Alert.alert("Allegati non caricati", messaggioAllegatiFalliti(falliti.length));
      return false;
    } catch (e) {
      mostraErrore(e, "salvaRipasso");
      return false;
    } finally {
      setSaving(false);
    }
  }, [titolo, inAttesa, corrente, editId, salvaRiga, caricaSuRipasso]);

  /**
   * Picking an attachment: uploaded immediately when the ripasso already
   * exists, held on screen otherwise (it has no id to belong to yet).
   */
  const aggiungiAllegato = useCallback(
    async (scegli: () => Promise<FileScelto | null>) => {
      const file = await scegli();
      if (!file) return;
      if (editId) {
        await caricaSuRipasso(editId, [file], corrente?.allegati.length ?? 0);
        return;
      }
      const chiave = `attesa-${contatoreAttesa.current++}`;
      setInAttesa((precedenti) => [...precedenti, { chiave, file }]);
    },
    [editId, corrente, caricaSuRipasso]
  );

  const rimuoviInAttesa = useCallback((chiave: string) => {
    setInAttesa((precedenti) => precedenti.filter((v) => v.chiave !== chiave));
  }, []);

  /** Deletes the ripasso. True when it is gone and the screen may close. */
  const elimina = useCallback(async (): Promise<boolean> => {
    if (!editId) return false;
    try {
      await eliminaRipasso(editId);
      return true;
    } catch (e) {
      // Without this the rejection was unhandled and the screen stayed open
      // with no explanation.
      mostraErrore(e, "eliminaRipasso");
      return false;
    }
  }, [editId, eliminaRipasso]);

  return {
    // identity
    editId,
    isEdit,
    corrente,
    // fields
    titolo,
    setTitolo,
    note,
    setNote,
    includi1h,
    setIncludi1h,
    // attachments
    inAttesa,
    aggiungiAllegato,
    rimuoviInAttesa,
    risolviUri,
    // occurrences preview
    anteprima,
    // status + actions
    saving,
    busy,
    salva,
    elimina,
  };
}
