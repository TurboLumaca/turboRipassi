/**
 * Test del pannello «Il tuo corso».
 *
 * È una casella di testo con tre campi, ma è anche l'unico punto da cui si
 * decide la fase: quello che va protetto è che una data illeggibile non arrivi
 * mai al Controller — il Model la leggerebbe come "iscritto, data sconosciuta"
 * e la Home mostrerebbe una batteria che non vuol dire niente.
 */
import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ContestoPercorso } from "@/controller/PercorsoContext";

let mockPercorso: ContestoPercorso;
jest.mock("@/controller/PercorsoContext", () => ({
  usePercorso: () => mockPercorso,
}));

import { PannelloCorso } from "../PannelloCorso";

const mockImposta = jest.fn();

function contesto(over: Partial<ContestoPercorso> = {}): ContestoPercorso {
  return {
    pronto: true,
    fase: "ospite",
    giorno: 0,
    giorniAllInizio: 0,
    settimaneDalCorso: 0,
    iscrizione: { inizio: null },
    padronanze: {},
    batteria: 0,
    lingua: "Inglese",
    programma: null,
    registraSessione: jest.fn(),
    scegliLingua: jest.fn(),
    scegliProgramma: jest.fn(),
    impostaIscrizione: mockImposta,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  mockPercorso = contesto();
});

describe("PannelloCorso", () => {
  it("dice in che fase sei, con parole leggibili", async () => {
    await render(<PannelloCorso />);
    expect(screen.getByText("Non ancora iscritto")).toBeTruthy();
    expect(screen.getByText("Solo i ripassi sono attivi")).toBeTruthy();
  });

  it("durante il corso conta il giorno", async () => {
    mockPercorso = contesto({ fase: "durante", giorno: 7 });
    await render(<PannelloCorso />);
    expect(screen.getByText("Giorno 7 di 21")).toBeTruthy();
  });

  it("salva l'iscrizione con data, sede e tutor", async () => {
    await render(<PannelloCorso />);

    await fireEvent.changeText(screen.getByLabelText("Primo giorno di corso"), "2026-09-12");
    await fireEvent.changeText(screen.getByLabelText("Sede"), "Rimini");
    await fireEvent.changeText(screen.getByLabelText("Tutor"), "Antonio Colucci");
    await fireEvent.press(screen.getByText("Salva"));

    expect(mockImposta).toHaveBeenCalledWith({
      inizio: "2026-09-12",
      sede: "Rimini",
      tutor: "Antonio Colucci",
    });
  });

  it("i campi facoltativi lasciati vuoti non diventano stringhe vuote", async () => {
    await render(<PannelloCorso />);

    await fireEvent.changeText(screen.getByLabelText("Primo giorno di corso"), "2026-09-12");
    await fireEvent.press(screen.getByText("Salva"));

    expect(mockImposta).toHaveBeenCalledWith({
      inizio: "2026-09-12",
      sede: undefined,
      tutor: undefined,
    });
  });

  it("rifiuta una data che il Model non saprebbe leggere", async () => {
    await render(<PannelloCorso />);

    await fireEvent.changeText(screen.getByLabelText("Primo giorno di corso"), "12/09/2026");
    await fireEvent.press(screen.getByText("Salva"));

    expect(mockImposta).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();
  });

  it("«Non sono iscritto» riporta l'app allo stato ospite", async () => {
    mockPercorso = contesto({ fase: "pre", iscrizione: { inizio: "2026-09-12" } });
    await render(<PannelloCorso />);

    await fireEvent.press(screen.getByText("Non sono iscritto"));
    expect(mockImposta).toHaveBeenCalledWith({ inizio: null });
  });
});
