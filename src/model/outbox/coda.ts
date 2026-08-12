/**
 * Model layer — the outgoing queue on disk.
 *
 * Two things are persisted: a JSON file listing what still has to reach the
 * server, and, beside it, a private copy of every file waiting to go up to
 * Drive. Both live in the app's documents — not the system cache — because the
 * queue can wait days for a connection and the cache is exactly the directory
 * the OS reclaims first.
 *
 * A JSON file and not SQLite, for the same reason `ripassiOffline` is one: it
 * is read whole and written whole a handful of times a day, and a table would
 * add a schema to migrate for no query it needs to answer.
 *
 * Pure rules (what to sync, how a queued entry looks to the app) live in
 * codaLogic.ts; this file is I/O and serialization only.
 */
import * as FileSystem from "expo-file-system/legacy";
import { estensione } from "@/model/shared/fileUtils";
import { idLocale } from "@/model/shared/idLocale";
import type { FileInCoda, OccorrenzaInCoda, VoceCoda } from "./codaLogic";

const FILE = `${FileSystem.documentDirectory}coda-uscita.json`;
/** Written first, then moved onto FILE: see `scriviCoda`. */
const FILE_TEMP = `${FILE}.tmp`;
const DIR_FILE = `${FileSystem.documentDirectory}coda-file/`;

/**
 * Bumped whenever the stored shape changes. An older snapshot is discarded
 * rather than migrated — with one deliberate exception: the files it points at
 * are deleted with it, so a shape change never leaves orphaned megabytes in the
 * documents directory that nothing will ever look at again.
 */
const VERSIONE = 1;

interface Istantanea {
  versione: number;
  voci: VoceCoda[];
}

/** A file the caller has picked and wants uploaded when there is a network. */
export interface FileDaAccodare {
  uri: string;
  nome: string;
  mimeType: string | null;
  sizeBytes: number | null;
  orderIndex: number;
}

/** Fields of a save that is being deferred. */
export interface SalvataggioDaAccodare {
  id: string;
  titolo: string;
  note: string | null;
  /**
   * The occurrences to create along with the ripasso, or null when the row
   * already exists on the server and only fields/attachments are queued.
   */
  occorrenze: OccorrenzaInCoda[] | null;
  /**
   * True when the user actually retyped the title or the notes. False when the
   * fields are just being carried along with an attachment — see
   * `VoceCoda.campiModificati`.
   */
  campiModificati: boolean;
  file: FileDaAccodare[];
}

/**
 * Serializes every access to the queue.
 *
 * Read-modify-write is the only operation this module performs, and its callers
 * are a screen (the user pressing Salva) and a worker draining the queue in the
 * background — which is precisely the pair that interleaves. Without this, a
 * save landing mid-drain is read from the old snapshot and written back over
 * the new one, and the entry the worker had just completed comes back from the
 * dead with its files already deleted.
 */
let catena: Promise<unknown> = Promise.resolve();

function inSequenza<T>(azione: () => Promise<T>): Promise<T> {
  const risultato = catena.then(azione, azione);
  // A rejection must not poison the chain: the next caller waits for this one
  // to settle, not for it to succeed.
  catena = risultato.catch(() => undefined);
  return risultato;
}

function isIstantanea(v: unknown): v is Istantanea {
  if (v === null || typeof v !== "object") return false;
  const i = v as Partial<Istantanea>;
  return i.versione === VERSIONE && Array.isArray(i.voci);
}

/** Reads the stored queue. An unreadable or older file counts as empty. */
async function leggiGrezza(): Promise<VoceCoda[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return [];
    const testo = await FileSystem.readAsStringAsync(FILE);
    const valore: unknown = JSON.parse(testo);
    return isIstantanea(valore) ? valore.voci : [];
  } catch {
    return [];
  }
}

/**
 * Replaces the stored queue.
 *
 * Written to a sibling file and moved into place. `writeAsStringAsync` is not
 * atomic, and the one moment this file is being rewritten is the moment the
 * worker has just finished an upload — losing it to a truncated write would
 * mean re-uploading everything it had already done, or, worse, reading half a
 * JSON document as an empty queue and dropping the user's files.
 *
 * Failures propagate here, unlike in the offline snapshot: that one can be
 * rebuilt by the next successful load, this one cannot be rebuilt by anything.
 * A caller that cannot persist the queue must tell the user their save did not
 * take, not pretend it did.
 */
async function scriviCoda(voci: VoceCoda[]): Promise<void> {
  const istantanea: Istantanea = { versione: VERSIONE, voci };
  await FileSystem.writeAsStringAsync(FILE_TEMP, JSON.stringify(istantanea));
  await FileSystem.deleteAsync(FILE, { idempotent: true });
  await FileSystem.moveAsync({ from: FILE_TEMP, to: FILE });
}

async function assicuraDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR_FILE);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR_FILE, { intermediates: true });
}

/**
 * Takes a private copy of a picked file and describes it as a queue entry.
 *
 * The copy is the point. `FileScelto.uri` comes from the camera, the gallery or
 * the document picker, and every one of them hands back something in the system
 * cache directory: valid for this session, gone whenever Android decides it
 * needs the space. Uploading it an hour later usually works, uploading it
 * tomorrow morning often does not, and the failure looks like a corrupt file
 * rather than a missing one.
 */
async function copiaInCoda(f: FileDaAccodare): Promise<FileInCoda> {
  await assicuraDir();
  const id = idLocale();
  const dest = `${DIR_FILE}${id}${estensione(f.nome, f.mimeType)}`;
  await FileSystem.copyAsync({ from: f.uri, to: dest });
  return {
    id,
    uri: dest,
    nome: f.nome,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    orderIndex: f.orderIndex,
    driveFileId: null,
  };
}

/** Removes the private copies of a set of queued files, ignoring failures. */
async function eliminaCopie(file: readonly FileInCoda[]): Promise<void> {
  for (const f of file) {
    await FileSystem.deleteAsync(f.uri, { idempotent: true }).catch(() => undefined);
  }
}

/** The queue as stored, oldest first. */
export function leggiCoda(): Promise<VoceCoda[]> {
  return inSequenza(leggiGrezza);
}

/**
 * Adds a deferred save to the queue, or folds it into the entry already there.
 *
 * Folding rather than appending is what keeps "one ripasso, one line" true: a
 * ripasso created offline and then edited twice and given three photos is one
 * thing the user is waiting on, and replaying three separate operations in
 * order would be a way to get the middle one applied last.
 *
 * `occorrenze` is only ever taken from the *first* save. On an entry that
 * already exists the dates were settled when the ripasso was created — either
 * here or on the server — and recomputing them from "now" would silently move
 * the whole schedule every time the title was corrected.
 *
 * The attempt counter is reset: the user has just acted on this ripasso, which
 * is reason enough to give a blocked entry its retries back.
 */
export function accodaSalvataggio(input: SalvataggioDaAccodare): Promise<VoceCoda> {
  return inSequenza(async () => {
    const nuoviFile = await Promise.all(input.file.map(copiaInCoda));
    const voci = await leggiGrezza();
    const esistente = voci.find((v) => v.id === input.id);

    const voce: VoceCoda = {
      id: input.id,
      titolo: input.titolo,
      note: input.note,
      occorrenze: esistente ? esistente.occorrenze : input.occorrenze,
      // Sticky: an edit queued yesterday is still an edit today, even if what
      // reopened the entry was only a photo.
      campiModificati: (esistente?.campiModificati ?? false) || input.campiModificati,
      allegati: [...(esistente?.allegati ?? []), ...nuoviFile],
      accodatoIl: esistente?.accodatoIl ?? new Date().toISOString(),
      tentativi: 0,
      ultimoErrore: null,
    };

    const aggiornate = esistente
      ? voci.map((v) => (v.id === voce.id ? voce : v))
      : [...voci, voce];
    try {
      await scriviCoda(aggiornate);
    } catch (e) {
      // The queue is unchanged, so the copies just made belong to nobody:
      // remove them rather than leave the documents directory growing by a
      // photo every time the disk is full.
      await eliminaCopie(nuoviFile);
      throw e;
    }
    return voce;
  });
}

/**
 * Applies a change to one entry, in the same serialized way everything else
 * reads and writes it.
 *
 * The patch is applied to the entry *as stored*, not to a copy the caller was
 * holding: the worker reads the queue, spends a minute uploading and then
 * records what it achieved, and in that minute the user may well have added
 * another photo to the same ripasso.
 */
export function aggiornaVoce(
  id: string,
  patch: (v: VoceCoda) => VoceCoda
): Promise<VoceCoda | null> {
  return inSequenza(async () => {
    const voci = await leggiGrezza();
    const esistente = voci.find((v) => v.id === id);
    if (!esistente) return null;
    const nuova = patch(esistente);
    await scriviCoda(voci.map((v) => (v.id === id ? nuova : v)));
    return nuova;
  });
}

/**
 * Drops the attachments that have made it to Drive, and the whole entry with
 * them once there is nothing left to send.
 *
 * One call, not two, because the two halves must not be separable: an entry
 * emptied of its attachments but left in the queue is an UPDATE that will be
 * sent forever, and an entry removed while a file it owns is still queued
 * leaves that file on disk with nothing referring to it.
 */
export function segnaCompletati(
  id: string,
  allegatiFatti: readonly string[],
  ripassoFatto: boolean
): Promise<void> {
  return inSequenza(async () => {
    const voci = await leggiGrezza();
    const esistente = voci.find((v) => v.id === id);
    if (!esistente) return;

    const fatti = new Set(allegatiFatti);
    const rimasti = esistente.allegati.filter((a) => !fatti.has(a.id));
    const occorrenze = ripassoFatto ? null : esistente.occorrenze;
    // The row is up to date, whether it was created or updated: the fields on
    // the device are no longer an edit waiting to be sent.
    const campiModificati = ripassoFatto ? false : esistente.campiModificati;

    // Nothing left to send: the entry goes, and so do the copies of the files
    // that are now safely on Drive.
    if (occorrenze === null && !campiModificati && rimasti.length === 0) {
      await scriviCoda(voci.filter((v) => v.id !== id));
      await eliminaCopie(esistente.allegati);
      return;
    }

    await scriviCoda(
      voci.map((v) =>
        v.id === id ? { ...v, occorrenze, campiModificati, allegati: rimasti } : v
      )
    );
    await eliminaCopie(esistente.allegati.filter((a) => fatti.has(a.id)));
  });
}

/** Removes an entry and its files, whatever state it is in. */
export function rimuoviVoce(id: string): Promise<void> {
  return inSequenza(async () => {
    const voci = await leggiGrezza();
    const esistente = voci.find((v) => v.id === id);
    if (!esistente) return;
    await scriviCoda(voci.filter((v) => v.id !== id));
    await eliminaCopie(esistente.allegati);
  });
}

/**
 * Empties the queue and the files it holds. Called on logout, with the
 * attachment cache and the saved list: what is in here is the user's, not the
 * device's, and it is about to be uploaded to *their* Drive under whoever signs
 * in next.
 */
export function dimenticaCoda(): Promise<void> {
  return inSequenza(async () => {
    await FileSystem.deleteAsync(FILE, { idempotent: true }).catch(() => undefined);
    await FileSystem.deleteAsync(FILE_TEMP, { idempotent: true }).catch(() => undefined);
    await FileSystem.deleteAsync(DIR_FILE, { idempotent: true }).catch(() => undefined);
  });
}
