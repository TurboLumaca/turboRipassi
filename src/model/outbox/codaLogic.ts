/**
 * Model layer — PURE logic for the outgoing queue (the "coda").
 *
 * What the queue is for: saving a ripasso must not depend on the network. The
 * home screen has promised offline reading for a long time, but writing was
 * the other half of the same promise and it was never kept — with no
 * connection, Salva produced an error and the user lost what they had typed
 * and the photos they had just taken.
 *
 * A queued ripasso is a real ripasso from the moment it is saved: it has an id,
 * its occurrences already have theirs, and it shows in the list, gets its
 * reminders and can be opened. The only thing it lacks is a row on the server
 * and a file on Drive, which is exactly what the sync worker adds later.
 *
 * No I/O here — file writes, uploads and inserts live in coda.ts and in the
 * repos — so the rules below are testable without a device.
 */
import { calcolaOccorrenze } from "../ripassi/occorrenzeDates";
import type { Allegato, Occorrenza, RipassoCompleto } from "../types";

/**
 * A file waiting to go up to Drive.
 *
 * `id` is the id the `allegati` row will have, decided here so that a retry
 * after a lost reply updates the same row instead of adding a second one.
 *
 * `uri` points at a copy inside the app's own documents, not at the file the
 * picker returned: those live in the system cache, which the OS empties when
 * it feels like it. A queue that can wait days for a connection cannot hold a
 * reference to something that may not survive the night.
 *
 * `driveFileId` is filled in as soon as the binary is up and written back to
 * disk before the row is inserted. It is what stops a retry from uploading the
 * same photo twice — the upload is the one step Drive cannot make idempotent
 * for us, since every call creates a new file.
 */
export interface FileInCoda {
  id: string;
  uri: string;
  nome: string;
  mimeType: string | null;
  sizeBytes: number | null;
  orderIndex: number;
  driveFileId: string | null;
}

/** An occurrence computed on the device, with the id its row will carry. */
export interface OccorrenzaInCoda {
  id: string;
  scheduled_at: string;
  is_manual_1h: boolean;
}

/**
 * One ripasso's worth of pending work, keyed by the ripasso id.
 *
 * Keyed that way on purpose: a ripasso created offline and then edited twice
 * and given three photos is *one* thing the user is waiting to see uploaded,
 * and one line in the list of what is still missing from Drive. A log of
 * individual operations would say the same thing four times and would have to
 * be replayed in order to be correct.
 *
 * `occorrenze` is null when the ripasso already exists on the server and only
 * its fields or its attachments are queued: the dates were generated when it
 * was created and must not be recomputed.
 */
export interface VoceCoda {
  id: string;
  titolo: string;
  note: string | null;
  /** Occurrences to create with the ripasso; null when the row already exists. */
  occorrenze: OccorrenzaInCoda[] | null;
  /**
   * Whether the title and notes here are an edit waiting to be sent, or merely
   * a copy of what the server already has.
   *
   * The distinction is the difference between saving and clobbering. Adding a
   * photo offline to a ripasso written months ago queues an entry that carries
   * its title, and sending that title back as an UPDATE would overwrite a
   * correction made on another device in the meantime — with an older value,
   * so last-write-wins resolves it the wrong way round. Only a title the user
   * actually retyped is worth a write.
   *
   * Meaningless while `occorrenze` is non-null: the row does not exist yet, so
   * the fields go up with it either way.
   */
  campiModificati: boolean;
  allegati: FileInCoda[];
  /** When the user pressed Salva, ISO 8601. Shown as "in attesa da…". */
  accodatoIl: string;
  /** Failed sync attempts that were not the network's fault. */
  tentativi: number;
  /** Translated reason of the last such failure; null while none happened. */
  ultimoErrore: string | null;
}

/** Attempts after which an entry stops being retried on its own. */
export const TENTATIVI_MASSIMI = 5;

/**
 * True when the entry has nothing left to do and should never have been kept.
 *
 * An entry with no attachments and an existing row is empty work: it can only
 * arise from an edit that was queued and then applied, and draining it would
 * send an UPDATE nobody asked for.
 */
export function isVuota(v: VoceCoda): boolean {
  return v.occorrenze === null && !v.campiModificati && v.allegati.length === 0;
}

/**
 * True when the entry has run out of automatic retries.
 *
 * It stays in the queue and stays visible — the user's files are in it — but
 * the worker stops picking it up, so a ripasso that fails for a reason no
 * amount of waiting will fix (a title the database rejects, a Drive account
 * with no space) cannot burn the battery retrying on every reconnection.
 */
export function isBloccata(v: VoceCoda): boolean {
  return v.tentativi >= TENTATIVI_MASSIMI;
}

/** The entries the worker should attempt, in the order they were saved. */
export function daSincronizzare(coda: readonly VoceCoda[]): VoceCoda[] {
  return coda.filter((v) => !isBloccata(v) && !isVuota(v));
}

/**
 * Builds the occurrences for a ripasso being created offline.
 *
 * Same dates the server path produces — `calcolaOccorrenze` is the single
 * source for the schedule — with ids attached, because a queued occurrence has
 * to be addressable straight away: the reminder scheduler keys its notifications
 * on the occurrence id, and if the id changed at sync time every reminder would
 * be cancelled and rebooked for no reason.
 */
export function occorrenzeInCoda(
  base: Date,
  includi1h: boolean,
  nuovoId: () => string
): OccorrenzaInCoda[] {
  return calcolaOccorrenze(base, includi1h).map((o) => ({
    id: nuovoId(),
    scheduled_at: o.scheduled_at,
    is_manual_1h: o.is_manual_1h,
  }));
}

/**
 * The queued entry as the rest of the app sees it: an ordinary RipassoCompleto.
 *
 * Deliberately not a new type. Every screen, the reminder scheduler and the
 * search all take `RipassoCompleto`, and a parallel "local ripasso" type would
 * mean touching each of them to handle a case that differs in exactly one
 * respect — whether a server has heard of it yet. That one respect is carried
 * beside the list, as a set of ids, so the components that care can ask and the
 * ones that don't stay unchanged.
 *
 * The ownership columns are empty strings rather than invented values: nothing
 * on the device reads them (ownership is decided by Postgres from the session),
 * and a plausible-looking fake id would be worse than an obviously blank one.
 */
export function ripassoDaCoda(v: VoceCoda, ora: string = v.accodatoIl): RipassoCompleto {
  const occorrenze: Occorrenza[] = (v.occorrenze ?? []).map((o) => ({
    id: o.id,
    ripasso_id: v.id,
    account_id: "",
    user_id: null,
    scheduled_at: o.scheduled_at,
    is_manual_1h: o.is_manual_1h,
    is_completed: false,
    created_at: v.accodatoIl,
    updated_at: ora,
  }));

  const allegati: Allegato[] = v.allegati.map((a) => ({
    id: a.id,
    ripasso_id: v.id,
    account_id: "",
    user_id: null,
    display_name: a.nome,
    original_file_name: a.nome,
    // The Drive id, once there is one. Empty until then: the attachment cannot
    // be fetched from anywhere, and it does not need to be — its bytes are on
    // this device, which is where it was picked.
    storage_path: a.driveFileId ?? "",
    order_index: a.orderIndex,
    mime_type: a.mimeType,
    size_bytes: a.sizeBytes,
    created_at: v.accodatoIl,
    updated_at: ora,
  }));

  return {
    id: v.id,
    account_id: "",
    user_id: null,
    titolo: v.titolo,
    note: v.note,
    created_at: v.accodatoIl,
    updated_at: ora,
    occorrenze,
    allegati,
  };
}

/**
 * The list the screens render: what the server (or the saved snapshot) knows,
 * plus what is still waiting to go up.
 *
 * Where both have something to say about the same id, the server wins for the
 * ripasso itself — it has just confirmed the title and the dates — but the
 * queued attachments are added to whatever it returned. That is the state right
 * after a partial sync: the row is up, two of its three photos are up, and the
 * third is still on the device. Dropping it from the list would make it
 * invisible at the exact moment the user is waiting to see it arrive.
 *
 * Queued-only ripassi go first: they are the most recent thing the user did,
 * and the list is otherwise newest-first already.
 */
export function uniscoConCoda(
  dalServer: readonly RipassoCompleto[],
  coda: readonly VoceCoda[]
): RipassoCompleto[] {
  if (coda.length === 0) return dalServer.slice();

  const perId = new Map(coda.map((v) => [v.id, v]));
  const visti = new Set<string>();

  const uniti = dalServer.map((r) => {
    const v = perId.get(r.id);
    if (!v) return r;
    visti.add(r.id);
    const noti = new Set(r.allegati.map((a) => a.id));
    const inArrivo = ripassoDaCoda(v).allegati.filter((a) => !noti.has(a.id));
    if (inArrivo.length === 0) return r;
    return { ...r, allegati: [...r.allegati, ...inArrivo] };
  });

  const soloInCoda = coda.filter((v) => !visti.has(v.id)).map((v) => ripassoDaCoda(v));
  return [...soloInCoda, ...uniti];
}

/**
 * The ids the screens need to tell a queued ripasso from a synced one.
 *
 * An entry whose row is already on the server is *not* in this set even when
 * some of its attachments still are: the ripasso is safe, and marking it as
 * "not on Drive yet" would be alarming about the wrong thing. What is still
 * missing is said per attachment, by `allegatiInCoda`.
 */
export function idRipassiInCoda(coda: readonly VoceCoda[]): Set<string> {
  return new Set(coda.filter((v) => v.occorrenze !== null).map((v) => v.id));
}

/** Ids of every attachment still waiting to be uploaded, from any entry. */
export function allegatiInCoda(coda: readonly VoceCoda[]): Set<string> {
  const ids = new Set<string>();
  for (const v of coda) for (const a of v.allegati) ids.add(a.id);
  return ids;
}

/** One line of "still to be uploaded", ready for the View to render. */
export interface DaCaricare {
  id: string;
  titolo: string;
  /** How many of its attachments are still on the device only. */
  allegatiMancanti: number;
  /** True when the ripasso itself has never reached the server. */
  ripassoNuovo: boolean;
  /** True when a title/notes edit is still waiting to be sent. */
  campiDaSalvare: boolean;
  /** Set when automatic retries have been given up on. */
  bloccatoPer: string | null;
}

/**
 * What the home screen lists under "not on Drive yet".
 *
 * Entries with nothing left to do are filtered out rather than shown with a
 * zero: an empty entry is bookkeeping the user should never be told about.
 */
export function daCaricare(coda: readonly VoceCoda[]): DaCaricare[] {
  return coda
    .filter((v) => !isVuota(v))
    .map((v) => ({
      id: v.id,
      titolo: v.titolo,
      allegatiMancanti: v.allegati.length,
      ripassoNuovo: v.occorrenze !== null,
      campiDaSalvare: v.occorrenze === null && v.campiModificati,
      bloccatoPer: isBloccata(v) ? v.ultimoErrore : null,
    }));
}
