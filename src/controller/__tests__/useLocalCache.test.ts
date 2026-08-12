/**
 * Test della rotazione della cache locale e della lista «questi non li apri
 * offline».
 *
 * La finestra dei tre giorni e il calcolo dei mancanti sono già coperti nel
 * Model (`cacheLogic`), la rotazione vera in `localCache`. Qui interessano le
 * regole che vivono solo in questo hook, e sono tutte regole su *quando*:
 *
 *  - una rotazione al giorno, e non una per render, perché ogni evento Realtime
 *    ricostruisce la lista e la rotazione scarica file;
 *  - una rotazione fallita per mancanza di rete non consuma la giornata, o
 *    un'app aperta offline non scaricherebbe più niente fino a mezzanotte;
 *  - la disponibilità si ricalcola da quello che il dispositivo ha davvero, non
 *    da com'è andata la rotazione — un ripasso creato stamattina entra nella
 *    finestra senza che nessuna rotazione ne sappia niente.
 */
const mockIdsInCache = jest.fn();
const mockRuotaCache = jest.fn();
jest.mock("@/model/cache/localCache", () => ({
  idsInCache: () => mockIdsInCache(),
  ruotaCache: (...a: unknown[]) => mockRuotaCache(...a),
  getLocalUri: jest.fn(),
}));

const mockReportError = jest.fn();
jest.mock("@/config/crashReporting", () => ({
  reportError: (...a: unknown[]) => mockReportError(...a),
}));

import { renderHook, waitFor } from "@testing-library/react-native";
import type { RipassoCompleto } from "@/model/types";
import { useLocalCache } from "../useLocalCache";

/** Un ripasso di oggi con un allegato, cioè dentro la finestra della cache. */
function ripasso(id: string, allegatoId: string): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    titolo: `Ripasso ${id}`,
    note: null,
    created_at: new Date().toISOString(),
    occorrenze: [
      {
        id: `${id}-o1`,
        ripasso_id: id,
        scheduled_at: new Date().toISOString(),
        is_completed: false,
        offset_days: 0,
      },
    ],
    allegati: [
      {
        id: allegatoId,
        ripasso_id: id,
        file_name: "foto.jpg",
        mime_type: "image/jpeg",
        drive_file_id: `drive-${allegatoId}`,
        posizione: 0,
      },
    ],
  } as unknown as RipassoCompleto;
}

const NESSUN_PROTETTO = new Set<string>();
const PROTETTO_A1 = new Set(["a1"]);

/**
 * Le liste sono costanti di modulo, non espressioni dentro il callback di
 * `renderHook`.
 *
 * L'hook rilegge la cache a ogni cambio di identità di `ripassi`, e il
 * risultato è uno `setState`: costruire l'array dentro il render lo farebbe
 * cambiare a ogni giro e il ciclo non si chiuderebbe mai. Non è una fragilità
 * del test — è il contratto dell'hook, ed è il motivo per cui
 * `RipassiProvider` memoizza la lista prima di passarla.
 */
const UNO = [ripasso("r1", "a1")];
const DUE = [ripasso("r1", "a1"), ripasso("r2", "a2")];
const VUOTA: RipassoCompleto[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  mockIdsInCache.mockResolvedValue(new Set<string>());
  mockRuotaCache.mockResolvedValue({ scaricati: 0, rimossi: 0, perRete: 0 });
});

it("un allegato che non è sul dispositivo finisce fra i non disponibili", async () => {
  const { result } = await renderHook(() => useLocalCache(UNO, NESSUN_PROTETTO));

  await waitFor(() => expect(result.current.nonDisponibili).toHaveLength(1));
  expect(result.current.nonDisponibili[0]).toMatchObject({ id: "r1", mancanti: 1 });
});

it("con tutto in cache la lista dei non disponibili resta vuota", async () => {
  mockIdsInCache.mockResolvedValue(new Set(["a1"]));

  const { result } = await renderHook(() => useLocalCache(UNO, NESSUN_PROTETTO));

  await waitFor(() => expect(mockRuotaCache).toHaveBeenCalled());
  expect(result.current.nonDisponibili).toEqual([]);
});

/**
 * Gli allegati scelti offline esistono solo qui: non sono in cache perché non
 * sono ancora stati caricati, ma sono leggibili — contarli fra i mancanti
 * significherebbe avvisare l'utente che non può aprire il file che ha appena
 * scelto lui.
 */
it("un allegato protetto conta come disponibile anche se non è in cache", async () => {
  const { result } = await renderHook(() => useLocalCache(UNO, PROTETTO_A1));

  await waitFor(() => expect(mockRuotaCache).toHaveBeenCalled());
  expect(result.current.nonDisponibili).toEqual([]);
});

it("senza ripassi non parte nessuna rotazione", async () => {
  await renderHook(() => useLocalCache(VUOTA, NESSUN_PROTETTO));

  await waitFor(() => expect(mockIdsInCache).toHaveBeenCalled());
  expect(mockRuotaCache).not.toHaveBeenCalled();
});

/** Realtime ricarica la lista di continuo: la rotazione è una al giorno. */
it("una lista ricaricata non fa partire una seconda rotazione", async () => {
  const { rerender } = await renderHook(
    ({ ripassi }: { ripassi: RipassoCompleto[] }) => useLocalCache(ripassi, NESSUN_PROTETTO),
    { initialProps: { ripassi: UNO } }
  );
  await waitFor(() => expect(mockRuotaCache).toHaveBeenCalledTimes(1));

  await rerender({ ripassi: DUE });

  await waitFor(() => expect(mockIdsInCache).toHaveBeenCalledTimes(3));
  expect(mockRuotaCache).toHaveBeenCalledTimes(1);
});

/**
 * Il caso che l'app aperta offline produce ogni volta: la rotazione non è
 * fallita, non ha proprio avuto una possibilità, e la giornata non è spesa.
 */
it("una rotazione fallita per mancanza di rete non consuma la giornata", async () => {
  mockRuotaCache.mockResolvedValue({ scaricati: 0, rimossi: 0, perRete: 2 });

  const { rerender } = await renderHook(
    ({ ripassi }: { ripassi: RipassoCompleto[] }) => useLocalCache(ripassi, NESSUN_PROTETTO),
    { initialProps: { ripassi: UNO } }
  );
  await waitFor(() => expect(mockRuotaCache).toHaveBeenCalledTimes(1));

  // Il cambio di lista è quello che produce una riconnessione.
  await rerender({ ripassi: DUE });

  await waitFor(() => expect(mockRuotaCache).toHaveBeenCalledTimes(2));
});

it("una cache illeggibile è segnalata e lascia in pace l'ultima risposta nota", async () => {
  mockIdsInCache.mockRejectedValue(new Error("database chiuso"));

  const { result } = await renderHook(() => useLocalCache(UNO, NESSUN_PROTETTO));

  await waitFor(() => expect(mockReportError).toHaveBeenCalled());
  expect(result.current.nonDisponibili).toEqual([]);
});

/** Se salta il filesystem nessuna rotazione futura lo aggiusta: si riprova. */
it("una rotazione che esplode viene segnalata e non blocca la giornata", async () => {
  mockRuotaCache.mockRejectedValue(new Error("filesystem in sola lettura"));

  await renderHook(() => useLocalCache(UNO, NESSUN_PROTETTO));

  await waitFor(() => expect(mockReportError).toHaveBeenCalled());
  expect(mockReportError.mock.calls[0][1]).toMatchObject({ operazione: "ruotaCache" });
});
