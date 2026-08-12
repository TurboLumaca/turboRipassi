/**
 * Controller — the state of the journey: which phase, which day, how much
 * mastery on each training.
 *
 * Every screen of the redesign asks the same first question ("which phase am
 * I drawing?"), so the answer is computed once, here, and not four times in
 * four screens that would eventually disagree. The rules themselves are in the
 * Model (`fasi`, `allenamenti`, `batteria`); this hook holds the state, reads
 * it back from disk on launch and writes it when it changes.
 */
import React, { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import {
  SOGLIA_PADRONANZA,
  padronanzaDi,
  type Padronanze,
} from "@/model/percorso/allenamenti";
import { caricaBatteria } from "@/model/percorso/batteria";
import {
  faseCorrente,
  giorniAllInizio,
  giornoDiCorso,
  settimaneDalCorso,
  type Fase,
  type Iscrizione,
} from "@/model/percorso/fasi";
import {
  STATO_INIZIALE,
  percorsoRepo,
  type PercorsoRepo,
  type StatoPercorso,
} from "@/model/percorso/percorsoRepo";
import type { Lingua } from "@/model/flashcard/flashcard";

export interface ContestoPercorso {
  /** False until the saved state has been read: the shell waits on it. */
  pronto: boolean;
  fase: Fase;
  /** 0 before the course, 1…21 during, higher after. */
  giorno: number;
  giorniAllInizio: number;
  settimaneDalCorso: number;
  iscrizione: Iscrizione;
  padronanze: Padronanze;
  /** Charge 0–100. Only meaningful while the battery is on screen. */
  batteria: number;
  lingua: Lingua;
  programma: string | null;

  /** One training session that went well: one more tick, up to the threshold. */
  registraSessione: (idAllenamento: string) => void;
  scegliLingua: (lingua: Lingua) => void;
  scegliProgramma: (id: string) => void;
  /** Sets or clears the enrolment; `null` puts the app back in guest mode. */
  impostaIscrizione: (iscrizione: Iscrizione) => void;
}

const Ctx = createContext<ContestoPercorso | null>(null);

/**
 * The repository arrives as a parameter with a default, like everywhere else in
 * the Controller: the provider depends on the contract, not on the file on
 * disk. It is what lets the tests run without a filesystem, and what would let
 * a server-backed implementation take over without touching this file.
 */
export function PercorsoProvider({
  children,
  repo = percorsoRepo,
}: {
  children: React.ReactNode;
  repo?: PercorsoRepo;
}) {
  const [stato, setStato] = useState<StatoPercorso>(STATO_INIZIALE);
  const [pronto, setPronto] = useState(false);
  /**
   * The instant the phase is computed against.
   *
   * Held in state rather than read during render for two reasons. Reading the
   * clock while rendering is impure — the same render would produce different
   * answers — and, more usefully, a phone left open overnight has to notice
   * that the day changed: the phase is a function of today, and "today" only
   * moves when something says so. `0` before the first effect is harmless,
   * because an app that has not read its saved state yet has no enrolment and
   * is therefore in the guest phase regardless of the date.
   */
  const [ora, setOra] = useState(0);

  useEffect(() => {
    let vivo = true;
    // The clock is read when the saved state lands, in the same update: that
    // is the first moment there can be an enrolment to date, and it keeps the
    // effect body free of a synchronous setState.
    void repo.leggi().then((salvato) => {
      if (!vivo) return;
      setStato(salvato);
      setOra(Date.now());
      setPronto(true);
    });

    // Coming back to the app is the moment worth re-reading the clock: it is
    // when a course that started at midnight becomes a course that started.
    const sottoscrizione = AppState.addEventListener("change", (s) => {
      if (s === "active") setOra(Date.now());
    });

    return () => {
      vivo = false;
      sottoscrizione.remove();
    };
  }, [repo]);

  /**
   * Apply a change and persist it.
   *
   * The write is not awaited by the caller: the screen has already moved, and
   * a save that fails is reported to Sentry by the repository rather than
   * thrown at somebody in the middle of a training session.
   */
  const aggiorna = useCallback(
    (patch: Partial<StatoPercorso>) => {
      setStato((precedente) => {
        const nuovo = { ...precedente, ...patch };
        void repo.scrivi(nuovo);
        return nuovo;
      });
    },
    [repo]
  );

  const registraSessione = useCallback(
    (idAllenamento: string) => {
      setStato((precedente) => {
        const attuale = padronanzaDi(precedente.padronanze, idAllenamento);
        if (attuale >= SOGLIA_PADRONANZA) return precedente;
        const nuovo = {
          ...precedente,
          padronanze: { ...precedente.padronanze, [idAllenamento]: attuale + 1 },
        };
        void repo.scrivi(nuovo);
        return nuovo;
      });
    },
    [repo]
  );

  const scegliLingua = useCallback((lingua: Lingua) => aggiorna({ lingua }), [aggiorna]);
  const scegliProgramma = useCallback((id: string) => aggiorna({ programma: id }), [aggiorna]);
  const impostaIscrizione = useCallback(
    (iscrizione: Iscrizione) => aggiorna({ iscrizione }),
    [aggiorna]
  );

  const valore = useMemo<ContestoPercorso>(() => {
    // One instant, shared: the four derived numbers cannot disagree about what
    // day it is inside the same frame.
    return {
      pronto,
      fase: faseCorrente(stato.iscrizione, ora),
      giorno: giornoDiCorso(stato.iscrizione, ora),
      giorniAllInizio: giorniAllInizio(stato.iscrizione, ora),
      settimaneDalCorso: settimaneDalCorso(stato.iscrizione, ora),
      iscrizione: stato.iscrizione,
      padronanze: stato.padronanze,
      batteria: caricaBatteria(stato.padronanze),
      lingua: stato.lingua,
      programma: stato.programma,
      registraSessione,
      scegliLingua,
      scegliProgramma,
      impostaIscrizione,
    };
  }, [pronto, stato, ora, registraSessione, scegliLingua, scegliProgramma, impostaIscrizione]);

  return <Ctx value={valore}>{children}</Ctx>;
}

export function usePercorso(): ContestoPercorso {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("usePercorso must be used inside <PercorsoProvider>.");
  return ctx;
}
