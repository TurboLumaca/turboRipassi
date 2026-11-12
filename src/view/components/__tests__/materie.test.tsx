import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ChipMateria, FiltroMaterie, SelettoreMateria } from "../materie";
import type { Materia } from "@/model/types";

function materia(nome: string, colore = "#5AA9E6", id = nome): Materia {
  return {
    id,
    account_id: "a1",
    user_id: null,
    nome,
    colore,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

const fisica = materia("Fisica", "#5AA9E6");
const libri = materia("Libri", "#B38AF2");

describe("ChipMateria", () => {
  it("attivo si riempie del colore della materia", async () => {
    await render(<ChipMateria materia={fisica} />);
    expect(screen.getByLabelText("Materia: Fisica")).toHaveStyle({ backgroundColor: "#5AA9E6" });
  });

  it("senza onPress è un'etichetta, con onPress un pulsante", async () => {
    const onPress = jest.fn();
    await render(<ChipMateria materia={fisica} attiva={false} onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Materia Fisica" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("FiltroMaterie", () => {
  it("non disegna niente quando non ci sono materie", async () => {
    await render(<FiltroMaterie materie={[]} selezionata={null} onCambia={jest.fn()} />);
    expect(screen.queryByText("Tutte")).toBeNull();
  });

  it("sceglie una materia", async () => {
    const onCambia = jest.fn();
    await render(<FiltroMaterie materie={[fisica, libri]} selezionata={null} onCambia={onCambia} />);
    await fireEvent.press(screen.getByText("Libri"));
    expect(onCambia).toHaveBeenCalledWith("Libri");
  });

  it("toccare di nuovo la materia scelta toglie il filtro", async () => {
    const onCambia = jest.fn();
    await render(
      <FiltroMaterie materie={[fisica, libri]} selezionata="Libri" onCambia={onCambia} />
    );
    await fireEvent.press(screen.getByText("Libri"));
    expect(onCambia).toHaveBeenCalledWith(null);
  });

  it("«Tutte» toglie il filtro", async () => {
    const onCambia = jest.fn();
    await render(
      <FiltroMaterie materie={[fisica, libri]} selezionata="Fisica" onCambia={onCambia} />
    );
    await fireEvent.press(screen.getByText("Tutte"));
    expect(onCambia).toHaveBeenCalledWith(null);
  });
});

describe("SelettoreMateria", () => {
  it("sceglie e toglie la materia", async () => {
    const onCambia = jest.fn();
    const { rerender } = await render(
      <SelettoreMateria
        materie={[fisica]}
        valore={null}
        onCambia={onCambia}
        onCrea={jest.fn()}
      />
    );
    await fireEvent.press(screen.getByText("Fisica"));
    expect(onCambia).toHaveBeenLastCalledWith("Fisica");

    await rerender(
      <SelettoreMateria
        materie={[fisica]}
        valore="Fisica"
        onCambia={onCambia}
        onCrea={jest.fn()}
      />
    );
    await fireEvent.press(screen.getByText("Fisica"));
    expect(onCambia).toHaveBeenLastCalledWith(null);
  });

  it("crea una materia nuova e la sceglie subito", async () => {
    const onCambia = jest.fn();
    const onCrea = jest.fn().mockResolvedValue(materia("Chimica", "#4E9C7C", "c1"));
    await render(
      <SelettoreMateria materie={[fisica]} valore={null} onCambia={onCambia} onCrea={onCrea} />
    );

    await fireEvent.press(screen.getByLabelText("Nuova materia"));
    await fireEvent.changeText(screen.getByPlaceholderText("Nome della materia"), "Chimica");
    await fireEvent.press(screen.getByLabelText("Aggiungi materia"));

    await waitFor(() => expect(onCambia).toHaveBeenCalledWith("c1"));
    expect(onCrea).toHaveBeenCalledWith("Chimica");
    // Il campo si richiude.
    expect(screen.queryByPlaceholderText("Nome della materia")).toBeNull();
  });

  it("mostra il motivo se la creazione non riesce e tiene il nome scritto", async () => {
    const onCambia = jest.fn();
    const onCrea = jest.fn().mockRejectedValue(new Error("Esiste già una materia con questo nome."));
    await render(
      <SelettoreMateria materie={[fisica]} valore={null} onCambia={onCambia} onCrea={onCrea} />
    );

    await fireEvent.press(screen.getByLabelText("Nuova materia"));
    await fireEvent.changeText(screen.getByPlaceholderText("Nome della materia"), "Fisica");
    await fireEvent.press(screen.getByLabelText("Aggiungi materia"));

    expect(await screen.findByText("Esiste già una materia con questo nome.")).toBeTruthy();
    expect(onCambia).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Fisica")).toBeTruthy();
  });

  it("Annulla chiude il campo senza creare niente", async () => {
    const onCrea = jest.fn();
    await render(
      <SelettoreMateria materie={[]} valore={null} onCambia={jest.fn()} onCrea={onCrea} />
    );
    await fireEvent.press(screen.getByLabelText("Nuova materia"));
    await fireEvent.press(screen.getByLabelText("Annulla nuova materia"));

    expect(screen.queryByPlaceholderText("Nome della materia")).toBeNull();
    expect(onCrea).not.toHaveBeenCalled();
  });
});
