/**
 * Test delle quattro schermate del menu laterale.
 *
 * Sono liste di card: quello che vale la pena proteggere è il poco che decide
 * qualcosa — «Continua» disabilitato finché non si sceglie e gli Obiettivi
 * senza punti né posizioni. La sessione di flashcard ha un file suo.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ContestoPercorso } from "@/controller/PercorsoContext";

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

let mockPercorso: ContestoPercorso;
jest.mock("@/controller/PercorsoContext", () => ({
  usePercorso: () => mockPercorso,
}));

import {
  AppuntamentiScreen,
  CorsiScreen,
  ObiettiviScreen,
  ProgrammaScreen,
} from "../PercorsoScreens";

const mockScegliProgramma = jest.fn();

function contesto(over: Partial<ContestoPercorso> = {}): ContestoPercorso {
  return {
    pronto: true,
    fase: "pre",
    giorno: 0,
    giorniAllInizio: 12,
    settimaneDalCorso: 0,
    iscrizione: { inizio: "2026-09-12" },
    padronanze: {},
    batteria: 0,
    lingua: "Inglese",
    programma: null,
    registraSessione: jest.fn(),
    scegliLingua: jest.fn(),
    scegliProgramma: mockScegliProgramma,
    impostaIscrizione: jest.fn(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPercorso = contesto();
});

describe("ProgrammaScreen", () => {
  it("mostra ogni programma con titolo, descrizione e durata", async () => {
    await render(<ProgrammaScreen />);

    expect(screen.getByText("Diventa un genio a Rimini")).toBeTruthy();
    expect(screen.getByText("21 giorni · in aula")).toBeTruthy();
  });

  /** Il vecchio Continua stava in fondo allo scroll ed era sempre premibile. */
  it("Continua resta disabilitato finché non si è scelto", async () => {
    await render(<ProgrammaScreen />);
    await fireEvent.press(screen.getByText("Continua"));
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it("scegliere un programma lo comunica al Controller", async () => {
    await render(<ProgrammaScreen />);
    await fireEvent.press(screen.getByText("Gli stili cognitivi"));
    expect(mockScegliProgramma).toHaveBeenCalledWith("stili");
  });

  /** La scelta è già salvata al tocco: Continua conferma e basta. */
  it("con un programma scelto Continua chiude la schermata", async () => {
    mockPercorso = contesto({ programma: "rimini" });
    await render(<ProgrammaScreen />);
    await fireEvent.press(screen.getByText("Continua"));
    expect(mockGoBack).toHaveBeenCalled();
  });
});

describe("AppuntamentiScreen", () => {
  it("elenca gli appuntamenti con giorno, mese e stato", async () => {
    await render(<AppuntamentiScreen />);

    expect(screen.getByText("Primo giorno di corso")).toBeTruthy();
    expect(screen.getAllByText("Confermato").length).toBeGreaterThan(0);
  });

  /** «Da Definire» non è un contenuto: è uno stato, e si disegna come tale. */
  it("l'orario mancante è un'etichetta, non il titolo della card", async () => {
    await render(<AppuntamentiScreen />);
    expect(screen.getAllByText("Orario da confermare").length).toBeGreaterThan(0);
    expect(screen.queryByText("Da Definire")).toBeNull();
  });
});

describe("CorsiScreen", () => {
  it("distingue il corso in frequenza da quelli disponibili", async () => {
    await render(<CorsiScreen />);

    expect(screen.getByText("In corso")).toBeTruthy();
    expect(screen.getByText("Genio in 21 giorni")).toBeTruthy();
    expect(screen.getAllByText("Disponibile")).toHaveLength(2);
  });
});

describe("ObiettiviScreen", () => {
  it("elenca traguardi personali con quanto manca", async () => {
    await render(<ObiettiviScreen />);

    expect(screen.getByText("Leggere 12 libri quest’anno")).toBeTruthy();
    expect(screen.getByText("5 / 12")).toBeTruthy();
  });

  /** La Classifica è stata rimossa: qui è dove punti e posizioni tornerebbero. */
  it("non parla di punti né di posizioni", async () => {
    await render(<ObiettiviScreen />);

    expect(screen.getByText("Traguardi tuoi, non confronti con altri corsisti.")).toBeTruthy();
    expect(screen.queryByText(/punti/i)).toBeNull();
    expect(screen.queryByText(/classifica/i)).toBeNull();
  });
});
