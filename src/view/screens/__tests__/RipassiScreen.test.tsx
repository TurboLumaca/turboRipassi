/**
 * Test di TurboRipassi: verifica il cablaggio fra Controller e View.
 *
 * Non ripete quello che ripassiLogic già garantisce (raggruppamento e
 * ordinamento sono testati là, sulla logica pura). Qui interessa che la
 * schermata mostri davvero ciò che il Controller le passa: i gruppi di
 * scadenza, le due schede, il tondino, il filtro dello storico, la ricerca, i
 * banner di stato, e che un tocco porti dove deve.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { Occorrenza, RipassoCompleto } from "@/model/types";
import type { RipassoNonDisponibile } from "@/model/cache/cacheLogic";
import type { DaCaricare } from "@/model/outbox/codaLogic";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

let mockRipassi: RipassoCompleto[] = [];
let mockNonDisponibili: RipassoNonDisponibile[] = [];
let mockDaCaricare: DaCaricare[] = [];
let mockIdsInCoda = new Set<string>();
let mockRitentando = false;
const mockReload = jest.fn();
const mockCompleta = jest.fn();
const mockSincronizzaOra = jest.fn();
jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({
    ripassi: mockRipassi,
    loading: false,
    ritentando: mockRitentando,
    error: null,
    reload: mockReload,
    completaOccorrenza: mockCompleta,
    cache: {
      getLocalUri: jest.fn(),
      nonDisponibili: mockNonDisponibili,
    },
    coda: {
      voci: [],
      sincronizzando: false,
      bloccoDrive: false,
      accoda: jest.fn(),
      sincronizzaOra: mockSincronizzaOra,
      scarta: jest.fn(),
    },
    daCaricare: mockDaCaricare,
    idsInCoda: mockIdsInCoda,
  }),
}));

let mockOnline = true;
jest.mock("@/controller/useConnettivita", () => ({
  useConnettivita: () => ({ online: mockOnline }),
}));

import { RipassiScreen } from "../RipassiScreen";

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

/** Un'occorrenza di domani: sta in "Questa settimana". */
function futura(id = "occ") {
  return [occ({ id, scheduled_at: new Date(Date.now() + 86_400_000).toISOString() })];
}

/** Un'occorrenza di ieri: in ritardo se da fare, altrimenti solo nello storico. */
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
  mockNonDisponibili = [];
  mockDaCaricare = [];
  mockIdsInCoda = new Set();
  mockRitentando = false;
  mockOnline = true;
});

describe("RipassiScreen", () => {
  it("mostra il messaggio di lista vuota quando non c'è nulla da fare", async () => {
    await render(<RipassiScreen />);
    expect(screen.getByText("Nessun ripasso da fare")).toBeTruthy();
  });

  it("elenca un ripasso per ogni occorrenza da fare, con giorno e ora", async () => {
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

    await render(<RipassiScreen />);

    expect(screen.getAllByText("Teorema di Bayes")).toHaveLength(2);
    expect(screen.getByText("5 ago")).toBeTruthy();
    expect(screen.getByText("11:32")).toBeTruthy();
  });

  /**
   * La scadenza è la struttura della lista, non una colonna di testo: un
   * ripasso saltato è la prima cosa che la schermata deve dire.
   */
  it("raggruppa per scadenza e mette in cima quelli in ritardo", async () => {
    mockRipassi = [
      ripasso({ id: "r1", titolo: "Saltato", occorrenze: passata("o1") }),
      ripasso({ id: "r2", titolo: "Prossimo", occorrenze: futura("o2") }),
    ];

    await render(<RipassiScreen />);

    expect(screen.getByText("In ritardo")).toBeTruthy();
    expect(screen.getByText("Questa settimana")).toBeTruthy();
    expect(screen.getByText("Saltato")).toBeTruthy();
    expect(screen.getByText("Prossimo")).toBeTruthy();
  });

  it("non disegna intestazioni per i gruppi vuoti", async () => {
    mockRipassi = [ripasso({ id: "r1", titolo: "Prossimo", occorrenze: futura("o1") })];

    await render(<RipassiScreen />);

    expect(screen.queryByText("In ritardo")).toBeNull();
    expect(screen.queryByText("Oggi")).toBeNull();
  });

  // Un'occorrenza segnata come fatta non ha più una scadenza da mancare.
  it("toglie dalla lista principale ciò che è già stato completato", async () => {
    mockRipassi = [ripasso({ id: "r1", titolo: "Fatto", occorrenze: passata("o1", true) })];

    await render(<RipassiScreen />);

    expect(screen.queryByText("Fatto")).toBeNull();
    expect(screen.getByText("Nessun ripasso da fare")).toBeTruthy();
  });

  it("la scheda Storico mostra i ripassi passati, completati e no", async () => {
    mockRipassi = [
      ripasso({ id: "r1", titolo: "Saltato", occorrenze: passata("o1") }),
      ripasso({ id: "r2", titolo: "Fatto", occorrenze: passata("o2", true) }),
    ];

    await render(<RipassiScreen />);
    await fireEvent.press(screen.getByText("Storico"));

    expect(screen.getByText("Saltato")).toBeTruthy();
    expect(screen.getByText("Fatto")).toBeTruthy();
  });

  it("il filtro dello storico lascia solo quelli da completare", async () => {
    mockRipassi = [
      ripasso({ id: "r1", titolo: "Saltato", occorrenze: passata("o1") }),
      ripasso({ id: "r2", titolo: "Fatto", occorrenze: passata("o2", true) }),
    ];

    await render(<RipassiScreen />);
    await fireEvent.press(screen.getByText("Storico"));
    await fireEvent.press(screen.getByText("Solo da completare"));

    expect(screen.getByText("Saltato")).toBeTruthy();
    expect(screen.queryByText("Fatto")).toBeNull();
  });

  it("il tondino segna l'occorrenza come completata", async () => {
    mockRipassi = [
      ripasso({ id: "r1", titolo: "Teorema di Bayes", occorrenze: futura("o1") }),
    ];

    await render(<RipassiScreen />);
    await fireEvent.press(screen.getByLabelText("Segna come completato: Teorema di Bayes"));

    expect(mockCompleta).toHaveBeenCalledWith("o1", true);
  });

  it("il tondino già pieno riporta l'occorrenza a non completata", async () => {
    mockRipassi = [
      ripasso({
        id: "r1",
        titolo: "Teorema di Bayes",
        occorrenze: passata("o1", true),
      }),
    ];

    await render(<RipassiScreen />);
    await fireEvent.press(screen.getByText("Storico"));
    await fireEvent.press(screen.getByLabelText("Segna come completato: Teorema di Bayes"));

    expect(mockCompleta).toHaveBeenCalledWith("o1", false);
  });

  it("la ricerca filtra la lista", async () => {
    mockRipassi = [
      ripasso({ id: "r1", titolo: "Teorema di Bayes", occorrenze: futura("o1") }),
      ripasso({ id: "r2", titolo: "Integrali", occorrenze: futura("o2") }),
    ];

    await render(<RipassiScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Cerca fra i ripassi"), "bayes");

    expect(screen.getByText("Teorema di Bayes")).toBeTruthy();
    expect(screen.queryByText("Integrali")).toBeNull();
  });

  it("apre la scheda del ripasso toccato", async () => {
    mockRipassi = [
      ripasso({ id: "r1", titolo: "Teorema di Bayes", occorrenze: futura("o1") }),
    ];

    await render(<RipassiScreen />);
    await fireEvent.press(screen.getByText("Teorema di Bayes"));

    expect(mockNavigate).toHaveBeenCalledWith("FormRipasso", { ripassoId: "r1" });
  });

  it("il pulsante di aggiunta apre il form senza id", async () => {
    await render(<RipassiScreen />);
    await fireEvent.press(screen.getByText("Aggiungi ripasso"));
    expect(mockNavigate).toHaveBeenCalledWith("FormRipasso");
  });

  /**
   * Il pannello era sempre aperto in cima e spingeva la lista — cioè la cosa
   * per cui si apre la schermata — fuori dallo schermo.
   */
  it("«Come funziona?» parte chiuso e si apre al tocco", async () => {
    await render(<RipassiScreen />);

    expect(screen.queryByText(/TurboRipassi riporta a galla/)).toBeNull();

    await fireEvent.press(screen.getByText("Come funziona?"));
    expect(screen.getByText(/TurboRipassi riporta a galla/)).toBeTruthy();

    await fireEvent.press(screen.getByText("Come funziona?"));
    expect(screen.queryByText(/TurboRipassi riporta a galla/)).toBeNull();
  });

  it("segnala l'assenza di connessione", async () => {
    mockOnline = false;
    await render(<RipassiScreen />);
    expect(screen.getByText(/Sei offline/)).toBeTruthy();
  });

  it("dice QUALI ripassi non sono disponibili offline, non quanti", async () => {
    // La cache offline è una promessa silenziosa: quando non è stata
    // mantenuta, dirlo adesso è meglio che scoprirlo in treno. E un numero non
    // basta — chi sta per partire deve sapere quale ripasso aprire adesso.
    mockNonDisponibili = [
      { id: "r1", titolo: "Teorema di Bayes", mancanti: 2, totali: 3 },
    ];

    await render(<RipassiScreen />);

    expect(screen.getByText(/Teorema di Bayes/)).toBeTruthy();
    expect(screen.getByText(/1 ripasso .* non è disponibile offline/)).toBeTruthy();
  });

  // Un ritento dura secondi, con attese che raddoppiano: senza dirlo, l'app
  // sembra ferma e l'unica reazione sensata sarebbe toccare di nuovo.
  it("dice che sta riprovando invece di sembrare ferma", async () => {
    mockRitentando = true;
    await render(<RipassiScreen />);
    expect(screen.getByText(/riprovo…/)).toBeTruthy();
  });

  it("non mostra niente sui ritenti quando non ce ne sono", async () => {
    await render(<RipassiScreen />);
    expect(screen.queryByText(/riprovo…/)).toBeNull();
  });

  it("non avvisa nulla quando la cache è completa", async () => {
    await render(<RipassiScreen />);
    expect(screen.queryByText(/disponibil. offline/)).toBeNull();
  });

  it("elenca i ripassi non ancora su Drive, con cosa manca a ciascuno", async () => {
    mockDaCaricare = [
      {
        id: "r1",
        titolo: "Teorema di Bayes",
        allegatiMancanti: 2,
        ripassoNuovo: true,
        campiDaSalvare: false,
        bloccatoPer: null,
      },
    ];

    await render(<RipassiScreen />);

    expect(screen.getByText(/1 ripasso non è ancora su Google Drive/)).toBeTruthy();
    expect(screen.getByText(/Teorema di Bayes.*solo su questo dispositivo/)).toBeTruthy();
    expect(screen.getByText(/2 allegati da caricare/)).toBeTruthy();
  });

  it("non dice niente su Drive quando la coda è vuota", async () => {
    await render(<RipassiScreen />);
    expect(screen.queryByText(/non .* ancora su Google Drive/)).toBeNull();
  });

  // Il cerchietto scrive su una riga che non esiste ancora: rifiutare con una
  // spiegazione è la versione onesta di un errore di chiave esterna.
  it("non lascia spuntare un'occorrenza di un ripasso ancora in coda", async () => {
    mockRipassi = [ripasso({ id: "r1", occorrenze: futura() })];
    mockIdsInCoda = new Set(["r1"]);
    const avviso = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

    await render(<RipassiScreen />);
    void fireEvent.press(screen.getByLabelText(/Segna come completato/));

    expect(mockCompleta).not.toHaveBeenCalled();
    expect(avviso).toHaveBeenCalled();
  });

  it("con molti arretrati offre il pulsante per mostrare tutti gli arretrati e permette di riorganizzarli", async () => {
    const arretrati = Array.from({ length: 25 }, (_, i) =>
      ripasso({
        id: `r-${i}`,
        titolo: `Ripasso ${i}`,
        occorrenze: passata(`o-${i}`),
      })
    );
    mockRipassi = arretrati;

    await render(<RipassiScreen />);

    expect(screen.getByText("Mostra tutti gli arretrati")).toBeTruthy();

    await fireEvent.press(screen.getByText("Mostra tutti gli arretrati"));
    expect(screen.getByText("Riorganizza arretrati (Zero ansia)")).toBeTruthy();

    await fireEvent.press(screen.getByText("Riorganizza arretrati (Zero ansia)"));
    expect(screen.getByText("Mostra tutti gli arretrati")).toBeTruthy();
  });
});
