/**
 * Model layer — persistence for the app's own settings (the preferences that
 * are a choice about the interface, not a fact about the reviews).
 *
 * A JSON file, like the pausa state: read whole, written whole, a handful of
 * times ever. A table or a store would add a schema to migrate for settings
 * that are one boolean today and may never be more.
 */
import * as FileSystem from "expo-file-system/legacy";
import { reportError } from "@/config/crashReporting";

const FILE = FileSystem.documentDirectory + "impostazioni.json";

export interface Impostazioni {
  /**
   * Mostra la domanda del richiamo quando si spunta un concetto.
   *
   * True di default: la domanda è ciò che rende la spunta un richiamo invece
   * di un interruttore. Chi la disattiva ha già una sua procedura fuori
   * dall'app e vuole che il tondino torni a essere una conferma secca — la
   * via diretta esiste comunque col long-press; questa la mette a un tocco.
   */
  chiediDomandaAlRichiamo: boolean;
}

export const IMPOSTAZIONI_INIZIALI: Impostazioni = {
  chiediDomandaAlRichiamo: true,
};

function normalizza(raw: unknown): Impostazioni {
  if (typeof raw !== "object" || raw === null) return IMPOSTAZIONI_INIZIALI;
  const o = raw as Record<string, unknown>;
  return {
    chiediDomandaAlRichiamo:
      typeof o.chiediDomandaAlRichiamo === "boolean"
        ? o.chiediDomandaAlRichiamo
        : IMPOSTAZIONI_INIZIALI.chiediDomandaAlRichiamo,
  };
}

export interface ImpostazioniRepo {
  leggi(): Promise<Impostazioni>;
  scrivi(impostazioni: Impostazioni): Promise<void>;
}

export const impostazioniRepo: ImpostazioniRepo = {
  async leggi(): Promise<Impostazioni> {
    try {
      const info = await FileSystem.getInfoAsync(FILE);
      if (!info || !info.exists) return IMPOSTAZIONI_INIZIALI;
      return normalizza(JSON.parse(await FileSystem.readAsStringAsync(FILE)));
    } catch {
      return IMPOSTAZIONI_INIZIALI;
    }
  },

  async scrivi(impostazioni: Impostazioni): Promise<void> {
    try {
      await FileSystem.writeAsStringAsync(FILE, JSON.stringify(impostazioni));
    } catch (e) {
      reportError(e, { dove: "scriviImpostazioni" });
    }
  },
};
