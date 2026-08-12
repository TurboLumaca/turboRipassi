/**
 * Test della sessione di flashcard.
 *
 * Stavano in PercorsoScreens.test.tsx, che copre le quattro schermate del menu
 * laterale: le flashcard non sono una di quelle, e chi cancellasse questa
 * schermata non avrebbe trovato i suoi test.
 *
 * È l'unica schermata del redesign con uno stato interno vero — introduzione,
 * carta coperta, carta girata, carta dopo — quindi le asserzioni riguardano le
 * transizioni, non l'aspetto.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ContestoPercorso } from "@/controller/PercorsoContext";

let mockPercorso: ContestoPercorso;
jest.mock("@/controller/PercorsoContext", () => ({
  usePercorso: () => mockPercorso,
}));

import { FlashcardScreen } from "../FlashcardScreen";

const mockScegliLingua = jest.fn();

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
    scegliLingua: mockScegliLingua,
    scegliProgramma: jest.fn(),
    impostaIscrizione: jest.fn(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPercorso = contesto();
});

it("apre sull'introduzione con la lingua scelta e quante ne restano", async () => {
  await render(<FlashcardScreen />);

  expect(screen.getByText("Mazzo attivo")).toBeTruthy();
  expect(screen.getByText(/vocaboli/)).toBeTruthy();
});

it("le lingue sono pillole: si sceglie, non si scorre", async () => {
  await render(<FlashcardScreen />);
  await fireEvent.press(screen.getByText("Francese"));
  expect(mockScegliLingua).toHaveBeenCalledWith("Francese");
});

it("«Come funziona?» parte chiuso", async () => {
  await render(<FlashcardScreen />);
  expect(screen.queryByText(/tornano più spesso/)).toBeNull();

  await fireEvent.press(screen.getByText("Come funziona?"));
  expect(screen.getByText(/tornano più spesso/)).toBeTruthy();
});

it("in sessione mostra la carta e le tre risposte esplicite", async () => {
  await render(<FlashcardScreen />);
  await fireEvent.press(screen.getByText("Inizia la sessione"));

  expect(screen.getByText("to overcome")).toBeTruthy();
  expect(screen.getByText("La so")).toBeTruthy();
  expect(screen.getByText("Non sono sicuro")).toBeTruthy();
  expect(screen.getByText("Non la so")).toBeTruthy();
});

it("toccare la carta la gira", async () => {
  await render(<FlashcardScreen />);
  await fireEvent.press(screen.getByText("Inizia la sessione"));
  await fireEvent.press(screen.getByLabelText("Gira la carta"));

  expect(screen.getByText("superare")).toBeTruthy();
});

it("rispondere passa alla carta dopo, di nuovo coperta", async () => {
  await render(<FlashcardScreen />);
  await fireEvent.press(screen.getByText("Inizia la sessione"));
  await fireEvent.press(screen.getByLabelText("Gira la carta"));
  await fireEvent.press(screen.getByText("La so"));

  expect(screen.getByText("to acknowledge")).toBeTruthy();
  expect(screen.queryByText("riconoscere")).toBeNull();
});

it("chiudere la sessione riporta all'introduzione", async () => {
  await render(<FlashcardScreen />);
  await fireEvent.press(screen.getByText("Inizia la sessione"));
  await fireEvent.press(screen.getByText("Chiudi la sessione"));

  expect(screen.getByText("Mazzo attivo")).toBeTruthy();
});

it("una lingua senza vocaboli lo dice invece di offrire una sessione vuota", async () => {
  mockPercorso = contesto({ lingua: "Latino" });
  await render(<FlashcardScreen />);

  expect(screen.getByText(/Non ci sono ancora vocaboli/)).toBeTruthy();
  expect(screen.queryByText("Inizia la sessione")).toBeNull();
});
