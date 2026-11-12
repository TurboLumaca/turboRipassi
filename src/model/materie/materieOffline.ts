/**
 * Model layer — the materie list, kept on the device.
 *
 * Without it the form and the filter bar would be empty offline, while the
 * ripassi they tag are still readable from the saved list. A single JSON file
 * rewritten after every successful load, for the same reasons as
 * `ripassiOffline`: read whole, written whole, nothing to query.
 */
import * as FileSystem from "expo-file-system/legacy";
import type { Materia } from "../types";

const FILE = `${FileSystem.documentDirectory}materie-offline.json`;

/** Bumped whenever the stored shape changes; an older file counts as absent. */
const VERSIONE = 1;

interface Istantanea {
  versione: number;
  materie: Materia[];
}

function isIstantanea(v: unknown): v is Istantanea {
  if (v === null || typeof v !== "object") return false;
  const i = v as Partial<Istantanea>;
  return i.versione === VERSIONE && Array.isArray(i.materie);
}

/** Failures are swallowed: this runs after a load that already succeeded. */
export async function salvaMaterie(materie: Materia[]): Promise<void> {
  try {
    const istantanea: Istantanea = { versione: VERSIONE, materie };
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(istantanea));
  } catch {
    // The next successful load tries again.
  }
}

/** The last list confirmed by the server, or null when there is none. */
export async function leggiMaterieSalvate(): Promise<Materia[] | null> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return null;
    const valore: unknown = JSON.parse(await FileSystem.readAsStringAsync(FILE));
    return isIstantanea(valore) ? valore.materie : null;
  } catch {
    return null;
  }
}

/** Called on logout, with the rest of what the device kept for the user. */
export async function dimenticaMaterieSalvate(): Promise<void> {
  await FileSystem.deleteAsync(FILE, { idempotent: true }).catch(() => undefined);
}
