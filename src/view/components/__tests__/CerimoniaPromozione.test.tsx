import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { CerimoniaPromozione } from "../CerimoniaPromozione";
import type { CerimoniaDaMostrare } from "@/controller/ripassi/useCerimoniaPromozione";
import type { RipassoCompleto } from "@/model/types";

const ripasso: RipassoCompleto = {
  id: "r1",
  account_id: "a1",
  user_id: "u1",
  titolo: "Avversione alla perdita",
  domanda: null,
  note: null,
  ceremony_shown_at: null,
  created_at: "2026-03-12T09:00:00.000Z",
  updated_at: "2026-03-12T09:00:00.000Z",
  occorrenze: [],
  allegati: [],
};

const cerimonia: CerimoniaDaMostrare = {
  ripasso,
  storia: [
    "2026-03-12T09:00:00.000Z",
    "2026-04-03T09:00:00.000Z",
    "2026-06-15T09:00:00.000Z",
    "2026-09-20T09:00:00.000Z",
  ],
  promossoIl: "2026-09-20T09:00:00.000Z",
  frase: "Questo ora è tuo per sempre.",
};

describe("CerimoniaPromozione", () => {
  it("senza una promozione non c'è cerimonia", async () => {
    await render(<CerimoniaPromozione cerimonia={null} onChiudi={jest.fn()} />);
    expect(screen.queryByText("Memoria permanente")).toBeNull();
  });

  // La protagonista della schermata è la storia di spacing, non il badge:
  // ogni promozione è un micro-insegnamento su perché la distribuzione nel
  // tempo funziona.
  it("mette in scena le quattro date dei richiami", async () => {
    await render(<CerimoniaPromozione cerimonia={cerimonia} onChiudi={jest.fn()} />);

    expect(screen.getByLabelText("Storia dei richiami")).toBeTruthy();
    expect(screen.getByText("12 mar")).toBeTruthy();
    expect(screen.getByText("3 apr")).toBeTruthy();
    expect(screen.getByText("15 giu")).toBeTruthy();
    expect(screen.getAllByText(/20 set/).length).toBeGreaterThan(0);
  });

  // Il numero grande è il tempo attraversato, perché è quello la cosa rara.
  it("il numero grande è i giorni fra il primo richiamo e l'ultimo", async () => {
    await render(<CerimoniaPromozione cerimonia={cerimonia} onChiudi={jest.fn()} />);
    expect(screen.getByText("192")).toBeTruthy();
    expect(screen.getByText("giorni fra il primo richiamo e l'ultimo")).toBeTruthy();
  });

  it("dice la frase scelta per quel concetto e il titolo", async () => {
    await render(<CerimoniaPromozione cerimonia={cerimonia} onChiudi={jest.fn()} />);
    expect(screen.getByText("Questo ora è tuo per sempre.")).toBeTruthy();
    expect(screen.getByText("Avversione alla perdita")).toBeTruthy();
  });

  it("con un solo richiamo in storia non inventa un intervallo", async () => {
    await render(
      <CerimoniaPromozione
        cerimonia={{ ...cerimonia, storia: ["2026-09-20T09:00:00.000Z"] }}
        onChiudi={jest.fn()}
      />
    );
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("si chiude, e si chiude una volta sola", async () => {
    const chiudi = jest.fn();
    await render(<CerimoniaPromozione cerimonia={cerimonia} onChiudi={chiudi} />);
    await fireEvent.press(screen.getByText("Continua"));
    expect(chiudi).toHaveBeenCalledTimes(1);
  });
});
