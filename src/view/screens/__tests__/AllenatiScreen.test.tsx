/**
 * Test di Allenati e del dettaglio di un allenamento.
 *
 * Il raggruppamento è già garantito da allenamenti.ts; qui interessa che la
 * schermata lo disegni davvero: la batteria solo dove la fase la prevede, i
 * bloccati visibili e non apribili con scritto quando si aprono, e una sessione
 * registrata che arriva al Controller.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ContestoPercorso } from "@/controller/PercorsoContext";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams: { id: string } = { id: "fonetica" };
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockParams }),
}));

let mockPercorso: ContestoPercorso;
jest.mock("@/controller/PercorsoContext", () => ({
  usePercorso: () => mockPercorso,
}));

import { AllenatiScreen } from "../AllenatiScreen";
import { AllenamentoScreen } from "../AllenamentoScreen";

const mockRegistra = jest.fn();

function contesto(over: Partial<ContestoPercorso>): ContestoPercorso {
  return {
    pronto: true,
    fase: "pre",
    giorno: 0,
    giorniAllInizio: 12,
    settimaneDalCorso: 0,
    iscrizione: { inizio: "2026-09-12" },
    padronanze: {},
    batteria: 40,
    lingua: "Inglese",
    programma: null,
    registraSessione: mockRegistra,
    scegliLingua: jest.fn(),
    scegliProgramma: jest.fn(),
    impostaIscrizione: jest.fn(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: "fonetica" };
  mockPercorso = contesto({});
});

describe("AllenatiScreen", () => {
  it("apre sulla fase corrente, e solo lì mostra la batteria", async () => {
    await render(<AllenatiScreen />);

    expect(screen.getByText("Fase 1 · adesso")).toBeTruthy();
    expect(screen.getByLabelText("Batteria al 40 per cento")).toBeTruthy();
  });

  it("durante il corso la batteria non compare in nessun gruppo", async () => {
    mockPercorso = contesto({ fase: "durante", giorno: 7 });
    await render(<AllenatiScreen />);

    expect(screen.getByText("Fase 2 · adesso")).toBeTruthy();
    expect(screen.queryByLabelText(/Batteria/)).toBeNull();
  });

  /**
   * Gli allenamenti non ancora disponibili non spariscono: restano visibili,
   * spenti, con scritta la condizione di sblocco. È anche ciò che comunica
   * l'ampiezza del metodo a chi non è ancora iscritto.
   */
  it("tiene in lista i bloccati, dicendo quando si aprono", async () => {
    await render(<AllenatiScreen />);
    expect(screen.getByText("Griglia numerica")).toBeTruthy();
    expect(screen.getAllByText(/Si sblocca al Giorno/).length).toBeGreaterThan(0);
  });

  it("un bloccato non si apre", async () => {
    await render(<AllenatiScreen />);
    await fireEvent.press(screen.getByLabelText(/Griglia numerica/));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("uno sbloccato porta al suo dettaglio", async () => {
    await render(<AllenatiScreen />);
    await fireEvent.press(screen.getByLabelText(/Conversione fonetica/));
    expect(mockNavigate).toHaveBeenCalledWith("Allenamento", { id: "fonetica" });
  });

  it("il chip dice la fase prima del corso e il giorno durante", async () => {
    await render(<AllenatiScreen />);
    expect(screen.getAllByText("Prima del corso").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Giorno 2").length).toBeGreaterThan(0);
  });

  it("dopo il corso ogni allenamento è di mantenimento", async () => {
    mockPercorso = contesto({ fase: "post", giorno: 30 });
    await render(<AllenatiScreen />);

    expect(screen.getByText("Fase 3 · adesso")).toBeTruthy();
    expect(screen.getAllByText("Mantenimento").length).toBeGreaterThan(0);
  });
});

describe("AllenamentoScreen", () => {
  it("dice quanto vale una tacca quando l'allenamento carica la batteria", async () => {
    mockPercorso = contesto({ fase: "pre", padronanze: { fonetica: 4 } });
    await render(<AllenamentoScreen />);

    expect(screen.getByText("Conversione fonetica")).toBeTruthy();
    expect(screen.getByText("4 tacche su 5")).toBeTruthy();
    expect(screen.getByText(/vale il 10% di batteria/)).toBeTruthy();
  });

  it("registrare una sessione riuscita arriva al Controller", async () => {
    await render(<AllenamentoScreen />);
    await fireEvent.press(screen.getByText("Registra una sessione riuscita"));
    expect(mockRegistra).toHaveBeenCalledWith("fonetica");
  });

  it("a soglia raggiunta il pulsante non propone altro", async () => {
    mockPercorso = contesto({ padronanze: { fonetica: 5 } });
    await render(<AllenamentoScreen />);

    expect(screen.getByText("Soglia raggiunta")).toBeTruthy();
    await fireEvent.press(screen.getByText("Soglia raggiunta"));
    expect(mockRegistra).not.toHaveBeenCalled();
  });

  it("un allenamento bloccato spiega quando si apre, invece di offrirsi", async () => {
    mockParams = { id: "griglia" };
    mockPercorso = contesto({ fase: "durante", giorno: 3 });
    await render(<AllenamentoScreen />);

    expect(screen.getByText("Si sblocca al Giorno 12")).toBeTruthy();
    expect(screen.getByText(/si apre al Giorno 12/)).toBeTruthy();
  });

  it("un id che non esiste più lo dice, invece di restare vuoto", async () => {
    mockParams = { id: "sparito" };
    await render(<AllenamentoScreen />);

    expect(screen.getByText("Questo allenamento non esiste più.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Torna indietro"));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
