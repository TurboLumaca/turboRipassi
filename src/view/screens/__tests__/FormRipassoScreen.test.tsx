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
    domanda: null,
    ceremony_shown_at: null,
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
    inCoda: false,
    corrente: null,
    titolo: "",
    setTitolo: jest.fn(),
    domanda: "",
    setDomanda: jest.fn(),
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
    primoPasso: null,
    chiudiPrimoPasso: jest.fn(),
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
    await fireEvent.changeText(
      screen.getByPlaceholderText("Testo libero… (usa *testo* per il grassetto)"),
      "Capitolo 3"
    );

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

/**
 * Il richiamo comincia da qui: se la domanda non si scrive mentre si scrive
 * il concetto, la lista non ha niente da chiedere e la spunta torna a essere
 * un promemoria.
 */
describe("la domanda del richiamo", () => {
  it("offre un campo separato dalle note, con il suo perché", async () => {
    await render(<FormRipassoScreen />);

    expect(screen.getByText("Domanda")).toBeTruthy();
    expect(screen.getByText("Risposta e note")).toBeTruthy();
    expect(screen.getByText(/mostra questa e mai la risposta/)).toBeTruthy();
  });

  it("riporta al Controller quel che si scrive", async () => {
    await render(<FormRipassoScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText(/Perché la perdita pesa/),
      "Perché ~2,25?"
    );
    expect(mockForm.setDomanda).toHaveBeenCalledWith("Perché ~2,25?");
  });
});

describe("maturazione e primo passo", () => {
  // Il countdown onesto: due metà, e quella dei giorni avanza da sola.
  it("in modifica mostra quanto manca al Permanente", async () => {
    inModifica(
      ripassoCorrente({
        occorrenze: [
          occ({ id: "o1", scheduled_at: "2026-03-01T09:00:00.000Z", is_completed: true }),
          occ({ id: "o2", scheduled_at: "2026-04-01T09:00:00.000Z", is_completed: true }),
        ],
      })
    );

    await render(<FormRipassoScreen />);
    expect(screen.getByText("Maturazione")).toBeTruthy();
    expect(screen.getByText(/richiami ·/)).toBeTruthy();
  });

  it("in creazione non c'è ancora niente da far maturare", async () => {
    await render(<FormRipassoScreen />);
    expect(screen.queryByText("Maturazione")).toBeNull();
  });

  // Endowed progress: il messaggio arriva dopo il salvataggio, e la
  // schermata si chiude solo quando è stato letto.
  it("mostra il primo passo e chiude solo quando viene congedato", async () => {
    mockForm = {
      ...mockForm,
      primoPasso: { prossimoRichiamo: new Date(Date.now() + 7 * 86_400_000).toISOString() },
    };

    await render(<FormRipassoScreen />);
    expect(screen.getByText("Fatto: 1 richiamo su 4.")).toBeTruthy();
    expect(mockGoBack).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Torna alla lista"));
    expect(mockForm.chiudiPrimoPasso).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });
});

/**
 * Le liste che si continuano da sole nel campo Note, stile WhatsApp.
 *
 * Passano dal campo e non da una funzione esportata di proposito: quel che
 * conta è che l'invio, dentro l'input vero, produca la riga giusta — è lì che
 * l'utente scopre se la lista continua o no.
 */
describe("continuazione automatica delle liste nelle note", () => {
  async function scrivi(prima: string, dopo: string): Promise<string> {
    return (await scriviConCursore(prima, dopo)).testo;
  }

  /** Come `scrivi`, ma riporta anche dove il campo mette il cursore. */
  async function scriviConCursore(
    prima: string,
    dopo: string
  ): Promise<{ testo: string; selezione: { start: number; end: number } | undefined }> {
    mockForm = { ...mockForm, note: prima };
    await render(<FormRipassoScreen />);
    const campo = screen.getByPlaceholderText(/Testo libero/);
    await fireEvent.changeText(campo, dopo);
    const chiamate = (mockForm.setNote as jest.Mock).mock.calls;
    return {
      testo: chiamate[chiamate.length - 1][0] as string,
      selezione: campo.props.selection,
    };
  }

  it("riporta il trattino sulla riga nuova", async () => {
    expect(await scrivi("- primo", "- primo\n")).toBe("- primo\n- ");
  });

  it("incrementa il numero di una lista numerata", async () => {
    expect(await scrivi("1. primo", "1. primo\n")).toBe("1. primo\n2. ");
  });

  it("un marcatore rimasto vuoto chiude la lista invece di moltiplicarsi", async () => {
    expect(await scrivi("- primo\n- ", "- primo\n- \n")).toBe("- primo\n");
  });

  it("un numero rimasto vuoto chiude la lista allo stesso modo", async () => {
    expect(await scrivi("1. primo\n2. ", "1. primo\n2. \n")).toBe("1. primo\n");
  });

  it("su una riga che non è una lista non aggiunge niente", async () => {
    expect(await scrivi("testo", "testo\n")).toBe("testo\n");
  });

  it("non tocca il testo quando non si è appena andati a capo", async () => {
    expect(await scrivi("- primo", "- primo e poi")).toBe("- primo e poi");
  });

  it("non tocca il testo quando il carattere aggiunto non è un a capo", async () => {
    expect(await scrivi("- primo", "- primoX")).toBe("- primoX");
  });

  /**
   * Il bug che si vedeva scrivendo: il campo mette il cursore dove finiva il
   * testo che ha scritto *lui*, cioè subito dopo l'a capo — prima del "- "
   * aggiunto qui. Si finiva a scrivere a sinistra del trattino.
   */
  it("lascia il cursore dopo il marcatore appena inserito", async () => {
    const { testo, selezione } = await scriviConCursore("- primo", "- primo\n");

    expect(testo).toBe("- primo\n- ");
    expect(selezione).toEqual({ start: testo.length, end: testo.length });
  });

  it("dopo un numero il cursore sta dopo «2. »", async () => {
    const { testo, selezione } = await scriviConCursore("1. primo", "1. primo\n");

    expect(testo).toBe("1. primo\n2. ");
    expect(selezione).toEqual({ start: testo.length, end: testo.length });
  });

  it("chiudendo la lista il cursore resta sulla riga svuotata", async () => {
    const { testo, selezione } = await scriviConCursore("- primo\n- ", "- primo\n- \n");

    expect(testo).toBe("- primo\n");
    expect(selezione).toEqual({ start: testo.length, end: testo.length });
  });

  it("non impone nessun cursore quando non riscrive il testo", async () => {
    const { selezione } = await scriviConCursore("testo", "testo\n");

    expect(selezione).toBeUndefined();
  });
});
