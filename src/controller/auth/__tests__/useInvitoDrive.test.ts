/**
 * Test dell'invito a collegare Google Drive.
 *
 * Il caso che conta è quello che l'utente ha segnalato: il consenso può
 * chiudersi per due strade diverse. Se torna dal browser in-app,
 * `autorizzaDrive()` risponde di sì; se Google rimanda dentro l'app con un
 * deep link, quella stessa chiamata vede una sessione «chiusa» e risponde di
 * no, mentre il collegamento è riuscito. Guardare solo la risposta lasciava il
 * pop-up addosso a un account appena collegato.
 */
const mockIsAuthorized = jest.fn();
jest.mock("@/model/drive/driveAuth", () => ({
  driveTokenManager: { isAuthorized: () => mockIsAuthorized() },
}));

const mockAutorizzaDrive = jest.fn();
const mockStato = { driveAutorizzato: false };
jest.mock("@/controller/AuthContext", () => ({
  useAuthCtx: () => ({
    autorizzaDrive: mockAutorizzaDrive,
    driveAutorizzato: mockStato.driveAutorizzato,
  }),
}));

import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useInvitoDrive } from "../useInvitoDrive";

beforeEach(() => {
  jest.clearAllMocks();
  mockStato.driveAutorizzato = false;
  mockIsAuthorized.mockResolvedValue(false);
  mockAutorizzaDrive.mockResolvedValue(false);
});

it("non invita chi ha già Drive collegato", async () => {
  mockIsAuthorized.mockResolvedValue(true);
  const { result } = await renderHook(() => useInvitoDrive());

  await waitFor(() => expect(mockIsAuthorized).toHaveBeenCalled());
  expect(result.current.visibile).toBe(false);
});

it("invita chi non ha Drive collegato", async () => {
  const { result } = await renderHook(() => useInvitoDrive());
  await waitFor(() => expect(result.current.visibile).toBe(true));
});

it("si chiude quando il consenso arriva dal deep link, non dalla risposta", async () => {
  jest.useFakeTimers();
  const { result, rerender } = await renderHook(() => useInvitoDrive());
  await waitFor(() => expect(result.current.visibile).toBe(true));

  // Il browser risulta chiuso: la chiamata dice di no…
  await act(async () => {
    await result.current.collega();
  });
  expect(result.current.visibile).toBe(true);

  // …ma il redirect ha completato lo scambio e il contesto lo sa.
  mockStato.driveAutorizzato = true;
  await act(async () => rerender(undefined));
  expect(result.current.confermato).toBe(true);
  expect(result.current.visibile).toBe(true);

  // Il messaggio di conferma resta il tempo di essere letto, poi sparisce.
  console.log("TIMERS", jest.getTimerCount(), result.current.visibile, result.current.confermato);
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  console.log("DOPO", result.current.visibile);
  expect(result.current.visibile).toBe(false);
  jest.useRealTimers();
});

it("si chiude quando l'autorizzazione riesce nel browser in-app", async () => {
  jest.useFakeTimers();
  mockAutorizzaDrive.mockResolvedValue(true);
  const { result, rerender } = await renderHook(() => useInvitoDrive());
  await waitFor(() => expect(result.current.visibile).toBe(true));

  await act(async () => {
    await result.current.collega();
  });
  // Il contesto registra il collegamento e la schermata si ridisegna.
  mockStato.driveAutorizzato = true;
  await act(async () => rerender(undefined));

  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  expect(result.current.visibile).toBe(false);
  jest.useRealTimers();
});

it("«Più tardi» chiude senza collegare nulla", async () => {
  const { result } = await renderHook(() => useInvitoDrive());
  await waitFor(() => expect(result.current.visibile).toBe(true));

  await act(async () => result.current.rimanda());

  expect(result.current.visibile).toBe(false);
  expect(mockAutorizzaDrive).not.toHaveBeenCalled();
});
