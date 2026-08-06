/**
 * Test del form di segnalazione.
 *
 * Quello che deve reggere non è il testo del modale ma le sue promesse:
 * l'invio parte solo se c'è qualcosa da mandare, alla segnalazione finisce
 * attaccato l'ultimo errore che l'utente ha davvero visto, e l'esito che legge
 * corrisponde a cosa è successo — «inviata» solo quando è partita davvero,
 * altrimenti un motivo su cui possa agire, o sapere che non c'è niente da
 * riprovare.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ErroreMostrato } from "@/controller/avvisoErrore";

jest.mock("@/controller/AuthContext", () => ({
  useAuthCtx: () => ({ session: { user: { email: "tizio@example.com" } } }),
}));

let mockUltimoErrore: ErroreMostrato | null = null;
jest.mock("@/controller/avvisoErrore", () => ({
  ultimoErroreMostrato: () => mockUltimoErrore,
}));

const mockInvia = jest.fn();
jest.mock("@/config/crashReporting", () => ({
  inviaSegnalazione: (...a: unknown[]) => mockInvia(...a),
}));

import { SegnalaProblema } from "../SegnalaProblema";

const CAMPO = "Cosa è successo? Es. «ho allegato una foto e non è stata caricata»";

/** Apre il modale e scrive la descrizione. */
async function scrivi(testo: string) {
  await fireEvent.press(screen.getByText("Segnala problema"));
  await fireEvent.changeText(screen.getByPlaceholderText(CAMPO), testo);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUltimoErrore = null;
  mockInvia.mockResolvedValue("inviata");
});

describe("SegnalaProblema", () => {
  it("non apre nulla finché non lo si chiede", async () => {
    await render(<SegnalaProblema />);
    expect(screen.queryByPlaceholderText(CAMPO)).toBeNull();
  });

  it("invia la descrizione con l'indirizzo dell'account", async () => {
    await render(<SegnalaProblema />);
    await scrivi("  la foto non si carica  ");

    await fireEvent.press(screen.getByText("Invia"));

    expect(mockInvia).toHaveBeenCalledWith(
      expect.objectContaining({
        descrizione: "la foto non si carica",
        email: "tizio@example.com",
      })
    );
  });

  // Il motivo per cui questo pulsante esiste: un errore gestito non lascia
  // traccia da nessun'altra parte.
  it("allega l'ultimo errore mostrato dall'app", async () => {
    mockUltimoErrore = {
      operazione: "caricaAllegato",
      messaggio: "Non c'è spazio sufficiente per completare l'operazione.",
      dettaglio: "Drive API 507: {}",
      quando: new Date("2026-08-01T10:00:00.000Z"),
    };

    await render(<SegnalaProblema />);
    await scrivi("la foto non si carica");

    // Prima ancora di inviarla, l'utente la vede: quello che parte è roba che
    // ha letto.
    expect(screen.getByText(/Non c'è spazio sufficiente/)).toBeTruthy();

    await fireEvent.press(screen.getByText("Invia"));

    const { ultimoErrore } = mockInvia.mock.calls[0][0];
    expect(ultimoErrore).toContain("caricaAllegato");
    expect(ultimoErrore).toContain("Drive API 507");
  });

  it("dice che non c'è niente da allegare quando non c'è", async () => {
    await render(<SegnalaProblema />);
    await fireEvent.press(screen.getByText("Segnala problema"));

    expect(screen.getByText(/Nessun errore recente/)).toBeTruthy();
  });

  it("non manda una segnalazione vuota", async () => {
    await render(<SegnalaProblema />);
    await scrivi("   ");

    await fireEvent.press(screen.getByText("Invia"));

    expect(mockInvia).not.toHaveBeenCalled();
  });

  it("conferma quando la segnalazione è partita", async () => {
    await render(<SegnalaProblema />);
    await scrivi("la foto non si carica");

    await fireEvent.press(screen.getByText("Invia"));

    expect(screen.getByText(/Segnalazione inviata/)).toBeTruthy();
  });

  // Il testo resta: chi ha appena descritto il problema non deve riscriverlo
  // perché il treno è entrato in galleria.
  it("dice che non è partita e tiene il testo scritto", async () => {
    mockInvia.mockResolvedValue("nonRiuscita");
    await render(<SegnalaProblema />);
    await scrivi("la foto non si carica");

    await fireEvent.press(screen.getByText("Invia"));

    expect(screen.getByText(/Controlla la connessione/)).toBeTruthy();
    expect(screen.getByDisplayValue("la foto non si carica")).toBeTruthy();
  });

  // Senza DSN — è il caso di ogni build di sviluppo — il pulsante non deve
  // rompere niente né far riprovare qualcosa che non può riuscire.
  it("spiega che in questa versione le segnalazioni non sono attive", async () => {
    mockInvia.mockResolvedValue("nonConfigurato");
    await render(<SegnalaProblema />);
    await scrivi("la foto non si carica");

    await fireEvent.press(screen.getByText("Invia"));

    expect(screen.getByText(/non sono attive in questa versione/)).toBeTruthy();
  });

  it("chiudere dopo un invio riuscito svuota il campo", async () => {
    await render(<SegnalaProblema />);
    await scrivi("la foto non si carica");
    await fireEvent.press(screen.getByText("Invia"));

    await fireEvent.press(screen.getByText("Chiudi"));
    await fireEvent.press(screen.getByText("Segnala problema"));

    expect(screen.getByPlaceholderText(CAMPO).props.value).toBe("");
  });

  it("annullare senza inviare non manda niente", async () => {
    await render(<SegnalaProblema />);
    await scrivi("la foto non si carica");

    await fireEvent.press(screen.getByText("Annulla"));

    expect(mockInvia).not.toHaveBeenCalled();
  });
});
