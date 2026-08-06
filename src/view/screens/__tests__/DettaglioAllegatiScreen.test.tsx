/**
 * Test della schermata Allegati: elencare, rinominare, riordinare, eliminare.
 *
 * Le operazioni vivono in useAllegati ed è là che sono testate; qui interessa
 * che la schermata chieda la cosa giusta — l'ordine che nasce da una freccia,
 * il nome ripulito che esce dal modale, la conferma prima di eliminare — e che
 * un'apertura fallita non resti muta.
 */
import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { Allegato, RipassoCompleto } from "@/model/types";

jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({ params: { ripassoId: "r1" } }),
}));

let mockRipassi: RipassoCompleto[] = [];
const mockReload = jest.fn();
jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({ ripassi: mockRipassi, reload: mockReload }),
}));

let mockBusy = false;
const mockAggiungi = jest.fn();
const mockRinomina = jest.fn();
const mockRiordina = jest.fn();
const mockElimina = jest.fn();
const mockApri = jest.fn();
const mockRisolviUri = jest.fn();
jest.mock("@/controller/allegati/useAllegati", () => ({
  useAllegati: () => ({
    busy: mockBusy,
    aggiungi: mockAggiungi,
    rinomina: mockRinomina,
    riordina: mockRiordina,
    elimina: mockElimina,
    apri: mockApri,
    risolviUri: mockRisolviUri,
  }),
}));

const mockMostraErrore = jest.fn();
jest.mock("@/controller/avvisoErrore", () => ({
  mostraErrore: (...a: unknown[]) => mockMostraErrore(...a),
}));

import { DettaglioAllegatiScreen } from "../DettaglioAllegatiScreen";

function allegato(over: Partial<Allegato> & { id: string }): Allegato {
  return {
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    storage_path: `drive-${over.id}`,
    display_name: over.id,
    original_file_name: over.id,
    // Un PDF e non un'immagine: la miniatura di un'immagine risolverebbe
    // l'uri al mount, che qui non è quello che si sta verificando.
    mime_type: "application/pdf",
    size_bytes: 1024,
    order_index: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

/** Un ripasso con gli allegati dati, nell'ordine dato. */
function conAllegati(...allegati: Allegato[]) {
  mockRipassi = [
    {
      id: "r1",
      account_id: "a1",
      user_id: "u1",
      titolo: "Teorema di Bayes",
      note: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      occorrenze: [],
      allegati,
    },
  ];
}

/** Esegue l'azione dell'ultimo Alert con l'etichetta data. */
async function premiNellAvviso(etichetta: string) {
  const spy = Alert.alert as unknown as jest.Mock;
  const bottoni = spy.mock.calls[spy.mock.calls.length - 1][2] as {
    text: string;
    onPress?: () => void;
  }[];
  await bottoni.find((b) => b.text === etichetta)?.onPress?.();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRipassi = [];
  mockBusy = false;
  mockApri.mockResolvedValue({ tipo: "esterno" });
  mockRisolviUri.mockResolvedValue("file:///tmp/a.pdf");
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("DettaglioAllegatiScreen", () => {
  it("elenca gli allegati del ripasso", async () => {
    conAllegati(allegato({ id: "a1", display_name: "Appunti.pdf" }));

    await render(<DettaglioAllegatiScreen />);

    expect(screen.getByText("Appunti.pdf")).toBeTruthy();
  });

  it("dice come aggiungerne uno quando non ce ne sono", async () => {
    conAllegati();
    await render(<DettaglioAllegatiScreen />);
    expect(screen.getByText(/Nessun allegato/)).toBeTruthy();
  });

  // Un caricamento su Drive può durare secondi: senza questa riga la
  // schermata sembrerebbe ferma.
  it("segnala un caricamento in corso", async () => {
    mockBusy = true;
    conAllegati();

    await render(<DettaglioAllegatiScreen />);

    expect(screen.getByText("Caricamento in corso…")).toBeTruthy();
  });

  it("aggiunge in coda a quelli già presenti", async () => {
    conAllegati(allegato({ id: "a1" }), allegato({ id: "a2" }));

    await render(<DettaglioAllegatiScreen />);
    await fireEvent.press(screen.getByText("Galleria"));

    expect(mockAggiungi).toHaveBeenCalledWith(expect.any(Function), 2);
  });

  it("apre l'allegato toccato", async () => {
    const a = allegato({ id: "a1", display_name: "Appunti.pdf" });
    conAllegati(a);

    await render(<DettaglioAllegatiScreen />);
    await fireEvent.press(screen.getByText("Appunti.pdf"));

    expect(mockApri).toHaveBeenCalledWith(a);
  });

  // Un allegato può fallire su Drive, su Postgres o sul filesystem: senza
  // questo il tocco non produrrebbe niente e nemmeno una spiegazione.
  it("non lascia muta un'apertura fallita", async () => {
    conAllegati(allegato({ id: "a1", display_name: "Appunti.pdf" }));
    mockApri.mockRejectedValue(new Error("Drive API 404: {}"));

    await render(<DettaglioAllegatiScreen />);
    await fireEvent.press(screen.getByText("Appunti.pdf"));

    expect(mockMostraErrore).toHaveBeenCalledWith(expect.any(Error), "apriAllegato");
  });

  it("scambia con il successivo la freccia in giù", async () => {
    conAllegati(allegato({ id: "a1" }), allegato({ id: "a2" }));

    await render(<DettaglioAllegatiScreen />);
    await fireEvent.press(screen.getAllByText("▼")[0]);

    expect(mockRiordina).toHaveBeenCalledWith(["a2", "a1"]);
  });

  // Il primo non ha nessuno sopra di sé: la freccia non deve scrivere niente.
  it("non riordina oltre i due estremi", async () => {
    conAllegati(allegato({ id: "a1" }), allegato({ id: "a2" }));

    await render(<DettaglioAllegatiScreen />);
    await fireEvent.press(screen.getAllByText("▲")[0]);
    await fireEvent.press(screen.getAllByText("▼")[1]);

    expect(mockRiordina).not.toHaveBeenCalled();
  });

  it("rinomina con il nome ripulito dagli spazi", async () => {
    conAllegati(allegato({ id: "a1", display_name: "Appunti.pdf" }));

    await render(<DettaglioAllegatiScreen />);
    await fireEvent.press(screen.getByText("✎"));
    await fireEvent.changeText(screen.getByDisplayValue("Appunti.pdf"), "  Bayes.pdf  ");
    await fireEvent.press(screen.getByText("Salva"));

    expect(mockRinomina).toHaveBeenCalledWith("a1", "Bayes.pdf");
  });

  it("un nome vuoto non sovrascrive quello che c'era", async () => {
    conAllegati(allegato({ id: "a1", display_name: "Appunti.pdf" }));

    await render(<DettaglioAllegatiScreen />);
    await fireEvent.press(screen.getByText("✎"));
    await fireEvent.changeText(screen.getByDisplayValue("Appunti.pdf"), "   ");
    await fireEvent.press(screen.getByText("Salva"));

    expect(mockRinomina).not.toHaveBeenCalled();
  });

  it("annullare la rinomina non scrive niente", async () => {
    conAllegati(allegato({ id: "a1", display_name: "Appunti.pdf" }));

    await render(<DettaglioAllegatiScreen />);
    await fireEvent.press(screen.getByText("✎"));
    await fireEvent.press(screen.getByText("Annulla"));

    expect(mockRinomina).not.toHaveBeenCalled();
  });

  // L'eliminazione porta via anche il file su Drive: chiede conferma.
  it("elimina solo dopo conferma", async () => {
    const a = allegato({ id: "a1", display_name: "Appunti.pdf" });
    conAllegati(a);

    await render(<DettaglioAllegatiScreen />);
    await fireEvent.press(screen.getByText("🗑"));
    expect(mockElimina).not.toHaveBeenCalled();

    await premiNellAvviso("Elimina");
    expect(mockElimina).toHaveBeenCalledWith(a);
  });

  it("annullare l'eliminazione lascia l'allegato dov'è", async () => {
    conAllegati(allegato({ id: "a1", display_name: "Appunti.pdf" }));

    await render(<DettaglioAllegatiScreen />);
    await fireEvent.press(screen.getByText("🗑"));
    await premiNellAvviso("Annulla");

    expect(mockElimina).not.toHaveBeenCalled();
  });
});
