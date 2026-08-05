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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useRipassiCtx } from "../RipassiContext";
import { useAllegati } from "../allegati/useAllegati";
import { mostraErrore } from "../avvisoErrore";
import { calcolaOccorrenze, type OccorrenzaCalcolata } from "@/model/ripassi/occorrenzeDates";
import type { FileScelto } from "../allegati/fileDispositivo";
import type { Allegato, RipassoCompleto } from "@/model/types";

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

/**
 * What the form screen consumes. Declared and not inferred: FormRipassoScreen
 * reads a dozen members off this hook, and with the type inferred a rename
 * here surfaces as a dozen errors over there — or, for an optional member, as
 * none at all.
 */
export interface StatoFormRipasso {
  /** null while creating, the row id once it exists. */
  editId: string | null;
  isEdit: boolean;
  /** The ripasso being edited, null while creating. */
  corrente: RipassoCompleto | null;
  titolo: string;
  setTitolo: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  includi1h: boolean;
  setIncludi1h: (v: boolean) => void;
  /** Files picked before the ripasso existed, waiting for its id. */
  inAttesa: AllegatoInAttesa[];
  aggiungiAllegato: (scegli: () => Promise<FileScelto | null>) => Promise<void>;
  rimuoviInAttesa: (chiave: string) => void;
  risolviUri: (a: Allegato) => Promise<string>;
  /** The dates the ripasso would land on, recomputed as the toggle changes. */
  anteprima: OccorrenzaCalcolata[];
  saving: boolean;
  /** True while an attachment operation is in flight. */
  busy: boolean;
  /** Saves; true when the screen may close. */
  salva: () => Promise<boolean>;
  /** Deletes; true when the ripasso is gone and the screen may close. */
  elimina: () => Promise<boolean>;
}

export function useFormRipasso(ripassoIdIniziale?: string): StatoFormRipasso {
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

  /**
   * Fills the fields once the ripasso being edited becomes available.
   *
   * useState alone reads `corrente` at mount, and the list arrives
   * asynchronously: opening this screen before the first load finished left
   * the fields empty on an existing ripasso, and a tap on Salva then wrote
   * that emptiness back over the real title and notes.
   *
   * Keyed on the id, not on the object: Realtime rebuilds `corrente` on every
   * event, and reacting to that would wipe out whatever is being typed.
   */
  const idCaricato = useRef<string | null>(null);
  useEffect(() => {
    if (!corrente || idCaricato.current === corrente.id) return;
    idCaricato.current = corrente.id;
    setTitolo(corrente.titolo);
    setNote(corrente.note ?? "");
  }, [corrente]);

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
    // Opened on an existing ripasso the list hasn't produced yet: the fields
    // cannot be trusted to hold what is stored, so saving them would overwrite
    // it. Only for a ripasso arrived from navigation — one created during this
    // visit has fields the user typed, which are authoritative even if the
    // reload hasn't come back.
    if (ripassoIdIniziale !== undefined && corrente === null) {
      Alert.alert(
        "Ripasso non ancora caricato",
        "Attendi che il ripasso finisca di caricarsi e riprova."
      );
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
  }, [titolo, ripassoIdIniziale, inAttesa, corrente, editId, salvaRiga, caricaSuRipasso]);

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
