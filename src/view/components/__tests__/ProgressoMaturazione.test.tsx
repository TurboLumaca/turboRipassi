import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ProgressoMaturazione } from "../ProgressoMaturazione";
import type { ProgressoMaturazione as Progresso } from "@/model/ripassi/capitaleMentaleLogic";

function progresso(over: Partial<Progresso> = {}): Progresso {
  return {
    richiami: 3,
    richiamiRichiesti: 4,
    giorni: 145,
    giorniRichiesti: 180,
    giorniOsservati: 140,
    livello: "consolidamento",
    attendeRichiamoFinale: false,
    storia: [],
    ...over,
  };
}

describe("ProgressoMaturazione", () => {
  it("mostra le due metà del countdown in chiaro", async () => {
    await render(<ProgressoMaturazione progresso={progresso()} />);
    expect(screen.getByText("3/4 richiami · 145/180 giorni")).toBeTruthy();
  });

  // Il messaggio più insolito e più vero della schermata.
  it("dice che il tempo lavora anche ad app chiusa", async () => {
    await render(<ProgressoMaturazione progresso={progresso()} />);
    expect(screen.getByText(/il tempo sta lavorando anche adesso/i)).toBeTruthy();
  });

  // Due barre piene accanto a un badge che non arriva sarebbe una bugia
  // detta con la grafica. Questo stato ha un nome e lo si dice.
  it("dice quando manca solo il richiamo finale", async () => {
    await render(
      <ProgressoMaturazione
        progresso={progresso({ richiami: 4, giorni: 200, attendeRichiamoFinale: true })}
      />
    );
    expect(screen.getByText(/manca un richiamo, adesso/i)).toBeTruthy();
  });

  // Un countdown che ha finito di misurare qualcosa non resta sullo schermo.
  it("sparisce su un concetto già permanente", async () => {
    await render(<ProgressoMaturazione progresso={progresso({ livello: "permanente" })} />);
    expect(screen.queryByText(/richiami/)).toBeNull();
  });

  it("in forma compatta tiene solo le tacche e la cifra", async () => {
    await render(<ProgressoMaturazione progresso={progresso()} compatto />);
    expect(screen.getByText("3/4 richiami · 145/180 giorni")).toBeTruthy();
    expect(screen.queryByText(/il tempo sta lavorando/i)).toBeNull();
  });

  it("non straborda quando i conteggi superano le soglie", async () => {
    await render(
      <ProgressoMaturazione progresso={progresso({ richiami: 9, giorni: 400 })} />
    );
    expect(screen.getByText("4/4 richiami · 180/180 giorni")).toBeTruthy();
  });
});
