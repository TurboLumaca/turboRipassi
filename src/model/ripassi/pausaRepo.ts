/**
 * Model layer — persistence for the rest/travel pause state.
 * Saves the active pause configuration locally in a JSON file.
 */
import * as FileSystem from "expo-file-system/legacy";
import { reportError } from "@/config/crashReporting";
import type { ConfigurazionePausa } from "./pausaLogic";

const FILE = FileSystem.documentDirectory + "pausa.json";

export type { ConfigurazionePausa };

export const STATO_PAUSA_INIZIALE: ConfigurazionePausa = {
  attiva: false,
};

function normalizza(raw: unknown): ConfigurazionePausa {
  if (typeof raw !== "object" || raw === null) return STATO_PAUSA_INIZIALE;
  const o = raw as Record<string, unknown>;

  const attiva = typeof o.attiva === "boolean" ? o.attiva : false;
  const dataInizio = typeof o.dataInizio === "string" ? o.dataInizio : undefined;
  const dataFine = typeof o.dataFine === "string" ? o.dataFine : undefined;
  const motivo = typeof o.motivo === "string" ? o.motivo : undefined;

  return {
    attiva,
    dataInizio,
    dataFine,
    motivo,
  };
}

export interface PausaRepo {
  leggi(): Promise<ConfigurazionePausa>;
  scrivi(config: ConfigurazionePausa): Promise<void>;
}

export const pausaRepo: PausaRepo = {
  async leggi(): Promise<ConfigurazionePausa> {
    try {
      const info = await FileSystem.getInfoAsync(FILE);
      if (!info || !info.exists) return STATO_PAUSA_INIZIALE;
      return normalizza(JSON.parse(await FileSystem.readAsStringAsync(FILE)));
    } catch {
      return STATO_PAUSA_INIZIALE;
    }
  },

  async scrivi(config: ConfigurazionePausa): Promise<void> {
    try {
      await FileSystem.writeAsStringAsync(FILE, JSON.stringify(config));
    } catch (e) {
      reportError(e, { dove: "scriviPausa" });
    }
  },
};

/** Removes the stored pause state file on logout. */
export async function dimenticaPausa(): Promise<void> {
  await FileSystem.deleteAsync(FILE, { idempotent: true }).catch(() => undefined);
}
