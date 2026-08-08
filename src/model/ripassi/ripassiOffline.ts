/**
 * Model layer — the reviews list, kept on the device for offline reading.
 *
 * Section 7 of the spec caches the *attachments* of the days around today, and
 * the home screen has always promised "sei offline — vedi i ripassi già
 * scaricati". Nothing kept the list itself: the attachments were on disk, but
 * the ripassi and occurrences they belong to came from Supabase on every open,
 * so with no connection the promise resolved to an empty screen with an error
 * over it, and the cached files were unreachable by design — there was no row
 * left to open them from.
 *
 * A single JSON file, rewritten after every successful load. Not SQLite: this
 * is read whole and written whole, once per load, and a table would add a
 * schema to migrate for no query it needs to answer.
 *
 * The file lives in the app's private document directory, next to the
 * attachment cache, and is removed on logout for the same reason those are:
 * what it holds is the user's, not the device's.
 */
import * as FileSystem from "expo-file-system/legacy";
import type { RipassoCompleto } from "../types";

const FILE = `${FileSystem.documentDirectory}ripassi-offline.json`;

/**
 * Bumped whenever the stored shape changes. A snapshot written by an older
 * version is discarded rather than migrated: the next load rewrites it within
 * seconds, and reading half-understood rows into the list is worse than
 * starting the session with nothing.
 */
const VERSIONE = 1;

interface Istantanea {
  versione: number;
  /** When the list was last confirmed by the server, ISO 8601. */
  salvatoIl: string;
  ripassi: RipassoCompleto[];
}

/** A stored list plus the moment it was last confirmed by the server. */
export interface RipassiSalvati {
  ripassi: RipassoCompleto[];
  salvatoIl: Date;
}

function isIstantanea(v: unknown): v is Istantanea {
  if (v === null || typeof v !== "object") return false;
  const i = v as Partial<Istantanea>;
  return i.versione === VERSIONE && typeof i.salvatoIl === "string" && Array.isArray(i.ripassi);
}

/**
 * Replaces the stored list with the one just loaded.
 *
 * Failures are swallowed: this runs after a load that already succeeded, and
 * the user is looking at the result. A device with no space left should not
 * turn a working screen into an error.
 */
export async function salvaRipassi(ripassi: RipassoCompleto[]): Promise<void> {
  const istantanea: Istantanea = {
    versione: VERSIONE,
    salvatoIl: new Date().toISOString(),
    ripassi,
  };
  try {
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(istantanea));
  } catch {
    // Next successful load tries again.
  }
}

/** The last list confirmed by the server, or null when there is none to show. */
export async function leggiRipassiSalvati(): Promise<RipassiSalvati | null> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return null;
    const grezzo = await FileSystem.readAsStringAsync(FILE);
    const valore: unknown = JSON.parse(grezzo);
    if (!isIstantanea(valore)) return null;
    return { ripassi: valore.ripassi, salvatoIl: new Date(valore.salvatoIl) };
  } catch {
    // Missing, unreadable, truncated or written by an older shape: absent.
    return null;
  }
}

/** Removes the stored list. Called on logout, with the attachment cache. */
export async function dimenticaRipassiSalvati(): Promise<void> {
  await FileSystem.deleteAsync(FILE, { idempotent: true }).catch(() => undefined);
}
