/**
 * Test dello stato «con che account Google sono collegato».
 *
 * È una macchina a stati piccola ma con un caso che vale i test: Drive può
 * essere autorizzato e non funzionare comunque — un refresh token revocato dal
 * lato Google resta un token, e `isAuthorized()` risponde di sì. La differenza
 * fra «non collegato» ed «errore» è quello che il Profilo dice all'utente, e
 * confonderle significa suggerire di ricollegarsi a chi ha solo la rete giù.
 */
const mockIsAuthorized = jest.fn();
jest.mock("@/model/drive/driveAuth", () => ({
  driveTokenManager: { isAuthorized: () => mockIsAuthorized() },
}));

const mockAccount = jest.fn();
jest.mock("@/model/drive/driveRepo", () => ({
  driveClient: { account: () => mockAccount() },
}));

const mockReportError = jest.fn();
jest.mock("@/config/crashReporting", () => ({
  reportError: (...a: unknown[]) => mockReportError(...a),
}));

import { act, renderHook } from "@testing-library/react-native";
import { useAccountDrive } from "../useAccountDrive";

const ACCOUNT = { email: "tizio@example.com", cartella: "Ripassa" };

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthorized.mockResolvedValue(true);
  mockAccount.mockResolvedValue(ACCOUNT);
});

/**
 * Il Profilo si apre senza fare due chiamate a Drive: finché nessuno chiede,
 * lo stato è «ignoto» e non «caricamento», che disegnerebbe uno spinner per
 * un'attesa che non è cominciata.
 */
it("non interroga Drive finché nessuno lo chiede", async () => {
  const { result } = await renderHook(() => useAccountDrive());

  expect(result.current.stato).toEqual({ stato: "ignoto" });
  expect(mockIsAuthorized).not.toHaveBeenCalled();
  expect(mockAccount).not.toHaveBeenCalled();
});

it("collegato: espone l'account che Drive ha risposto", async () => {
  const { result } = await renderHook(() => useAccountDrive());

  await act(async () => {
    await result.current.aggiorna();
  });

  expect(result.current.stato).toEqual({ stato: "collegato", account: ACCOUNT });
});

/** Senza token non si chiama Drive: sarebbe una richiesta destinata al 401. */
it("senza autorizzazione dice «non collegato» senza chiamare Drive", async () => {
  mockIsAuthorized.mockResolvedValue(false);
  const { result } = await renderHook(() => useAccountDrive());

  await act(async () => {
    await result.current.aggiorna();
  });

  expect(result.current.stato).toEqual({ stato: "nonCollegato" });
  expect(mockAccount).not.toHaveBeenCalled();
});

/**
 * Il caso vero: autorizzati sulla carta, rifiutati dal server. Deve restare un
 * errore con un messaggio, non diventare un «non collegato» che inviterebbe a
 * rifare un collegamento già fatto.
 */
it("autorizzato ma la chiamata fallisce: errore con messaggio, e segnalato", async () => {
  mockAccount.mockRejectedValue(new Error("401 Unauthorized"));
  const { result } = await renderHook(() => useAccountDrive());

  await act(async () => {
    await result.current.aggiorna();
  });

  expect(result.current.stato.stato).toBe("errore");
  if (result.current.stato.stato === "errore") {
    expect(result.current.stato.messaggio).toBeTruthy();
  }
  expect(mockReportError).toHaveBeenCalledTimes(1);
});

/** Dopo un logout lo stato deve tornare vergine, non restare l'account di prima. */
it("dimentica riporta a «ignoto»", async () => {
  const { result } = await renderHook(() => useAccountDrive());
  await act(async () => {
    await result.current.aggiorna();
  });
  expect(result.current.stato.stato).toBe("collegato");

  await act(async () => {
    result.current.dimentica();
  });

  expect(result.current.stato).toEqual({ stato: "ignoto" });
});
