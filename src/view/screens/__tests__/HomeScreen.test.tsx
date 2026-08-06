/**
 * Test della Home: verifica il cablaggio fra Controller e View.
 *
 * Non ripete quello che ripassiLogic già garantisce (classificazione e
 * ordinamento sono testati là, sulla logica pura). Qui interessa che la
 * schermata mostri davvero ciò che il Controller le passa: le due schede, il
 * tondino, il filtro dello storico, la ricerca, i banner di stato, e che un
 * tocco porti dove deve.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { Occorrenza, RipassoCompleto } from "@/model/types";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

let mockRipassi: RipassoCompleto[] = [];
let mockUltimoEsito: { disponibili: number; falliti: number } | null = null;
let mockRitentando = false;
const mockReload = jest.fn();
const mockCompleta = jest.fn();
jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({
    ripassi: mockRipassi,
    loading: false,
    ritentando: mockRitentando,
    error: null,
    reload: mockReload,
    completaOccorrenza: mockCompleta,
    cache: { getLocalUri: jest.fn(), ultimoEsito: mockUltimoEsito },
  }),
}));

jest.mock("@/controller/AuthContext", () => ({
  useAuthCtx: () => ({ session: { user: { email: "tizio@example.com" } } }),
}));

let mockOnline = true;
jest.mock("@/controller/useConnettivita", () => ({
  useConnettivita: () => ({ online: mockOnline }),
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

function occ(over: Partial<Occorrenza> & { id: string; scheduled_at: string }): Occorrenza {
  return {
    ripasso_id: "r",
    account_id: "a1",
    user_id: "u1",
    is_manual_1h: false,
    is_completed: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

/** Un'occorrenza di domani: sta nella scheda "Ripassi". */
function futura(id = "occ") {
  return [occ({ id, scheduled_at: new Date(Date.now() + 86_400_000).toISOString() })];
}

/** Un'occorrenza di ieri: sta nello storico, completata o no. */
function passata(id: string, completata = false) {
  return [
    occ({
      id,
      scheduled_at: new Date(Date.now() - 86_400_000).toISOString(),
      is_completed: completata,
    }),
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRipassi = [];
  mockUltimoEsito = null;
  mockRitentando = false;
  mockOnline = true;
});

describe("HomeScreen", () => {
  it("mostra il messaggio di lista vuota quando non c'è nulla da fare", async () => {
    await render(<HomeScreen />);
    expect(screen.getByText("Nessun ripasso da fare")).toBeTruthy();
  });

  it("elenca un ripasso per ogni occorrenza da fare, con data e ora", async () => {
    mockRipassi = [
      ripasso({
        id: "r1",
        titolo: "Teorema di Bayes",
        occorrenze: [
          occ({ id: "o1", scheduled_at: new Date(2099, 7, 5, 11, 32).toISOString() }),
          occ({ id: "o2", scheduled_at: new Date(2099, 7, 6, 8, 13).toISOString() }),
        ],
      }),
    ];

    await render(<HomeScreen />);

    expect(screen.getAllByText("Teorema di Bayes")).toHaveLength(2);
    expect(screen.getByText("5 ago 2099")).toBeTruthy();
    expect(screen.getByText("11:32")).toBeTruthy();
  });

  // Il criterio dello storico è la data, non l'essere stato svolto.
  it("tiene fuori dalla lista principale i ripassi dei giorni passati", async () => {
    mockRipassi = [ripasso({ id: "r1", titolo: "Vecchio", occorrenze: passata("o1") })];

    await render(<HomeScreen />);

    expect(screen.queryByText("Vecchio")).toBeNull();
    expect(screen.getByText("Nessun ripasso da fare")).toBeTruthy();
  });

  it("la scheda Storico mostra i ripassi passati, completati e no", async () => {
    mockRipassi = [
      ripasso({ id: "r1", titolo: "Saltato", occorrenze: passata("o1") }),
      ripasso({ id: "r2", titolo: "Fatto", occorrenze: passata("o2", true) }),
    ];

    await render(<HomeScreen />);
    await fireEvent.press(screen.getByText("STORICO"));

    expect(screen.getByText("Saltato")).toBeTruthy();
    expect(screen.getByText("Fatto")).toBeTruthy();
  });

  it("il filtro dello storico lascia solo quelli da completare", async () => {
    mockRipassi = [
      ripasso({ id: "r1", titolo: "Saltato", occorrenze: passata("o1") }),
      ripasso({ id: "r2", titolo: "Fatto", occorrenze: passata("o2", true) }),
    ];

    await render(<HomeScreen />);
    await fireEvent.press(screen.getByText("STORICO"));
    await fireEvent.press(screen.getByText("Solo da completare"));

    expect(screen.getByText("Saltato")).toBeTruthy();
    expect(screen.queryByText("Fatto")).toBeNull();
  });

  it("il tondino segna l'occorrenza come completata", async () => {
    mockRipassi = [
      ripasso({ id: "r1", titolo: "Teorema di Bayes", occorrenze: futura("o1") }),
    ];

    await render(<HomeScreen />);
    await fireEvent.press(screen.getByLabelText("Segna come completato: Teorema di Bayes"));

    expect(mockCompleta).toHaveBeenCalledWith("o1", true);
  });

  it("il tondino già pieno riporta l'occorrenza a non completata", async () => {
    mockRipassi = [
      ripasso({
        id: "r1",
        titolo: "Teorema di Bayes",
        occorrenze: [
          occ({
            id: "o1",
            scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
            is_completed: true,
          }),
        ],
      }),
    ];

    await render(<HomeScreen />);
    await fireEvent.press(screen.getByLabelText("Segna come completato: Teorema di Bayes"));

    expect(mockCompleta).toHaveBeenCalledWith("o1", false);
  });

  it("la ricerca filtra la lista", async () => {
    mockRipassi = [
      ripasso({ id: "r1", titolo: "Teorema di Bayes", occorrenze: futura("o1") }),
      ripasso({ id: "r2", titolo: "Integrali", occorrenze: futura("o2") }),
    ];

    await render(<HomeScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Cerca ripassi…"), "bayes");

    expect(screen.getByText("Teorema di Bayes")).toBeTruthy();
    expect(screen.queryByText("Integrali")).toBeNull();
  });

  it("apre la scheda del ripasso toccato", async () => {
    mockRipassi = [
      ripasso({ id: "r1", titolo: "Teorema di Bayes", occorrenze: futura("o1") }),
    ];

    await render(<HomeScreen />);
    await fireEvent.press(screen.getByText("Teorema di Bayes"));

    expect(mockNavigate).toHaveBeenCalledWith("FormRipasso", { ripassoId: "r1" });
  });

  it("il pulsante di aggiunta apre il form senza id", async () => {
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByText("Aggiungi ripasso"));
    expect(mockNavigate).toHaveBeenCalledWith("FormRipasso");
  });

  /**
   * Account, Drive e l'uscita stanno dietro questo tondino: raggiungibili
   * senza cercarli, ma fuori dalla schermata che si apre venti volte al giorno.
   */
  it("il tondino in alto a destra porta al profilo", async () => {
    await render(<HomeScreen />);

    // L'iniziale dell'indirizzo: è l'unica cosa scritta nel tondino.
    expect(screen.getByText("T")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Profilo"));
    expect(mockNavigate).toHaveBeenCalledWith("Profilo");
  });

  it("apre e chiude la spiegazione «Come funziona?»", async () => {
    await render(<HomeScreen />);

    await fireEvent.press(screen.getByText("Come funziona?"));
    expect(screen.getByText(/TurboRipassi riporta a galla/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Chiudi"));
    expect(screen.queryByText(/TurboRipassi riporta a galla/)).toBeNull();
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

  // Un ritento dura secondi, con attese che raddoppiano: senza dirlo, l'app
  // sembra ferma e l'unica reazione sensata sarebbe toccare di nuovo.
  it("dice che sta riprovando invece di sembrare ferma", async () => {
    mockRitentando = true;
    await render(<HomeScreen />);
    expect(screen.getByText(/riprovo…/)).toBeTruthy();
  });

  it("non mostra niente sui ritenti quando non ce ne sono", async () => {
    await render(<HomeScreen />);
    expect(screen.queryByText(/riprovo…/)).toBeNull();
  });

  it("non avvisa nulla quando la cache è completa", async () => {
    mockUltimoEsito = { disponibili: 5, falliti: 0 };
    await render(<HomeScreen />);
    expect(screen.queryByText(/non sono disponibili offline/)).toBeNull();
  });
});
