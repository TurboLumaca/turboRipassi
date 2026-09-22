import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { Occorrenza, RipassoCompleto } from "@/model/types";

let mockRipassi: RipassoCompleto[] = [];
jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({ ripassi: mockRipassi }),
}));

import { PatrimonioGallery } from "../PatrimonioGallery";

const GIORNO = 86_400_000;
const ORA = Date.now();
const fa = (n: number) => new Date(ORA - n * GIORNO).toISOString();

function occ(scheduled_at: string, is_completed: boolean): Occorrenza {
  return {
    id: `o-${scheduled_at}-${String(is_completed)}`,
    ripasso_id: "r",
    account_id: "a1",
    user_id: "u1",
    scheduled_at,
    is_manual_1h: false,
    is_completed,
    created_at: scheduled_at,
    updated_at: scheduled_at,
  };
}

function ripasso(id: string, titolo: string, occorrenze: Occorrenza[]): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo,
    domanda: null,
    note: null,
    ceremony_shown_at: null,
    created_at: fa(400),
    updated_at: fa(400),
    occorrenze,
    allegati: [],
  };
}

const permanente = ripasso("r1", "Avversione alla perdita", [
  occ(fa(300), true),
  occ(fa(280), true),
  occ(fa(250), true),
  occ(fa(2), true),
]);
const acerbo = ripasso("r2", "Teorema di Bayes", [occ(fa(3), true)]);

describe("PatrimonioGallery", () => {
  beforeEach(() => {
    mockRipassi = [permanente, acerbo];
  });

  // La stessa dignità tipografica che i giochi riservano al drop leggendario,
  // applicata a un fatto: rara perché sei mesi sono sei mesi.
  it("mette la percentuale permanente come numero grande", async () => {
    await render(<PatrimonioGallery />);
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("1 concetto su 2")).toBeTruthy();
  });

  // L'ancora identitaria è il sapere posseduto, non una sequenza di giorni.
  it("dice chi si è diventati, non quanti giorni di fila si sono fatti", async () => {
    await render(<PatrimonioGallery />);
    expect(screen.getByText("Sai cose che non dimenticherai.")).toBeTruthy();
    expect(screen.queryByText(/giorni di fila|streak/i)).toBeNull();
  });

  it("elenca i permanenti con la data di promozione, e solo quelli", async () => {
    await render(<PatrimonioGallery />);
    expect(screen.getByText("Avversione alla perdita")).toBeTruthy();
    expect(screen.queryByText("Teorema di Bayes")).toBeNull();
    expect(screen.getByText(/Permanente dal/)).toBeTruthy();
  });

  // Guardare la storia di spacing non è una ricompensa da rigiocare: è un
  // fatto da consultare, e quindi si riapre quante volte si vuole.
  it("apre e richiude la storia di spacing al tocco", async () => {
    await render(<PatrimonioGallery />);
    const riga = screen.getByText("Avversione alla perdita");

    await fireEvent.press(riga);
    expect(screen.getAllByText(/\d+ [a-z]{3}/).length).toBeGreaterThan(1);

    await fireEvent.press(riga);
    expect(screen.getByText(/Permanente dal/)).toBeTruthy();
  });

  it("senza permanenti dice la verità invece di mostrare un vuoto", async () => {
    mockRipassi = [acerbo];
    await render(<PatrimonioGallery />);
    expect(screen.getByText(/Nessun concetto permanente, per ora/)).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
  });

  // Il canarino: se un giorno questa riga smette di salire mentre le sessioni
  // salgono, la missione sta fallendo anche se il prodotto cresce.
  it("mostra il rendimento formativo e il serbatoio in maturazione", async () => {
    await render(<PatrimonioGallery />);
    expect(screen.getByText("Rendimento formativo")).toBeTruthy();
    expect(screen.getByText(/promozioni per trimestre/)).toBeTruthy();
    expect(screen.getByText("1 concetto sta maturando.")).toBeTruthy();
  });
});
