/**
 * Test del Controller del percorso.
 *
 * Le regole (fase, batteria, soglie) sono già coperte nel Model. Qui interessa
 * il cablaggio: che lo stato salvato venga riletto all'avvio, che ogni modifica
 * finisca su disco, e che una sessione non spinga la padronanza oltre la soglia
 * — perché è quello il punto in cui la batteria smetterebbe di misurare la
 * padronanza e comincerebbe a misurare l'insistenza.
 */
import React, { useEffect } from "react";
import { Text } from "react-native";
import { render, waitFor, act } from "@testing-library/react-native";
import { SOGLIA_PADRONANZA } from "@/model/percorso/allenamenti";
import {
  STATO_INIZIALE,
  type PercorsoRepo,
  type StatoPercorso,
} from "@/model/percorso/percorsoRepo";
import { PercorsoProvider, usePercorso, type ContestoPercorso } from "../PercorsoContext";

/**
 * Il repository finto, passato al provider invece che sostituito col module
 * mocking: è a questo che serve averlo reso un parametro. Nessun
 * `jest.mock` significa nessun disco, e soprattutto che il test esercita la
 * stessa iniezione che userebbe un'implementazione su Supabase.
 */
let mockSalvato: StatoPercorso = STATO_INIZIALE;
const mockScrivi = jest.fn();
const repoFinto: PercorsoRepo = {
  leggi: () => Promise.resolve(mockSalvato),
  scrivi: (s) => {
    mockScrivi(s);
    return Promise.resolve();
  },
};

/**
 * Espone il contesto ai test.
 *
 * Un oggetto contenitore invece di una variabile riassegnata: scrivere su una
 * variabile esterna durante il render è esattamente ciò che le regole di
 * purezza di React vietano, e la sonda deve essere un componente onesto.
 */
const spia: { ctx: ContestoPercorso | null } = { ctx: null };

function Sonda() {
  const corrente = usePercorso();
  // In un effetto, non durante il render: scrivere fuori dal componente
  // mentre si renderizza è impuro, e le regole di React lo vietano a ragione.
  useEffect(() => {
    spia.ctx = corrente;
  }, [corrente]);
  return <Text>{`${corrente.fase}|${corrente.batteria}|${corrente.pronto}`}</Text>;
}

/** Il contesto dell'ultimo render, con l'asserzione che c'è stato. */
function ctx(): ContestoPercorso {
  if (!spia.ctx) throw new Error("La sonda non ha ancora reso nulla.");
  return spia.ctx;
}

/**
 * Monta il provider e aspetta che abbia riletto il disco.
 *
 * `ultimo` viene azzerato prima: senza, l'attesa vedrebbe il valore lasciato
 * dal test precedente — già `pronto` — e passerebbe subito, asserendo sullo
 * stato di un albero smontato.
 */
async function montaEAttendi(): Promise<ContestoPercorso> {
  spia.ctx = null;
  render(
    <PercorsoProvider repo={repoFinto}>
      <Sonda />
    </PercorsoProvider>
  );
  await waitFor(() => expect(spia.ctx?.pronto).toBe(true));
  return ctx();
}

/** Un'iscrizione che comincia fra dodici giorni rispetto a oggi. */
function fraGiorni(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${g}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSalvato = STATO_INIZIALE;
});

describe("PercorsoProvider", () => {
  it("parte da ospite quando non c'è niente di salvato", async () => {
    await montaEAttendi();

    expect(ctx().fase).toBe("ospite");
    expect(ctx().batteria).toBe(0);
  });

  it("rilegge l'iscrizione salvata e ne ricava la fase", async () => {
    mockSalvato = {
      ...STATO_INIZIALE,
      iscrizione: { inizio: fraGiorni(12), sede: "Rimini" },
      padronanze: { fonetica: 4, schedario: 3 },
    };

    await montaEAttendi();

    expect(ctx().fase).toBe("pre");
    expect(ctx().giorniAllInizio).toBe(12);
    expect(ctx().batteria).toBe(70);
  });

  it("durante il corso conta il giorno", async () => {
    mockSalvato = { ...STATO_INIZIALE, iscrizione: { inizio: fraGiorni(-6) } };
    await montaEAttendi();

    expect(ctx().fase).toBe("durante");
    expect(ctx().giorno).toBe(7);
  });

  it("una sessione riuscita aggiunge una tacca e la scrive su disco", async () => {
    await montaEAttendi();
    await act(async () => ctx().registraSessione("fonetica"));

    expect(ctx().padronanze.fonetica).toBe(1);
    expect(mockScrivi).toHaveBeenCalledWith(
      expect.objectContaining({ padronanze: { fonetica: 1 } })
    );
  });

  /**
   * La batteria misura la padronanza raggiunta, non le sessioni fatte: oltre la
   * soglia non c'è niente da aggiungere, e lasciar salire il numero
   * trasformerebbe l'indicatore in un punteggio.
   */
  it("una sessione oltre la soglia non aggiunge niente", async () => {
    mockSalvato = { ...STATO_INIZIALE, padronanze: { fonetica: SOGLIA_PADRONANZA } };
    await montaEAttendi();

    await act(async () => ctx().registraSessione("fonetica"));

    expect(ctx().padronanze.fonetica).toBe(SOGLIA_PADRONANZA);
    expect(mockScrivi).not.toHaveBeenCalled();
  });

  it("cambiare lingua, programma e iscrizione passa dal disco", async () => {
    await montaEAttendi();

    await act(async () => ctx().scegliLingua("Francese"));
    expect(mockScrivi).toHaveBeenLastCalledWith(expect.objectContaining({ lingua: "Francese" }));

    await act(async () => ctx().scegliProgramma("stili"));
    expect(mockScrivi).toHaveBeenLastCalledWith(expect.objectContaining({ programma: "stili" }));

    await act(async () => ctx().impostaIscrizione({ inizio: fraGiorni(3) }));
    expect(ctx().fase).toBe("pre");
  });

  it("togliere l'iscrizione riporta allo stato ospite", async () => {
    mockSalvato = { ...STATO_INIZIALE, iscrizione: { inizio: fraGiorni(2) } };
    await montaEAttendi();
    expect(ctx().fase).toBe("pre");

    await act(async () => ctx().impostaIscrizione({ inizio: null }));
    expect(ctx().fase).toBe("ospite");
  });

});
