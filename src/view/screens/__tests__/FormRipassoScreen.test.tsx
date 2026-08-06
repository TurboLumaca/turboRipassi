/**
 * Test del form del ripasso: la schermata da cui passano creazione, modifica,
 * eliminazione e gli allegati scelti prima che il ripasso esista.
 *
 * L'orchestrazione del salvataggio vive in useFormRipasso ed è testata là:
 * qui la si sostituisce con un doppio, e si verifica cosa la schermata mostra
 * e cosa parte al tocco — chi chiude la schermata, cosa chiede conferma, e che
 * nessuna scrittura fallita resti muta.
 */
import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { Occorrenza } from "@/model/types";
import type { StatoFormRipasso } from "@/controller/ripassi/useFormRipasso";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams: { ripassoId?: string } | undefined;
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockParams }),
}));

const mockCompleta = jest.fn();
const mockSposta = jest.fn();
jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({ completaOccorrenza: mockCompleta, spostaOccorrenza: mockSposta }),
}));

let mockForm: StatoFormRipasso;
jest.mock("@/controller/ripassi/useFormRipasso", () => ({
  useFormRipasso: () => mockForm,
}));

const mockApriUriLocale = jest.fn();
jest.mock("@/controller/allegati/fileDispositivo", () => ({
  apriUriLocale: (...a: unknown[]) => mockApriUriLocale(...a),
  scegliDaFotocamera: jest.fn(),
  scegliDaGalleria: jest.fn(),
  scegliDocumento: jest.fn(),
}));

const mockMostraErrore = jest.fn();
jest.mock("@/controller/avvisoErrore", () => ({
  mostraErrore: (...a: unknown[]) => mockMostraErrore(...a),
}));

import { FormRipassoScreen } from "../FormRipassoScreen";

function occ(over: Partial<Occorrenza> & { id: string; scheduled_at: string }): Occorrenza {
  return {
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    is_manual_1h: false,
    is_completed: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

/** Il ripasso in modifica, con le occorrenze e gli allegati dati. */
function ripassoCorrente(over: Partial<StatoFormRipasso["corrente"]> = {}) {
  return {
    id: "r1",
    account_id: "a1",
    user_id: "u1",
    titolo: "Teorema di Bayes",
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    occorrenze: [],
    allegati: [],
    ...over,
  } as NonNullable<StatoFormRipasso["corrente"]>;
}

/** Passa il form in modifica su un ripasso esistente. */
function inModifica(corrente = ripassoCorrente()) {
  mockParams = { ripassoId: "r1" };
  mockForm = { ...mockForm, editId: "r1", isEdit: true, corrente };
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
  mockParams = undefined;
  mockApriUriLocale.mockResolvedValue({ tipo: "esterno" });
  mockCompleta.mockResolvedValue(undefined);
  mockSposta.mockResolvedValue(undefined);
  jest.spyOn(Alert, "alert").mockImplementation(() => {});

  mockForm = {
    editId: null,
    isEdit: false,
    corrente: null,
    titolo: "",
    setTitolo: jest.fn(),
    note: "",
    setNote: jest.fn(),
    includi1h: false,
    setIncludi1h: jest.fn(),
    inAttesa: [],
    aggiungiAllegato: jest.fn().mockResolvedValue(undefined),
    rimuoviInAttesa: jest.fn(),
    risolviUri: jest.fn().mockResolvedValue("file:///tmp/a.pdf"),
    anteprima: [],
    saving: false,
    busy: false,
    ritentando: false,
    salva: jest.fn().mockResolvedValue(true),
    elimina: jest.fn().mockResolvedValue(true),
  };
});

describe("creazione", () => {
  it("offre di creare, non di salvare modifiche", async () => {
    await render(<FormRipassoScreen />);

    expect(screen.getByText("Crea ripasso")).toBeTruthy();
    expect(screen.queryByText("Elimina ripasso")).toBeNull();
  });

  it("scrive titolo e note nel Controller", async () => {
    await render(<FormRipassoScreen />);

    await fireEvent.changeText(
      screen.getByPlaceholderText("Es. Teorema di Bayes"),
      "Teorema di Bayes"
    );
    await fireEvent.changeText(screen.getByPlaceholderText("Testo libero…"), "Capitolo 3");

    expect(mockForm.setTitolo).toHaveBeenCalledWith("Teorema di Bayes");
    expect(mockForm.setNote).toHaveBeenCalledWith("Capitolo 3");
  });

  // Il +1 ora esiste solo alla creazione: su un ripasso già programmato non
  // avrebbe niente da aggiungere.
  it("mostra il +1 ora solo qui", async () => {
    await render(<FormRipassoScreen />);
    expect(screen.getByText("Aggiungi ripasso +1 ora")).toBeTruthy();

    inModifica();
    await render(<FormRipassoScreen />);
    expect(screen.queryByText("Aggiungi ripasso +1 ora")).toBeNull();
  });

  it("chiude la schermata quando il salvataggio è completo", async () => {
    await render(<FormRipassoScreen />);

    await fireEvent.press(screen.getByText("Crea ripasso"));

    expect(mockForm.salva).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  // Il Controller risponde false anche quando il ripasso è salvato ma un
  // allegato no: la schermata deve restare aperta, o i file scelti sparirebbero.
  it("resta aperta quando il Controller dice che non ha finito", async () => {
    (mockForm.salva as jest.Mock).mockResolvedValue(false);
    await render(<FormRipassoScreen />);

    await fireEvent.press(screen.getByText("Crea ripasso"));

    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it("dice quanti allegati partiranno al salvataggio", async () => {
    mockForm.inAttesa = [
      { chiave: "attesa-0", file: { uri: "file:///a.pdf", name: "Appunti.pdf", mimeType: "application/pdf", size: 10 } },
    ];

    await render(<FormRipassoScreen />);

    expect(screen.getByText("1 allegato verrà caricato al salvataggio.")).toBeTruthy();
  });

  it("toglie dalla lista un allegato scelto per sbaglio", async () => {
    mockForm.inAttesa = [
      { chiave: "attesa-0", file: { uri: "file:///a.pdf", name: "Appunti.pdf", mimeType: "application/pdf", size: 10 } },
    ];

    await render(<FormRipassoScreen />);
    await fireEvent.press(screen.getByText("✕"));

    expect(mockForm.rimuoviInAttesa).toHaveBeenCalledWith("attesa-0");
  });
});

describe("modifica", () => {
  it("offre di salvare le modifiche e di eliminare", async () => {
    inModifica();
    await render(<FormRipassoScreen />);

    expect(screen.getByText("Salva modifiche")).toBeTruthy();
    expect(screen.getByText("Elimina ripasso")).toBeTruthy();
  });

  // Elimina porta via occorrenze e allegati: un tocco solo non basta.
  it("elimina solo dopo conferma, poi chiude", async () => {
    inModifica();
    await render(<FormRipassoScreen />);

    await fireEvent.press(screen.getByText("Elimina ripasso"));
    expect(mockForm.elimina).not.toHaveBeenCalled();

    await premiNellAvviso("Elimina");
    expect(mockForm.elimina).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("un'eliminazione fallita lascia la schermata aperta", async () => {
    inModifica();
    (mockForm.elimina as jest.Mock).mockResolvedValue(false);
    await render(<FormRipassoScreen />);

    await fireEvent.press(screen.getByText("Elimina ripasso"));
    await premiNellAvviso("Elimina");

    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it("porta al dettaglio allegati quando ce n'è almeno uno", async () => {
    inModifica(
      ripassoCorrente({
        allegati: [
          {
            id: "a1",
            ripasso_id: "r1",
            account_id: "a1",
            user_id: "u1",
            storage_path: "drive-a1",
            display_name: "Appunti.pdf",
            original_file_name: "Appunti.pdf",
            mime_type: "application/pdf",
            size_bytes: 10,
            order_index: 0,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      })
    );
    await render(<FormRipassoScreen />);

    await fireEvent.press(screen.getByText("Rinomina, riordina o elimina ›"));

    expect(mockNavigate).toHaveBeenCalledWith("DettaglioAllegati", { ripassoId: "r1" });
  });

  it("non offre quel passaggio quando non ci sono allegati", async () => {
    inModifica();
    await render(<FormRipassoScreen />);
    expect(screen.queryByText("Rinomina, riordina o elimina ›")).toBeNull();
  });
});

describe("allegati", () => {
  it("segnala il caricamento in corso su Drive", async () => {
    mockForm.busy = true;
    await render(<FormRipassoScreen />);
    expect(screen.getByText("Caricamento su Google Drive…")).toBeTruthy();
  });

  // Il ritento ha attese che raddoppiano: senza dirlo, il pulsante che gira
  // sembrerebbe girare a vuoto.
  it("dice che sta riprovando invece di sembrare fermo", async () => {
    mockForm.ritentando = true;
    await render(<FormRipassoScreen />);
    expect(screen.getByText(/riprovo…/)).toBeTruthy();
  });

  it("apre l'allegato toccato", async () => {
    mockForm.inAttesa = [
      { chiave: "attesa-0", file: { uri: "file:///a.pdf", name: "Appunti.pdf", mimeType: "application/pdf", size: 10 } },
    ];

    await render(<FormRipassoScreen />);
    await fireEvent.press(screen.getByText("Appunti.pdf"));

    expect(mockApriUriLocale).toHaveBeenCalledWith("file:///a.pdf", "application/pdf");
  });

  it("non lascia muta un'apertura fallita", async () => {
    mockForm.inAttesa = [
      { chiave: "attesa-0", file: { uri: "file:///a.pdf", name: "Appunti.pdf", mimeType: "application/pdf", size: 10 } },
    ];
    mockApriUriLocale.mockRejectedValue(new Error("no activity found"));

    await render(<FormRipassoScreen />);
    await fireEvent.press(screen.getByText("Appunti.pdf"));

    expect(mockMostraErrore).toHaveBeenCalledWith(expect.any(Error), "apriAllegato");
  });

  it("passa il file scelto al Controller", async () => {
    await render(<FormRipassoScreen />);
    await fireEvent.press(screen.getByText("Foto"));
    expect(mockForm.aggiungiAllegato).toHaveBeenCalledWith(expect.any(Function));
  });
});

describe("le occorrenze già programmate", () => {
  const PROGRAMMATA = occ({ id: "o1", scheduled_at: "2099-03-10T09:00:00.000Z" });

  it("segna completata l'occorrenza aperta", async () => {
    inModifica(ripassoCorrente({ occorrenze: [PROGRAMMATA] }));
    await render(<FormRipassoScreen />);

    await fireEvent.press(screen.getByText("✎"));
    await fireEvent.press(screen.getByText("Segna completata"));

    expect(mockCompleta).toHaveBeenCalledWith("o1", true);
  });

  it("sposta la data scelta nel calendario", async () => {
    inModifica(ripassoCorrente({ occorrenze: [PROGRAMMATA] }));
    await render(<FormRipassoScreen />);

    await fireEvent.press(screen.getByText("✎"));
    await fireEvent.press(screen.getAllByText("20")[0]);
    await fireEvent.press(screen.getByText("Salva data"));

    expect(mockSposta).toHaveBeenCalledTimes(1);
    const [id, data] = mockSposta.mock.calls[0];
    expect(id).toBe("o1");
    expect((data as Date).getDate()).toBe(20);
  });

  /**
   * Il modale si chiude comunque: senza questo avviso la data a schermo
   * resterebbe quella di prima, e non ci sarebbe modo di distinguere «non ha
   * funzionato» da «non ho premuto bene».
   */
  it("non lascia muto uno spostamento fallito", async () => {
    inModifica(ripassoCorrente({ occorrenze: [PROGRAMMATA] }));
    mockSposta.mockRejectedValue(new Error("Network request failed"));
    await render(<FormRipassoScreen />);

    await fireEvent.press(screen.getByText("✎"));
    await fireEvent.press(screen.getAllByText("20")[0]);
    await fireEvent.press(screen.getByText("Salva data"));

    expect(mockMostraErrore).toHaveBeenCalledWith(
      expect.any(Error),
      "spostaOccorrenza",
      expect.objectContaining({ occorrenzaId: "o1" })
    );
  });
});
