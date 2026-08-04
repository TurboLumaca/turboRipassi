/**
 * Test della Home: verifica il cablaggio fra Controller e View.
 *
 * Non ripete quello che ripassiLogic già garantisce (classificazione e
 * ordinamento sono testati là, sulla logica pura). Qui interessa che la
 * schermata mostri davvero ciò che il Controller le passa: le due sezioni, la
 * ricerca, i banner di stato, e che un tocco porti dove deve.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { RipassoCompleto } from "@/model/types";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

let mockRipassi: RipassoCompleto[] = [];
let mockUltimoEsito: { disponibili: number; falliti: number } | null = null;
const mockReload = jest.fn();
jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({
    ripassi: mockRipassi,
    loading: false,
    error: null,
    reload: mockReload,
    cache: { getLocalUri: jest.fn(), ultimoEsito: mockUltimoEsito },
  }),
}));

const mockSignOut = jest.fn();
jest.mock("@/controller/AuthContext", () => ({
  useAuthCtx: () => ({ signOut: mockSignOut }),
}));

let mockOnline = true;
jest.mock("@/controller/useConnettivita", () => ({
  useConnettivita: () => ({ online: mockOnline }),
}));

// Il pannello Drive ha una vita propria (carica l'account su richiesta) ed è
// fuori da ciò che questa schermata deve garantire.
jest.mock("@/view/components/PannelloDrive", () => ({
  PannelloDrive: () => null,
}));

import { HomeScreen } from "../HomeScreen";

function ripasso(over: Partial<RipassoCompleto> & { id: string }): RipassoCompleto {
  return {
    account_id: "a1",
    user_id: "u1",
    titolo: over.id,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    occorrenze: [],
    allegati: [],
    ...over,
  };
}

/** Un'occorrenza futura rende il ripasso "da fare". */
function futura() {
  return [
    {
      id: "occ",
      ripasso_id: "r",
      account_id: "a1",
      user_id: "u1",
      scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
      is_manual_1h: false,
      is_completed: false,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRipassi = [];
  mockUltimoEsito = null;
  mockOnline = true;
});

describe("HomeScreen", () => {
  it("mostra il messaggio di lista vuota quando non c'è nulla da fare", async () => {
    await render(<HomeScreen />);
    expect(screen.getByText(/Nessun ripasso da fare/)).toBeTruthy();
  });

  it("elenca i ripassi da fare con il conteggio dei completati", async () => {
    mockRipassi = [ripasso({ id: "r1", titolo: "Teorema di Bayes", occorrenze: futura() })];

    await render(<HomeScreen />);

    expect(screen.getByText("Teorema di Bayes")).toBeTruthy();
    expect(screen.getByText("0/1 completati")).toBeTruthy();
  });

  it("la ricerca filtra la lista", async () => {
    mockRipassi = [
      ripasso({ id: "r1", titolo: "Teorema di Bayes", occorrenze: futura() }),
      ripasso({ id: "r2", titolo: "Integrali", occorrenze: futura() }),
    ];

    await render(<HomeScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Cerca ripassi…"), "bayes");

    expect(screen.getByText("Teorema di Bayes")).toBeTruthy();
    expect(screen.queryByText("Integrali")).toBeNull();
  });

  it("apre la scheda del ripasso toccato", async () => {
    mockRipassi = [ripasso({ id: "r1", titolo: "Teorema di Bayes", occorrenze: futura() })];

    await render(<HomeScreen />);
    await fireEvent.press(screen.getByText("Teorema di Bayes"));

    expect(mockNavigate).toHaveBeenCalledWith("FormRipasso", { ripassoId: "r1" });
  });

  it("il pulsante di aggiunta apre il form senza id", async () => {
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByText("＋ Aggiungi ripasso"));
    expect(mockNavigate).toHaveBeenCalledWith("FormRipasso");
  });

  it("segnala l'assenza di connessione", async () => {
    mockOnline = false;
    await render(<HomeScreen />);
    expect(screen.getByText(/Sei offline/)).toBeTruthy();
  });

  it("avvisa quando parte del materiale non è disponibile offline", async () => {
    // La cache offline è una promessa silenziosa: quando non è stata
    // mantenuta, dirlo adesso è meglio che scoprirlo in treno.
    mockUltimoEsito = { disponibili: 3, falliti: 2 };

    await render(<HomeScreen />);

    expect(screen.getByText(/2 allegati .* non sono disponibili offline/)).toBeTruthy();
  });

  it("non avvisa nulla quando la cache è completa", async () => {
    mockUltimoEsito = { disponibili: 5, falliti: 0 };
    await render(<HomeScreen />);
    expect(screen.queryByText(/non sono disponibili offline/)).toBeNull();
  });
});
