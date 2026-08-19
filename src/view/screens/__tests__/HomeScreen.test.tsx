/**
 * Test della Home: la sola schermata che si riscrive a ogni fase.
 *
 * Quello che va protetto qui non è l'aspetto ma la regola che lo decide: la
 * batteria esiste prima del corso e sparisce quando comincia, l'ospite vede
 * l'offerta e non il percorso, e il numero dei ripassi in scadenza viene dalla
 * lista vera e non da un dato di esempio.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ContestoPercorso } from "@/controller/PercorsoContext";
import type { Occorrenza, RipassoCompleto } from "@/model/types";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

let mockPercorso: ContestoPercorso;
jest.mock("@/controller/PercorsoContext", () => ({
  usePercorso: () => mockPercorso,
}));

let mockRipassi: RipassoCompleto[] = [];
let mockPausa = { attiva: false };
const mockRiprendiPausa = jest.fn();
jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({
    ripassi: mockRipassi,
    pausa: mockPausa,
    riprendiPausa: mockRiprendiPausa,
  }),
}));

import { HomeScreen } from "../HomeScreen";

function contesto(over: Partial<ContestoPercorso>): ContestoPercorso {
  return {
    pronto: true,
    fase: "pre",
    giorno: 0,
    giorniAllInizio: 12,
    settimaneDalCorso: 0,
    iscrizione: { inizio: "2026-09-12", sede: "Rimini", tutor: "Antonio Colucci" },
    padronanze: {},
    batteria: 0,
    lingua: "Inglese",
    programma: null,
    registraSessione: jest.fn(),
    scegliLingua: jest.fn(),
    scegliProgramma: jest.fn(),
    impostaIscrizione: jest.fn(),
    ...over,
  };
}

/** Un'occorrenza di oggi, non completata: conta fra quelle in scadenza. */
function inScadenza(id: string): RipassoCompleto {
  const occorrenza: Occorrenza = {
    id,
    ripasso_id: id,
    account_id: "a",
    user_id: "u",
    scheduled_at: new Date().toISOString(),
    is_manual_1h: false,
    is_completed: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  return {
    id,
    account_id: "a",
    user_id: "u",
    titolo: id,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    occorrenze: [occorrenza],
    allegati: [],
  };
}

const vaiA = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockRipassi = [];
  mockPausa = { attiva: false };
  mockPercorso = contesto({});
});

describe("Home — fase pre", () => {
  it("apre sulla batteria e su quanto manca all'inizio", async () => {
    mockPercorso = contesto({ fase: "pre", batteria: 70, giorniAllInizio: 12 });
    await render(<HomeScreen onVaiA={vaiA} />);

    expect(screen.getByText("Prima del corso")).toBeTruthy();
    expect(screen.getByText("Inizio fra 12 giorni")).toBeTruthy();
    expect(screen.getByLabelText("Batteria al 70 per cento")).toBeTruthy();
  });

  it("propone i due allenamenti che caricano la batteria, con le tacche fatte", async () => {
    mockPercorso = contesto({ fase: "pre", padronanze: { fonetica: 4 } });
    await render(<HomeScreen onVaiA={vaiA} />);

    expect(screen.getByText("Conversione fonetica")).toBeTruthy();
    expect(screen.getByText("Schedario mentale")).toBeTruthy();
    expect(screen.getByText(/4\/5 tacche/)).toBeTruthy();
  });

  it("il pulsante principale porta agli allenamenti", async () => {
    await render(<HomeScreen onVaiA={vaiA} />);
    await fireEvent.press(screen.getByText("Continua ad allenarti"));
    expect(vaiA).toHaveBeenCalledWith("allenati");
  });
});

describe("Home — fase durante", () => {
  it("sostituisce la batteria con il giorno di corso", async () => {
    mockPercorso = contesto({ fase: "durante", giorno: 7, batteria: 70 });
    await render(<HomeScreen onVaiA={vaiA} />);

    expect(screen.getByText("Giorno 7 di 21")).toBeTruthy();
    expect(screen.queryByLabelText(/Batteria/)).toBeNull();
  });

  it("mostra l'aula quando la sede è nota", async () => {
    mockPercorso = contesto({ fase: "durante", giorno: 7 });
    await render(<HomeScreen onVaiA={vaiA} />);
    expect(screen.getByText("Aula Rimini")).toBeTruthy();
  });
});

describe("Home — fase post", () => {
  it("passa al piano di mantenimento, senza batteria", async () => {
    mockPercorso = contesto({ fase: "post", giorno: 30, settimaneDalCorso: 6, batteria: 100 });
    await render(<HomeScreen onVaiA={vaiA} />);

    expect(screen.getByText("Settimana 6 dal corso")).toBeTruthy();
    expect(screen.queryByLabelText(/Batteria/)).toBeNull();
  });

  it("non mostra il prossimo appuntamento: il corso è finito", async () => {
    mockPercorso = contesto({ fase: "post", giorno: 30 });
    await render(<HomeScreen onVaiA={vaiA} />);
    expect(screen.queryByText("Prossimo appuntamento")).toBeNull();
  });
});

describe("Home — ospite", () => {
  beforeEach(() => {
    mockPercorso = contesto({ fase: "ospite", iscrizione: { inizio: null } });
  });

  it("apre sul metodo e sull'azienda, non su un modulo", async () => {
    await render(<HomeScreen onVaiA={vaiA} />);
    expect(screen.getByText(/Impara a studiare/)).toBeTruthy();
    expect(screen.getByText("Scopri il corso")).toBeTruthy();
  });

  it("offre i ripassi come cosa già utilizzabile", async () => {
    await render(<HomeScreen onVaiA={vaiA} />);

    expect(screen.getByText("Libero, senza corso")).toBeTruthy();
    await fireEvent.press(screen.getByText("Aggiungi il primo ripasso"));
    expect(vaiA).toHaveBeenCalledWith("ripassa");
  });

  it("elenca cosa aggiunge il corso, con i nomi veri delle sezioni", async () => {
    await render(<HomeScreen onVaiA={vaiA} />);
    expect(screen.getByText(/18 allenamenti guidati/)).toBeTruthy();
    expect(screen.getByText(/Flashcard — 12 lingue/)).toBeTruthy();
  });

  it("non mostra né il tutor né la lista di oggi", async () => {
    await render(<HomeScreen onVaiA={vaiA} />);
    expect(screen.queryByText("Il tuo tutor")).toBeNull();
    expect(screen.queryByText("Oggi")).toBeNull();
  });
});

describe("Home — ripassi in scadenza", () => {
  it("conta quelli veri, presi dalla lista del Controller", async () => {
    mockRipassi = [inScadenza("r1"), inScadenza("r2")];
    await render(<HomeScreen onVaiA={vaiA} />);

    expect(screen.getByText("2 ripassi in scadenza")).toBeTruthy();
  });

  it("usa il singolare quando ce n'è uno solo", async () => {
    mockRipassi = [inScadenza("r1")];
    await render(<HomeScreen onVaiA={vaiA} />);
    expect(screen.getByText("1 ripasso in scadenza")).toBeTruthy();
  });

  it("non dice niente quando non ce ne sono", async () => {
    await render(<HomeScreen onVaiA={vaiA} />);
    expect(screen.queryByText(/ripass. in scadenza/)).toBeNull();
  });

  it("la riga porta alla scheda TurboRipassi", async () => {
    mockRipassi = [inScadenza("r1")];
    await render(<HomeScreen onVaiA={vaiA} />);
    await fireEvent.press(screen.getByText("1 ripasso in scadenza"));
    expect(vaiA).toHaveBeenCalledWith("ripassa");
  });
});

describe("Home — tutor", () => {
  it("mostra volto e nome, e non offre più di chiamarlo", async () => {
    await render(<HomeScreen onVaiA={vaiA} />);

    expect(screen.getByText("Antonio Colucci")).toBeTruthy();
    expect(screen.getByText("Tutor · sede di Rimini")).toBeTruthy();
    expect(screen.queryByText("Chiamami")).toBeNull();
  });

  it("dice che il tutor non c'è ancora invece di lasciare il posto vuoto", async () => {
    mockPercorso = contesto({ iscrizione: { inizio: "2026-09-12" } });
    await render(<HomeScreen onVaiA={vaiA} />);
    expect(screen.getByText("Tutor da assegnare")).toBeTruthy();
  });
});

describe("Home — modalità riposo", () => {
  it("mostra il banner di riposo quando la pausa è attiva e offre la ripresa", async () => {
    mockPausa = { attiva: true };
    await render(<HomeScreen onVaiA={vaiA} />);

    expect(screen.getByText("Modalità Riposo")).toBeTruthy();
    expect(screen.getByText("I tuoi progressi sono al sicuro")).toBeTruthy();
    expect(screen.getByText("Riprendi prima del previsto")).toBeTruthy();

    await fireEvent.press(screen.getByText("Riprendi prima del previsto"));
    expect(mockRiprendiPausa).toHaveBeenCalledTimes(1);
  });

  it("nasconde la riga dei ripassi quando la pausa è attiva", async () => {
    mockPausa = { attiva: true };
    mockRipassi = [inScadenza("r1")];
    await render(<HomeScreen onVaiA={vaiA} />);

    expect(screen.queryByText(/ripass. in scadenza/)).toBeNull();
  });
});

describe("Home — Zero Senso di Colpa (framing positivo)", () => {
  it("mostra la nota 'Focus di oggi' e nessun linguaggio punitivo o allarmante", async () => {
    mockRipassi = [inScadenza("r1")];
    await render(<HomeScreen onVaiA={vaiA} />);

    expect(screen.getByText("Focus di oggi")).toBeTruthy();
    expect(screen.queryByText(/FALLITO|SCADUTI|DEBITO/i)).toBeNull();
  });
});
