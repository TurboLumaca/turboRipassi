import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PrimoPasso } from "../PrimoPasso";

describe("PrimoPasso", () => {
  it("senza una data da mostrare non disegna niente", async () => {
    await render(<PrimoPasso prossimoRichiamo={null} onChiudi={jest.fn()} />);
    expect(screen.queryByText(/Primo passo/)).toBeNull();
  });

  // Endowed progress onesto: il timbro regalato corrisponde a una cosa vera —
  // scrivere il concetto e incontrarlo *è* il primo incontro.
  it("dichiara un progresso vero, 1 su 4", async () => {
    const fra7 = new Date(Date.now() + 7 * 86_400_000).toISOString();
    await render(<PrimoPasso prossimoRichiamo={fra7} onChiudi={jest.fn()} />);

    expect(screen.getByText("Primo passo verso il Permanente")).toBeTruthy();
    expect(screen.getByText("Fatto: 1 richiamo su 4.")).toBeTruthy();
    expect(screen.getByText(/il tempo lavora per te/)).toBeTruthy();
  });

  it("l'unico gesto disponibile chiude e torna alla lista", async () => {
    const chiudi = jest.fn();
    const fra7 = new Date(Date.now() + 7 * 86_400_000).toISOString();
    await render(<PrimoPasso prossimoRichiamo={fra7} onChiudi={chiudi} />);
    await fireEvent.press(screen.getByText("Torna alla lista"));
    expect(chiudi).toHaveBeenCalledTimes(1);
  });
});
