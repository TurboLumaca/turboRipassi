/**
 * Tests for offline reading of the reviews list.
 *
 * The home screen has promised "vedi i ripassi già scaricati" from the start,
 * and nothing was keeping them. The attachments of the days around today were
 * on disk; the ripassi and occurrences they hang off were not, so with no
 * connection the list arrived empty — and the cached files became unreachable
 * by construction, because no row was left to open them from.
 *
 * The risk in the remedy is ordering: the disk and the network race, and a
 * list from this morning landing after the server's answer would be a worse
 * regression than the bug. That race is what the last two tests pin down.
 *
 * A file of its own, and not another describe in useRipassi.test.ts, for the
 * reason that file already documents: after a long series of renders in the
 * same file the effects of the last mount stop running, and a hook that never
 * subscribes proves nothing about the hook.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { RipassoCompleto } from "@/model/types";
import type { RipassiRepo } from "@/model/ripassi/ripassiRepo";

jest.mock("@/config/supabase", () => {
  const canale: Record<string, unknown> = {};
  canale.on = () => canale;
  canale.subscribe = () => canale;
  return { supabase: { channel: () => canale, removeChannel: jest.fn() } };
});

const mockReportError = jest.fn();
jest.mock("@/config/crashReporting", () => ({
  reportError: (...a: unknown[]) => mockReportError(...a),
}));

const mockLeggiRipassiSalvati = jest.fn();
const mockSalvaRipassi = jest.fn();
jest.mock("@/model/ripassi/ripassiOffline", () => ({
  leggiRipassiSalvati: () => mockLeggiRipassiSalvati(),
  salvaRipassi: (...a: unknown[]) => mockSalvaRipassi(...a),
}));

import { useRipassi } from "../useRipassi";

const leggiCompleti = jest.fn();

const repo: RipassiRepo = {
  leggiCompleti: () => leggiCompleti(),
  crea: jest.fn(),
  aggiorna: jest.fn(),
  elimina: jest.fn(),
  aggiornaOccorrenza: jest.fn(),
  completaOccorrenza: jest.fn(),
  spostaOccorrenze: jest.fn(),
};

function ripasso(id: string): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo: id,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    occorrenze: [],
    allegati: [],
  };
}

/** Come il telefono in modalità aereo lo racconta al livello di rete. */
const irraggiungibile = new TypeError("Network request failed");
const salvatoIl = new Date("2026-08-08T07:00:00.000Z");

/**
 * Aspetta che i ritenti del caricamento iniziale abbiano finito.
 *
 * Un errore di rete viene ritentato tre volte con attese che raddoppiano, e un
 * test che finisce prima lascia un timer acceso: jest lo segnala come worker
 * che non termina, e la prossima attesa di quel timer cade dentro il test
 * successivo.
 */
async function attendiRitenti(): Promise<void> {
  await waitFor(() => expect(leggiCompleti).toHaveBeenCalledTimes(3), { timeout: 5000 });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLeggiRipassiSalvati.mockResolvedValue(null);
  mockSalvaRipassi.mockResolvedValue(undefined);
  leggiCompleti.mockResolvedValue([ripasso("r1")]);
});

it("apre sulla lista salvata quando il server non risponde", async () => {
  mockLeggiRipassiSalvati.mockResolvedValue({ ripassi: [ripasso("salvato")], salvatoIl });
  leggiCompleti.mockRejectedValue(irraggiungibile);

  const { result } = await renderHook(() => useRipassi(repo));

  await waitFor(() => expect(result.current.ripassi).toHaveLength(1));
  expect(result.current.ripassi[0].id).toBe("salvato");
  expect(result.current.loading).toBe(false);
  expect(result.current.salvatoIl).toEqual(salvatoIl);
  await attendiRitenti();
});

/**
 * Con la lista salvata sotto gli occhi e la fascia che spiega il perché, una
 * riga rossa direbbe la stessa cosa in tono allarmato. E una segnalazione per
 * ogni apertura in metropolitana riempirebbe il cruscotto di eventi su cui
 * nessuno può intervenire.
 */
it("essere offline non è un errore da mostrare né da segnalare", async () => {
  mockLeggiRipassiSalvati.mockResolvedValue({ ripassi: [ripasso("salvato")], salvatoIl });
  leggiCompleti.mockRejectedValue(irraggiungibile);

  const { result } = await renderHook(() => useRipassi(repo));

  await waitFor(() => expect(result.current.ripassi).toHaveLength(1));
  expect(result.current.error).toBeNull();
  expect(mockReportError).not.toHaveBeenCalled();
  await attendiRitenti();
});

it("senza niente da mostrare l'errore di rete resta visibile", async () => {
  leggiCompleti.mockRejectedValue(irraggiungibile);

  const { result } = await renderHook(() => useRipassi(repo));

  // Oltre l'attesa predefinita di waitFor: un errore di rete viene prima
  // ritentato tre volte con attese che raddoppiano, e il messaggio arriva solo
  // quando anche l'ultimo tentativo ha fallito.
  await waitFor(() => expect(result.current.error).not.toBeNull(), { timeout: 5000 });
  expect(result.current.error).toMatch(/connessione/i);
});

it("salva la lista che il server conferma", async () => {
  const { result } = await renderHook(() => useRipassi(repo));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mockSalvaRipassi).toHaveBeenCalledWith([ripasso("r1")]);
});

/** Il disco perde la corsa: la risposta del server è già sullo schermo. */
it("una lista salvata che arriva tardi non copre quella del server", async () => {
  let consegnaSalvati: (v: unknown) => void = () => undefined;
  mockLeggiRipassiSalvati.mockReturnValue(
    new Promise((r) => {
      consegnaSalvati = r;
    })
  );

  const { result } = await renderHook(() => useRipassi(repo));

  await waitFor(() => expect(result.current.ripassi).toHaveLength(1));
  expect(result.current.ripassi[0].id).toBe("r1");

  await act(async () => {
    consegnaSalvati({ ripassi: [ripasso("salvato")], salvatoIl });
  });

  expect(result.current.ripassi[0].id).toBe("r1");
  expect(result.current.salvatoIl).toBeNull();
});

/** Tornata la connessione, la lista viva sostituisce quella del passato. */
it("il primo caricamento riuscito toglie la lista dal passato", async () => {
  mockLeggiRipassiSalvati.mockResolvedValue({ ripassi: [ripasso("salvato")], salvatoIl });
  leggiCompleti.mockRejectedValue(irraggiungibile);

  const { result } = await renderHook(() => useRipassi(repo));
  await waitFor(() => expect(result.current.salvatoIl).toEqual(salvatoIl));
  await attendiRitenti();

  leggiCompleti.mockResolvedValue([ripasso("vivo")]);
  await act(async () => {
    await result.current.reload();
  });

  expect(result.current.ripassi[0].id).toBe("vivo");
  expect(result.current.salvatoIl).toBeNull();
});
