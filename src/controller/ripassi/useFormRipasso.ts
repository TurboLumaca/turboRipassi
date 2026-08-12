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
import { useConnettivita } from "../useConnettivita";
import { mostraErrore } from "../avvisoErrore";
import { calcolaOccorrenze, type OccorrenzaCalcolata } from "@/model/ripassi/occorrenzeDates";
import { occorrenzeInCoda } from "@/model/outbox/codaLogic";
import { idLocale } from "@/model/shared/idLocale";
import { isErroreDiRete } from "@/model/shared/errorMessages";
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
  /**
   * True when this ripasso lives only on the device and is waiting to go up.
   * The screen uses it to explain the state, and to keep the user away from
   * the operations that need a row on the server.
   */
  inCoda: boolean;
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
  /**
   * True while something the form started is waiting between two attempts —
   * the write of the ripasso or an attachment operation, indifferently: from
   * the screen they are one save.
   */
  ritentando: boolean;
  /** Saves; true when the screen may close. */
  salva: () => Promise<boolean>;
  /** Deletes; true when the ripasso is gone and the screen may close. */
  elimina: () => Promise<boolean>;
}

export function useFormRipasso(ripassoIdIniziale?: string): StatoFormRipasso {
  const {
    ripassi,
    reload,
    crea,
    modifica,
    elimina: eliminaRipasso,
    ritentando: ritentandoRipassi,
    coda,
    idsInCoda,
  } = useRipassiCtx();
  const { online } = useConnettivita();

  // A ripasso created during this visit keeps the screen usable instead of
  // creating a second one: after the first save the form behaves as an edit.
  const [idCreato, setIdCreato] = useState<string | null>(null);
  const editId = ripassoIdIniziale ?? idCreato;
  const isEdit = editId !== null;
  const inCoda = editId !== null && idsInCoda.has(editId);

  const corrente = useMemo(
    () => ripassi.find((r) => r.id === editId) ?? null,
    [ripassi, editId]
  );

  const {
    busy,
    ritentando: ritentandoAllegati,
    caricaSuRipasso,
    risolviUri,
  } = useAllegati(editId, reload);

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
  /**
   * Saves to the device instead of to the server, and lets the queue do the
   * rest.
   *
   * The ripasso is complete from this moment on: it has an id, its dates are
   * the ones the form had been showing, and the files are copied somewhere the
   * system cannot reclaim them. What it does not have is a row on Supabase and
   * a file on Drive, which the worker adds as soon as there is a connection.
   *
   * The ids are minted here rather than at sync time because everything else
   * has to be able to refer to them straight away — the list, the reminders,
   * the attachment the user will want to reopen in a minute. It is also what
   * makes the deferred write idempotent: see `idLocale`.
   */
  const salvaInCoda = useCallback(
    async (daCaricare: AllegatoInAttesa[], primoIndice: number): Promise<boolean> => {
      const campi = { titolo: titolo.trim(), note: note.trim() || null };
      const id = editId ?? idLocale();
      try {
        await coda.accoda({
          id,
          ...campi,
          // Only for a ripasso that has never existed anywhere. On one that is
          // merely being edited the dates were settled when it was created, and
          // recomputing them from "now" would move the whole schedule.
          occorrenze: editId ? null : occorrenzeInCoda(new Date(), includi1h, idLocale),
          // Whether the fields are an edit worth sending, or just a copy of
          // what the server already has, carried along with a photo.
          campiModificati:
            corrente === null ||
            corrente.titolo !== campi.titolo ||
            (corrente.note ?? null) !== campi.note,
          file: daCaricare.map((v, i) => ({
            uri: v.file.uri,
            nome: v.file.name,
            mimeType: v.file.mimeType,
            sizeBytes: v.file.size,
            orderIndex: primoIndice + i,
          })),
        });
      } catch (e) {
        // The one failure the user has to hear about: they are about to walk
        // away believing the ripasso exists, and it does not.
        mostraErrore(e, "accodaRipasso");
        return false;
      }
      // From here the screen behaves as an edit of the queued ripasso, and the
      // buffered files belong to the queue rather than to this screen.
      setIdCreato(id);
      setInAttesa([]);
      return true;
    },
    [titolo, note, includi1h, editId, corrente, coda]
  );

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
      // Known to be offline: go straight to the queue. Trying anyway would
      // spend the retry layer's doubling waits on a request that cannot
      // succeed, and Salva would sit there for the best part of a minute
      // before doing what it is about to do anyway.
      if (!online) return await salvaInCoda(daCaricare, primoIndice);

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
      // The device thought it was online and the server disagreed — a tunnel, a
      // captive wifi, a server that is down. Indistinguishable from being
      // offline as far as this save is concerned, and the answer is the same
      // one: keep it, send it later.
      if (isErroreDiRete(e)) return await salvaInCoda(daCaricare, primoIndice);
      mostraErrore(e, "salvaRipasso");
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    titolo,
    ripassoIdIniziale,
    inAttesa,
    corrente,
    editId,
    online,
    salvaRiga,
    caricaSuRipasso,
    salvaInCoda,
  ]);

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
      // A ripasso no server has heard of is deleted by dropping the queue entry
      // — files and all. Sending a DELETE instead would succeed against nothing
      // and leave the entry behind, so the worker would helpfully create the
      // ripasso the user has just thrown away.
      if (inCoda) {
        await coda.scarta(editId);
        return true;
      }
      await eliminaRipasso(editId);
      return true;
    } catch (e) {
      // Without this the rejection was unhandled and the screen stayed open
      // with no explanation.
      mostraErrore(e, "eliminaRipasso");
      return false;
    }
  }, [editId, inCoda, coda, eliminaRipasso]);

  return {
    // identity
    editId,
    isEdit,
    inCoda,
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
    ritentando: ritentandoRipassi || ritentandoAllegati,
    salva,
    elimina,
  };
}
