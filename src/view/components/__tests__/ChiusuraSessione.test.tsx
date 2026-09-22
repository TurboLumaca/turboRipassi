import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ChiusuraSessione } from "../ChiusuraSessione";

const DOMANI = {
  ripassoId: "r1",
  titolo: "Avversione alla perdita",
  domanda: "Perché il coefficiente di perdita avversa è ~2,25?",
};

describe("ChiusuraSessione", () => {
  it("chiusa non disegna niente", async () => {
    await render(
      <ChiusuraSessione aperta={false} riepilogo="Oggi è tutto." domani={null} onChiudi={jest.fn()} />
    );
    expect(screen.queryByText("Oggi è tutto.")).toBeNull();
  });

  // Il punteggio della sessione, e nient'altro accanto.
  it("mette al centro il passo avanti dei concetti", async () => {
    await render(
      <ChiusuraSessione
        aperta
        riepilogo="Oggi è tutto. 4 concetti hanno fatto un passo avanti."
        domani={null}
        onChiudi={jest.fn()}
      />
    );
    expect(
      screen.getByText("Oggi è tutto. 4 concetti hanno fatto un passo avanti.")
    ).toBeTruthy();
  });

  // Zeigarnik deliberato: l'anello resta aperto e si chiude da solo domani,
  // non stasera per pressione.
  it("anticipa la domanda di domani, non la risposta", async () => {
    await render(
      <ChiusuraSessione aperta riepilogo="Oggi è tutto." domani={DOMANI} onChiudi={jest.fn()} />
    );
    expect(
      screen.getByText("«Perché il coefficiente di perdita avversa è ~2,25?»")
    ).toBeTruthy();
    expect(screen.getByText("60 secondi.")).toBeTruthy();
  });

  it("senza niente domani non inventa un'anticipazione", async () => {
    await render(
      <ChiusuraSessione aperta riepilogo="Oggi è tutto." domani={null} onChiudi={jest.fn()} />
    );
    expect(screen.getByText(/Domani non c'è niente in scadenza/)).toBeTruthy();
  });

  // Non è un ponte verso altro: l'unico gesto disponibile è uscire.
  it("offre una sola uscita e nessuna seconda sessione", async () => {
    const chiudi = jest.fn();
    await render(
      <ChiusuraSessione aperta riepilogo="Oggi è tutto." domani={DOMANI} onChiudi={chiudi} />
    );
    await fireEvent.press(screen.getByText("Chiudi"));
    expect(chiudi).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/ancora/i)).toBeNull();
  });
});
