/**
 * Tests for the Drive token manager.
 *
 * The relazione says the OAuth flows are not simulated because "simulating it
 * would give confidence in a model, not in the device". That holds for *when*
 * the redirect arrives and whether the process survives it — not for what the
 * code does with the state it receives, the verifier it persists, or a refresh
 * token Google has revoked. Those are deterministic, and they are what this
 * file covers. The browser round trip itself stays out.
 *
 * SecureStore and expo-auth-session are mocked; the module under test is
 * imported afterwards so it picks them up.
 */

// --- Mocks ------------------------------------------------------------------
/** In-memory stand-in for the Keychain/Keystore. */
const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => {
    mockStore.set(k, v);
  },
  deleteItemAsync: async (k: string) => {
    mockStore.delete(k);
  },
}));

jest.mock("expo-application", () => ({ applicationId: "com.turboLumaca.turboRipassi" }));

const mockExchange = jest.fn();
const mockRefresh = jest.fn();
const mockMakeAuthUrl = jest.fn();
const mockPrompt = jest.fn();
/** The AuthRequest the manager built, so a test can inspect what it persisted. */
let mockUltimaRichiesta: MockAuthRequest | null = null;

class MockAuthRequest {
  codeVerifier: string | undefined;
  state = "stato-generato";
  constructor(public config: Record<string, unknown>) {
    mockUltimaRichiesta = this;
  }
  async makeAuthUrlAsync(...args: unknown[]) {
    // The real one creates the PKCE verifier here, not in promptAsync.
    this.codeVerifier = "verifier-pkce";
    return mockMakeAuthUrl(...args);
  }
  async promptAsync(...args: unknown[]) {
    return mockPrompt(...args);
  }
}

jest.mock("expo-auth-session", () => ({
  AuthRequest: class {
    constructor(config: Record<string, unknown>) {
      return new MockAuthRequest(config) as never;
    }
  },
  makeRedirectUri: ({ native }: { native: string }) => native,
  exchangeCodeAsync: (...args: unknown[]) => mockExchange(...args),
  refreshAsync: (...args: unknown[]) => mockRefresh(...args),
}));

jest.mock("@/config/driveConfig", () => ({
  GOOGLE_CLIENT_ID: "client-id-di-test",
  DRIVE_SCOPES: ["https://www.googleapis.com/auth/drive.file"],
  isDriveConfigured: () => true,
}));

// Imported after the mocks so the module picks them up.
import { driveRedirectUri, driveTokenManager } from "../driveAuth";
import { dimenticaCodiciUsati } from "@/model/auth/codiciUsati";

const CHIAVE_TOKEN = "drive_tokens_v1";
const CHIAVE_SOSPESA = "drive_pending_auth_v1";

/** Tokens as they sit in SecureStore, valid unless told otherwise. */
function scriviTokens(over: Partial<Record<string, unknown>> = {}) {
  mockStore.set(
    CHIAVE_TOKEN,
    JSON.stringify({
      accessToken: "access-valido",
      refreshToken: "refresh-valido",
      expiresAt: Date.now() + 3_600_000,
      scope: "https://www.googleapis.com/auth/drive.file",
      ...over,
    })
  );
}

/** A pending authorization, as `authorize` leaves it before the browser. */
function scriviSospesa(over: Partial<{ codeVerifier: string; state: string }> = {}) {
  mockStore.set(
    CHIAVE_SOSPESA,
    JSON.stringify({ codeVerifier: "verifier-pkce", state: "stato-generato", ...over })
  );
}

beforeEach(() => {
  mockStore.clear();
  mockUltimaRichiesta = null;
  dimenticaCodiciUsati();
  jest.clearAllMocks();
  mockExchange.mockResolvedValue({
    accessToken: "access-nuovo",
    refreshToken: "refresh-nuovo",
    expiresIn: 3600,
    scope: "https://www.googleapis.com/auth/drive.file",
  });
});

describe("driveRedirectUri", () => {
  // Google's native clients reject an arbitrary custom scheme; the redirect
  // has to derive from the application id.
  it("derives from the application id, not from the app scheme", () => {
    expect(driveRedirectUri()).toBe("com.turboLumaca.turboRipassi:/oauthredirect");
  });
});

describe("isAuthorized", () => {
  it("is false with nothing stored", async () => {
    await expect(driveTokenManager.isAuthorized()).resolves.toBe(false);
  });

  it("is true once tokens are stored", async () => {
    scriviTokens();
    await expect(driveTokenManager.isAuthorized()).resolves.toBe(true);
  });

  it("treats unreadable storage as not authorized", async () => {
    mockStore.set(CHIAVE_TOKEN, "{ non json");
    await expect(driveTokenManager.isAuthorized()).resolves.toBe(false);
  });
});

describe("authorize", () => {
  /**
   * The verifier must be on disk *before* the browser opens: Android is free
   * to kill the process while the browser is in front, and a verifier that
   * only ever lived in the AuthRequest dies with it — which is the failure
   * the pending-authorization record exists to prevent.
   */
  it("persists the PKCE verifier before opening the browser", async () => {
    let sospesaAllApertura: string | null = null;
    mockPrompt.mockImplementation(async () => {
      sospesaAllApertura = mockStore.get(CHIAVE_SOSPESA) ?? null;
      return { type: "success", params: { code: "codice-1" } };
    });

    await driveTokenManager.authorize();

    expect(sospesaAllApertura).not.toBeNull();
    expect(JSON.parse(sospesaAllApertura!)).toEqual({
      codeVerifier: "verifier-pkce",
      state: "stato-generato",
    });
  });

  it("asks Google for a refresh token", async () => {
    mockPrompt.mockResolvedValue({ type: "success", params: { code: "codice-1" } });
    await driveTokenManager.authorize();
    expect(mockUltimaRichiesta!.config.extraParams).toEqual({
      access_type: "offline",
      prompt: "consent",
    });
    expect(mockUltimaRichiesta!.config.usePKCE).toBe(true);
  });

  it("stores the tokens and clears the pending record on success", async () => {
    mockPrompt.mockResolvedValue({ type: "success", params: { code: "codice-1" } });

    await expect(driveTokenManager.authorize()).resolves.toBe(true);

    expect(JSON.parse(mockStore.get(CHIAVE_TOKEN)!)).toMatchObject({
      accessToken: "access-nuovo",
      refreshToken: "refresh-nuovo",
    });
    expect(mockStore.has(CHIAVE_SOSPESA)).toBe(false);
  });

  it("returns false and exchanges nothing when the user dismisses the browser", async () => {
    mockPrompt.mockResolvedValue({ type: "dismiss", params: {} });
    await expect(driveTokenManager.authorize()).resolves.toBe(false);
    expect(mockExchange).not.toHaveBeenCalled();
  });
});

describe("completaAutorizzazione", () => {
  it("exchanges the code when the state matches the one we started with", async () => {
    scriviSospesa();
    await expect(
      driveTokenManager.completaAutorizzazione("app:/oauthredirect?code=abc&state=stato-generato")
    ).resolves.toBe(true);
    expect(mockExchange).toHaveBeenCalledTimes(1);
  });

  // The CSRF guard. On this path there is no AuthRequest left to check it.
  it("refuses a redirect whose state is not the one we started with", async () => {
    scriviSospesa();
    await expect(
      driveTokenManager.completaAutorizzazione("app:/oauthredirect?code=abc&state=altro")
    ).resolves.toBe(false);
    expect(mockExchange).not.toHaveBeenCalled();
  });

  /**
   * Regression: the guard used to require *both* states to be present, so a
   * redirect that simply carried none skipped the check — which is precisely
   * what someone choosing what to send would do.
   */
  it("refuses a redirect that carries no state at all", async () => {
    scriviSospesa();
    await expect(
      driveTokenManager.completaAutorizzazione("app:/oauthredirect?code=abc")
    ).resolves.toBe(false);
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("passes the persisted verifier to the exchange", async () => {
    scriviSospesa({ codeVerifier: "verifier-sopravvissuto" });
    await driveTokenManager.completaAutorizzazione(
      "app:/oauthredirect?code=abc&state=stato-generato"
    );
    expect(mockExchange.mock.calls[0][0].extraParams).toEqual({
      code_verifier: "verifier-sopravvissuto",
    });
  });

  it("does nothing when no authorization was pending", async () => {
    await expect(
      driveTokenManager.completaAutorizzazione("app:/oauthredirect?code=abc&state=x")
    ).resolves.toBe(false);
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("does nothing when the redirect carries no code", async () => {
    scriviSospesa();
    await expect(
      driveTokenManager.completaAutorizzazione("app:/oauthredirect?error=access_denied")
    ).resolves.toBe(false);
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("discards an unreadable pending record instead of throwing", async () => {
    mockStore.set(CHIAVE_SOSPESA, "{ non json");
    await expect(
      driveTokenManager.completaAutorizzazione("app:/oauthredirect?code=abc&state=x")
    ).resolves.toBe(false);
    expect(mockStore.has(CHIAVE_SOSPESA)).toBe(false);
  });

  /**
   * The same redirect reaches the app twice when the process survives: once as
   * the browser result, once as a deep link. The second arrival must not spend
   * the code again.
   */
  it("exchanges a code only once, however many times the redirect arrives", async () => {
    scriviSospesa();
    const url = "app:/oauthredirect?code=abc&state=stato-generato";
    await driveTokenManager.completaAutorizzazione(url);
    scriviSospesa();
    await expect(driveTokenManager.completaAutorizzazione(url)).resolves.toBe(true);
    expect(mockExchange).toHaveBeenCalledTimes(1);
  });
});

describe("getValidAccessToken", () => {
  it("is null with nothing stored", async () => {
    await expect(driveTokenManager.getValidAccessToken()).resolves.toBeNull();
  });

  it("returns the stored token while it is still valid", async () => {
    scriviTokens();
    await expect(driveTokenManager.getValidAccessToken()).resolves.toBe("access-valido");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  // 60s of margin: a token about to expire is refreshed now rather than
  // failing halfway through an upload.
  it("refreshes a token that expires within the safety margin", async () => {
    scriviTokens({ expiresAt: Date.now() + 30_000 });
    mockRefresh.mockResolvedValue({ accessToken: "access-rinnovato", expiresIn: 3600 });

    await expect(driveTokenManager.getValidAccessToken()).resolves.toBe("access-rinnovato");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous refresh token when Google does not return a new one", async () => {
    scriviTokens({ expiresAt: Date.now() - 1000 });
    mockRefresh.mockResolvedValue({ accessToken: "access-rinnovato", expiresIn: 3600 });

    await driveTokenManager.getValidAccessToken();

    expect(JSON.parse(mockStore.get(CHIAVE_TOKEN)!).refreshToken).toBe("refresh-valido");
  });

  /**
   * Regression (commit ef3c315): tokens whose refresh Google has revoked still
   * count as authorized but yield no access token, so every upload used to
   * fail deep inside the Drive client instead of asking for consent again.
   */
  it("is null when the refresh token has been revoked", async () => {
    scriviTokens({ expiresAt: Date.now() - 1000 });
    mockRefresh.mockRejectedValue(new Error("invalid_grant"));

    await expect(driveTokenManager.getValidAccessToken()).resolves.toBeNull();
  });

  // Offline is not revoked: discarding a good refresh token over a dropped
  // connection would force a pointless re-authorization.
  it("keeps the stored tokens when the refresh fails", async () => {
    scriviTokens({ expiresAt: Date.now() - 1000 });
    mockRefresh.mockRejectedValue(new Error("network"));

    await driveTokenManager.getValidAccessToken();

    expect(mockStore.has(CHIAVE_TOKEN)).toBe(true);
  });

  it("is null when there is no refresh token to renew with", async () => {
    scriviTokens({ expiresAt: Date.now() - 1000, refreshToken: null });
    await expect(driveTokenManager.getValidAccessToken()).resolves.toBeNull();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("clear", () => {
  it("removes both the tokens and any pending authorization", async () => {
    scriviTokens();
    scriviSospesa();

    await driveTokenManager.clear();

    expect(mockStore.has(CHIAVE_TOKEN)).toBe(false);
    expect(mockStore.has(CHIAVE_SOSPESA)).toBe(false);
  });

  /**
   * Otherwise a re-authorization in the same process would still carry the
   * previous one's spent codes, and its fresh code would look already used.
   */
  it("lets a code be exchanged again after a re-authorization", async () => {
    scriviSospesa();
    const url = "app:/oauthredirect?code=abc&state=stato-generato";
    await driveTokenManager.completaAutorizzazione(url);

    await driveTokenManager.clear();

    scriviSospesa();
    await driveTokenManager.completaAutorizzazione(url);
    expect(mockExchange).toHaveBeenCalledTimes(2);
  });
});
