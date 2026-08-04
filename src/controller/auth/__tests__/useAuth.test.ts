/**
 * Tests for the Google flows in the authentication Controller.
 *
 * The interesting part is not the happy path — it is what happens when the
 * browser comes back saying nothing useful. On Android a completed flow and a
 * tab the user swiped away are indistinguishable at that point, so the hook
 * has to ask "did this work anyway?" — and the answer is not the same
 * question for the two flows. Signing in is settled by the existence of a
 * session; linking starts from a session that was already there, so the same
 * check would report success on every failure. That asymmetry is what these
 * tests pin down.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";

const mockOpenAuthSession = jest.fn();
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...a: unknown[]) => mockOpenAuthSession(...a),
}));

jest.mock("expo-auth-session", () => ({
  makeRedirectUri: () => "ripassa://",
}));

const mockSignInWithOAuth = jest.fn();
const mockLinkIdentity = jest.fn();
const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockExchangeCode = jest.fn();

jest.mock("@/config/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
      getSession: () => mockGetSession(),
      getUser: () => mockGetUser(),
      signInWithOAuth: (...a: unknown[]) => mockSignInWithOAuth(...a),
      linkIdentity: (...a: unknown[]) => mockLinkIdentity(...a),
      exchangeCodeForSession: (...a: unknown[]) => mockExchangeCode(...a),
      signOut: jest.fn(),
    },
  },
}));

// Drive authorization is a separate grant with its own tokens; nothing here
// touches it.
jest.mock("../useDriveAuth", () => ({
  useDriveAuth: () => ({
    driveAutorizzato: false,
    autorizzaDrive: jest.fn(),
    assicuraAccesso: jest.fn(),
    completaRedirectDrive: jest.fn(),
    dimenticaDrive: jest.fn(),
  }),
}));

jest.mock("@/model/shared/account", () => ({ assicuraAccount: jest.fn().mockResolvedValue("a1") }));
jest.mock("@/model/cache/localCache", () => ({ svuotaCache: jest.fn() }));
jest.mock("@/config/crashReporting", () => ({ reportError: jest.fn() }));

import { dimenticaCodiciUsati } from "@/model/auth/codiciUsati";
import { useAuth } from "../useAuth";

/** A session, as far as this hook is concerned. */
function sessione(providers: string[]) {
  return { user: { id: "u1", email: "tizio@example.com", app_metadata: { providers } } };
}

/** Mounts the hook and waits out the startup effects. */
async function montaHook() {
  const vista = await renderHook(() => useAuth());
  await waitFor(() => expect(vista.result.current.loading).toBe(false));
  return vista;
}

beforeEach(() => {
  jest.clearAllMocks();
  // The code cache is module-level and would make the second test in a file
  // see the first one's authorization code as already spent.
  dimenticaCodiciUsati();

  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockGetUser.mockResolvedValue({ data: { user: null } });
  mockSignInWithOAuth.mockResolvedValue({ data: { url: "https://google/consent" }, error: null });
  mockLinkIdentity.mockResolvedValue({ data: { url: "https://google/consent" }, error: null });
  mockExchangeCode.mockResolvedValue({ data: { session: sessione(["email"]) }, error: null });
});

describe("collegaGoogle", () => {
  it("scambia il codice quando il browser torna con il redirect", async () => {
    mockOpenAuthSession.mockResolvedValue({ type: "success", url: "ripassa://?code=abc" });
    const { result } = await montaHook();

    let esito: boolean | undefined;
    await act(async () => {
      esito = await result.current.collegaGoogle();
    });

    expect(mockLinkIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" })
    );
    expect(mockExchangeCode).toHaveBeenCalledWith("abc");
    expect(esito).toBe(true);
    expect(result.current.error).toBeNull();
  });

  /**
   * Il caso che un controllo ingenuo sbaglierebbe. Il browser non dice niente
   * di utile, il collegamento non è avvenuto — ma una sessione c'è, perché
   * l'utente era già dentro: chiedere "esiste una sessione?" direbbe di sì.
   */
  it("non scambia un fallimento per una riuscita solo perché la sessione esisteva già", async () => {
    mockOpenAuthSession.mockResolvedValue({ type: "dismiss" });
    mockGetSession.mockResolvedValue({ data: { session: sessione(["email"]) } });
    mockGetUser.mockResolvedValue({ data: { user: sessione(["email"]).user } });

    const { result } = await montaHook();

    let esito: boolean | undefined;
    await act(async () => {
      esito = await result.current.collegaGoogle();
    });

    expect(esito).toBe(false);
    expect(result.current.error).toMatch(/browser si è chiuso/i);
  });

  it("riconosce la riuscita quando Google risulta collegato malgrado il browser", async () => {
    mockOpenAuthSession.mockResolvedValue({ type: "dismiss" });
    mockGetUser.mockResolvedValue({ data: { user: sessione(["email", "google"]).user } });

    const { result } = await montaHook();

    let esito: boolean | undefined;
    await act(async () => {
      esito = await result.current.collegaGoogle();
    });

    expect(esito).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("tace quando è l'utente a chiudere il browser", async () => {
    mockOpenAuthSession.mockResolvedValue({ type: "cancel" });
    const { result } = await montaHook();

    await act(async () => {
      await result.current.collegaGoogle();
    });

    expect(result.current.error).toBeNull();
    expect(mockExchangeCode).not.toHaveBeenCalled();
  });

  it("traduce il rifiuto di Supabase invece di mostrarlo grezzo", async () => {
    mockLinkIdentity.mockResolvedValue({
      data: null,
      error: { message: "Identity is already linked to another user" },
    });
    const { result } = await montaHook();

    await act(async () => {
      await result.current.collegaGoogle();
    });

    expect(result.current.error).toMatch(/già collegato a un altro accesso/i);
    expect(mockOpenAuthSession).not.toHaveBeenCalled();
  });
});

describe("signInWithGoogle", () => {
  it("continua a considerare riuscito un login che ha prodotto una sessione", async () => {
    // Stesso esito inconcludente del browser, giudizio opposto: qui la
    // sessione non c'era prima, quindi la sua presenza *è* la riuscita.
    mockOpenAuthSession.mockResolvedValue({ type: "dismiss" });
    const { result } = await montaHook();

    mockGetSession.mockResolvedValue({ data: { session: sessione(["google"]) } });

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(result.current.error).toBeNull();
  });

  it("segnala un redirect senza codice invece di restare in silenzio", async () => {
    mockOpenAuthSession.mockResolvedValue({ type: "success", url: "ripassa://" });
    const { result } = await montaHook();

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(result.current.error).toMatch(/codice di autorizzazione/i);
  });
});
