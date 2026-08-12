/**
 * Test dell'unico posto in cui l'app decide se è offline.
 *
 * Da questo booleano dipendono tre comportamenti visibili: l'avviso «stai
 * lavorando offline», la coda che trattiene le scritture invece di provarle, e
 * la lista che si accontenta della copia su disco. Sbagliarlo verso il falso
 * offline è il caso peggiore — l'app si dichiara isolata mentre la rete c'è —
 * ed è esattamente quello che succede se si tratta `isInternetReachable: null`
 * (sonda ancora in corso) come un no.
 */
type Ascoltatore = (stato: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;

let ascoltatore: Ascoltatore | null = null;
const mockDisiscrivi = jest.fn();
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: (cb: Ascoltatore) => {
      ascoltatore = cb;
      return mockDisiscrivi;
    },
  },
}));

import { act, renderHook } from "@testing-library/react-native";
import { useConnettivita } from "../useConnettivita";

beforeEach(() => {
  ascoltatore = null;
  mockDisiscrivi.mockClear();
});

/** Consegna uno stato NetInfo all'ascoltatore registrato dall'hook. */
async function riporta(isConnected: boolean | null, isInternetReachable: boolean | null) {
  if (!ascoltatore) throw new Error("L'hook non si è iscritto a NetInfo.");
  const consegna = ascoltatore;
  await act(async () => consegna({ isConnected, isInternetReachable }));
}

/**
 * Prima di sapere qualcosa si assume che la rete ci sia: un'app che parte
 * dichiarandosi offline mostrerebbe l'avviso per la frazione di secondo che
 * separa il primo render dalla prima risposta di NetInfo.
 */
it("parte online, prima di qualsiasi risposta di NetInfo", async () => {
  const { result } = await renderHook(() => useConnettivita());
  expect(result.current.online).toBe(true);
});

it("nessuna rete significa offline", async () => {
  const { result } = await renderHook(() => useConnettivita());
  await riporta(false, null);
  expect(result.current.online).toBe(false);
});

/** Il caso che conta: sonda in corso, non è una risposta negativa. */
it("una raggiungibilità ancora ignota non è un «sei offline»", async () => {
  const { result } = await renderHook(() => useConnettivita());
  await riporta(true, null);
  expect(result.current.online).toBe(true);
});

it("una rete che non arriva a internet è offline quanto nessuna rete", async () => {
  const { result } = await renderHook(() => useConnettivita());
  await riporta(true, false);
  expect(result.current.online).toBe(false);
});

it("torna online quando la rete torna", async () => {
  const { result } = await renderHook(() => useConnettivita());
  await riporta(false, false);
  expect(result.current.online).toBe(false);

  await riporta(true, true);
  expect(result.current.online).toBe(true);
});

/** Senza questo ogni schermata smontata lascerebbe un ascoltatore vivo. */
it("smontando si disiscrive da NetInfo", async () => {
  const { unmount } = await renderHook(() => useConnettivita());
  await unmount();
  expect(mockDisiscrivi).toHaveBeenCalledTimes(1);
});
