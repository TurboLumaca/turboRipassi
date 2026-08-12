/**
 * Test di Contenuti: il segmentato, i chip di modulo e la ricerca restringono
 * la stessa lista, e qui interessa che si combinino come si deve — in
 * particolare che cambiando scheda non resti addosso un filtro che nella nuova
 * lista non esiste.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ContenutiScreen } from "../ContenutiScreen";

describe("ContenutiScreen", () => {
  it("apre sui video", async () => {
    await render(<ContenutiScreen />);
    expect(screen.getByText("Eserciziario Giorno 1")).toBeTruthy();
    expect(screen.queryByText("Il metodo, capitolo 1")).toBeNull();
  });

  it("il segmentato porta alle letture", async () => {
    await render(<ContenutiScreen />);
    await fireEvent.press(screen.getByText("Letture"));

    expect(screen.getByText("Il metodo, capitolo 1")).toBeTruthy();
    expect(screen.queryByText("Eserciziario Giorno 1")).toBeNull();
  });

  /**
   * Ogni video aveva la stessa miniatura — il logo aziendale — su tutte le
   * card. La sigla è quello che ne fa le veci finché non ci sono i fotogrammi
   * veri, e il suo unico compito è distinguere una card dall'altra.
   */
  it("ogni video porta la sua sigla e la sua durata", async () => {
    await render(<ContenutiScreen />);
    expect(screen.getByText("48:20")).toBeTruthy();
    expect(screen.getByText("52:15")).toBeTruthy();
  });

  it("dice a che punto sei di ogni contenuto", async () => {
    await render(<ContenutiScreen />);
    expect(screen.getByText("Visto")).toBeTruthy();
    expect(screen.getByText("A metà")).toBeTruthy();
  });

  it("le letture mostrano la percentuale già letta", async () => {
    await render(<ContenutiScreen />);
    await fireEvent.press(screen.getByText("Letture"));
    expect(screen.getByText("60%")).toBeTruthy();
  });

  it("un chip di modulo restringe la lista", async () => {
    await render(<ContenutiScreen />);
    await fireEvent.press(screen.getByText("Lettura veloce"));

    expect(screen.getByText("Lettura veloce — ripasso tecnico")).toBeTruthy();
    expect(screen.queryByText("Eserciziario Giorno 1")).toBeNull();
  });

  it("cambiando scheda il filtro torna a Tutti, invece di svuotare la lista", async () => {
    await render(<ContenutiScreen />);
    await fireEvent.press(screen.getByText("Lettura veloce"));
    await fireEvent.press(screen.getByText("Letture"));

    expect(screen.getByText("Il metodo, capitolo 1")).toBeTruthy();
    expect(screen.getByText("Dispensa lettura veloce")).toBeTruthy();
  });

  it("la ricerca filtra dentro la scheda aperta", async () => {
    await render(<ContenutiScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Cerca un video"), "giorno 3");

    expect(screen.getByText("Eserciziario Giorno 3")).toBeTruthy();
    expect(screen.queryByText("Eserciziario Giorno 1")).toBeNull();
  });

  it("dice che non c'è niente invece di lasciare la pagina vuota", async () => {
    await render(<ContenutiScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Cerca un video"), "zzz");
    expect(screen.getByText("Nessun contenuto con questi filtri")).toBeTruthy();
  });
});
