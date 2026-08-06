/**
 * Test della sezione Aiuto.
 *
 * Il contenuto è testo statico e non ha senso ricopiarlo qui: sarebbe un test
 * che fallisce a ogni virgola corretta. Quello che deve reggere è il
 * comportamento a tendina — la risposta non c'è finché non la si chiede, una
 * domanda alla volta, e la stessa domanda si richiude — e che le quattro
 * questioni per cui la sezione esiste siano davvero coperte.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Aiuto } from "../Aiuto";

const DRIVE = "Come funziona il collegamento a Google Drive?";
const ACCESSO = "Sono entrato con Google invece che con la password: ritrovo i miei ripassi?";

describe("Aiuto", () => {
  it("mostra le domande senza le risposte", async () => {
    await render(<Aiuto />);

    expect(screen.getByText(DRIVE)).toBeTruthy();
    expect(screen.queryByText(/cartella chiamata ripassiProgrammati/)).toBeNull();
  });

  it("apre la risposta della domanda toccata", async () => {
    await render(<Aiuto />);

    await fireEvent.press(screen.getByText(DRIVE));

    expect(screen.getByText(/cartella chiamata ripassiProgrammati/)).toBeTruthy();
  });

  it("richiude la domanda già aperta", async () => {
    await render(<Aiuto />);

    await fireEvent.press(screen.getByText(DRIVE));
    await fireEvent.press(screen.getByText(DRIVE));

    expect(screen.queryByText(/cartella chiamata ripassiProgrammati/)).toBeNull();
  });

  // Con tutte aperte la sezione diventa un muro di testo in cui la domanda
  // che interessa non si trova più.
  it("ne tiene aperta una alla volta", async () => {
    await render(<Aiuto />);

    await fireEvent.press(screen.getByText(DRIVE));
    await fireEvent.press(screen.getByText(ACCESSO));

    expect(screen.getByText(/non al modo in cui entri/)).toBeTruthy();
    expect(screen.queryByText(/cartella chiamata ripassiProgrammati/)).toBeNull();
  });

  /**
   * Le quattro cose che l'interfaccia da sola non riesce a dire, e su cui
   * altrimenti arriverebbe una segnalazione scritta come «non funziona».
   * Toccano ciascuna la propria risposta: se una domanda sparisce dall'elenco,
   * questo test se ne accorge.
   */
  it.each([
    ["Drive e OAuth", DRIVE, /cartella chiamata ripassiProgrammati/],
    ["i ripassi seguono l'account", ACCESSO, /non al modo in cui entri/],
    ["la lettura offline", "L'app funziona senza connessione?", /ieri, oggi e domani/],
    [
      "un allegato non caricato",
      "Cosa succede se il caricamento di un allegato non riesce?",
      /tocca di nuovo Salva/i,
    ],
  ])("risponde su %s", async (_titolo, domanda, rispostaAttesa) => {
    await render(<Aiuto />);

    await fireEvent.press(screen.getByText(domanda));

    expect(screen.getByText(rispostaAttesa)).toBeTruthy();
  });
});
