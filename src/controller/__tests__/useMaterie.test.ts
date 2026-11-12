import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { Materia } from "@/model/types";
import type { MaterieRepo } from "@/model/materie/materieRepo";

const mockSalva = jest.fn();
const mockLeggiSalvate = jest.fn();
jest.mock("@/model/materie/materieOffline", () => ({
  salvaMaterie: (...a: unknown[]) => mockSalva(...a),
  leggiMaterieSalvate: () => mockLeggiSalvate(),
}));
jest.mock("@/config/crashReporting", () => ({ reportError: jest.fn() }));
jest.mock("@/model/shared/idLocale", () => ({ idLocale: () => "id-nuovo" }));

import { useMaterie } from "../useMaterie";

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

function repoFinto(iniziali: Materia[]): jest.Mocked<MaterieRepo> {
  return {
    leggi: jest.fn().mockResolvedValue(iniziali),
    crea: jest.fn().mockImplementation(async (i) => materia(i.nome, i.colore, i.id)),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLeggiSalvate.mockResolvedValue(null);
});

describe("useMaterie", () => {
  it("carica dal server e le tiene in ordine alfabetico", async () => {
    const repo = repoFinto([materia("Fisica"), materia("Analisi")]);
    const { result } = await renderHook(() => useMaterie(repo));

    await waitFor(() => expect(result.current.materie).toHaveLength(2));
    expect(result.current.materie.map((m) => m.nome)).toEqual(["Analisi", "Fisica"]);
    expect(mockSalva).toHaveBeenCalled();
  });

  it("offline mostra quelle salvate sul dispositivo", async () => {
    mockLeggiSalvate.mockResolvedValue([materia("Libri")]);
    const repo = repoFinto([]);
    repo.leggi.mockRejectedValue(new Error("rete"));
    const { result } = await renderHook(() => useMaterie(repo));

    await waitFor(() => expect(result.current.materie.map((m) => m.nome)).toEqual(["Libri"]));
  });

  it("crea una materia col primo colore libero e un id deciso qui", async () => {
    const repo = repoFinto([materia("Fisica", "#5AA9E6")]);
    const { result } = await renderHook(() => useMaterie(repo));
    await waitFor(() => expect(result.current.materie).toHaveLength(1));

    let creata: Materia | undefined;
    await act(async () => {
      creata = await result.current.creaMateria("  Chimica ");
    });

    expect(repo.crea).toHaveBeenCalledWith({
      id: "id-nuovo",
      nome: "Chimica",
      colore: "#B38AF2",
    });
    expect(creata?.nome).toBe("Chimica");
    expect(result.current.materie.map((m) => m.nome)).toEqual(["Chimica", "Fisica"]);
  });

  it("scrivere due volte lo stesso nome restituisce la materia che c'è, senza crearne una", async () => {
    const repo = repoFinto([materia("Fisica")]);
    const { result } = await renderHook(() => useMaterie(repo));
    await waitFor(() => expect(result.current.materie).toHaveLength(1));

    let trovata: Materia | undefined;
    await act(async () => {
      trovata = await result.current.creaMateria("fisica");
    });

    expect(trovata?.id).toBe("Fisica");
    expect(repo.crea).not.toHaveBeenCalled();
  });

  it("un nome vuoto lancia con un messaggio per l'utente", async () => {
    const repo = repoFinto([]);
    const { result } = await renderHook(() => useMaterie(repo));

    await act(async () => {
      await expect(result.current.creaMateria("   ")).rejects.toThrow(/Scrivi/);
    });
    expect(repo.crea).not.toHaveBeenCalled();
  });

  it("se il server rifiuta la creazione, la lista non cambia", async () => {
    const repo = repoFinto([materia("Fisica")]);
    repo.crea.mockRejectedValue(new Error("rete"));
    const { result } = await renderHook(() => useMaterie(repo));
    await waitFor(() => expect(result.current.materie).toHaveLength(1));

    await act(async () => {
      await expect(result.current.creaMateria("Chimica")).rejects.toThrow();
    });
    expect(result.current.materie.map((m) => m.nome)).toEqual(["Fisica"]);
  });
});
