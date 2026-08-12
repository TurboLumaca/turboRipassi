/**
 * Test della sincronizzazione fra la lista dei ripassi e i promemoria del
 * sistema operativo.
 *
 * La selezione e il diff sono già coperti nel Model (`notificheLogic`): qui
 * conta il cablaggio, cioè le tre cose che il Model non può garantire da solo.
 * Che il permesso non venga chiesto senza una ragione — un'app che chiede le
 * notifiche al primo avvio si sente rispondere no una volta sola e per sempre.
 * Che un ricaricamento identico non ripianifichi niente, perché la lista si
 * ricarica a ogni evento Realtime e ripianificare significa cancellare e
 * ricreare promemoria già corretti. E che un errore su un promemoria non
 * impedisca agli altri di essere pianificati.
 */
const mockPermesso = jest.fn();
jest.mock("@/config/notifications", () => ({
  assicuraPermessoNotifiche: () => mockPermesso(),
}));

const mockReportError = jest.fn();
jest.mock("@/config/crashReporting", () => ({
  reportError: (...a: unknown[]) => mockReportError(...a),
}));

/**
 * Il repository vero arriva solo come valore di default del parametro, e non
 * viene mai usato qui — ma importarlo tira dentro expo-notifications, che al
 * caricamento avverte di Expo Go e riempie l'output della suite di rumore che
 * non riguarda questi test.
 */
jest.mock("@/model/notifiche/notificheRepo", () => ({
  notificheRepo: { pianifica: jest.fn(), cancella: jest.fn() },
}));

import { renderHook, waitFor } from "@testing-library/react-native";
import type { RipassoCompleto } from "@/model/types";
import type { NotificheRepo } from "@/model/notifiche/notificheRepo";
import { useNotificheRipassi } from "../useNotificheRipassi";

const mockPianifica = jest.fn();
const mockCancella = jest.fn();
const repo: NotificheRepo = {
  pianifica: (...a) => mockPianifica(...a),
  cancella: (...a) => mockCancella(...a),
};

/**
 * L'istante di riferimento, preso una volta sola.
 *
 * Se ogni chiamata leggesse l'orologio, due fixture «uguali» costruite a
 * qualche millisecondo di distanza avrebbero scadenze diverse, e il test sul
 * ricarico identico misurerebbe la risoluzione del clock invece del diff.
 */
const ORA = Date.now();

/** Un ripasso con una sola occorrenza, per default nel futuro e da fare. */
function ripasso(
  id: string,
  fraMinuti: number,
  over: { completata?: boolean; titolo?: string } = {}
): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    titolo: over.titolo ?? `Ripasso ${id}`,
    note: null,
    created_at: new Date().toISOString(),
    occorrenze: [
      {
        id: `${id}-o1`,
        ripasso_id: id,
        scheduled_at: new Date(ORA + fraMinuti * 60_000).toISOString(),
        is_completed: over.completata ?? false,
        offset_days: 1,
      },
    ],
    allegati: [],
  } as unknown as RipassoCompleto;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPermesso.mockResolvedValue(true);
  mockPianifica.mockResolvedValue(undefined);
  mockCancella.mockResolvedValue(undefined);
});

it("pianifica un promemoria per ogni occorrenza futura da fare", async () => {
  await renderHook(() => useNotificheRipassi([ripasso("r1", 60), ripasso("r2", 120)], repo));

  await waitFor(() => expect(mockPianifica).toHaveBeenCalledTimes(2));
  expect(mockPianifica.mock.calls.map((c) => c[0])).toEqual(["r1-o1", "r2-o1"]);
});

/**
 * Il permesso è una domanda che si può fare bene una volta sola: chiederlo su
 * una lista vuota lo brucia prima che ci sia qualcosa da ricordare.
 */
it("senza niente da ricordare non chiede nemmeno il permesso", async () => {
  await renderHook(() => useNotificheRipassi([], repo));

  expect(mockPermesso).not.toHaveBeenCalled();
  expect(mockPianifica).not.toHaveBeenCalled();
});

it("un'occorrenza già completata non produce promemoria", async () => {
  await renderHook(() =>
    useNotificheRipassi([ripasso("r1", 60, { completata: true })], repo)
  );

  expect(mockPermesso).not.toHaveBeenCalled();
  expect(mockPianifica).not.toHaveBeenCalled();
});

it("permesso negato: non si pianifica niente, e non è un errore da segnalare", async () => {
  mockPermesso.mockResolvedValue(false);

  await renderHook(() => useNotificheRipassi([ripasso("r1", 60)], repo));

  await waitFor(() => expect(mockPermesso).toHaveBeenCalled());
  expect(mockPianifica).not.toHaveBeenCalled();
  expect(mockReportError).not.toHaveBeenCalled();
});

/** Realtime ricarica la lista in continuazione: un ricarico uguale è un no-op. */
it("una lista ricaricata identica non ripianifica niente", async () => {
  const lista = [ripasso("r1", 60)];
  const { rerender } = await renderHook(
    ({ ripassi }: { ripassi: RipassoCompleto[] }) => useNotificheRipassi(ripassi, repo),
    { initialProps: { ripassi: lista } }
  );
  await waitFor(() => expect(mockPianifica).toHaveBeenCalledTimes(1));

  // Stessi dati, oggetti nuovi: è quello che consegna una rilettura dal server.
  await rerender({ ripassi: [ripasso("r1", 60)] });

  await waitFor(() => expect(mockPianifica).toHaveBeenCalledTimes(1));
  expect(mockCancella).not.toHaveBeenCalled();
});

it("un ripasso sparito dalla lista si porta via il suo promemoria", async () => {
  const { rerender } = await renderHook(
    ({ ripassi }: { ripassi: RipassoCompleto[] }) => useNotificheRipassi(ripassi, repo),
    { initialProps: { ripassi: [ripasso("r1", 60)] } }
  );
  await waitFor(() => expect(mockPianifica).toHaveBeenCalledTimes(1));

  await rerender({ ripassi: [] });

  await waitFor(() => expect(mockCancella).toHaveBeenCalledWith("r1-o1"));
});

/** Un promemoria rifiutato dal sistema non deve costare gli altri. */
it("se una pianificazione fallisce lo segnala e continua con le altre", async () => {
  mockPianifica.mockRejectedValueOnce(new Error("quota superata"));

  await renderHook(() => useNotificheRipassi([ripasso("r1", 60), ripasso("r2", 120)], repo));

  await waitFor(() => expect(mockPianifica).toHaveBeenCalledTimes(2));
  expect(mockReportError).toHaveBeenCalledTimes(1);
  expect(mockReportError.mock.calls[0][1]).toMatchObject({ occorrenzaId: "r1-o1" });
});
