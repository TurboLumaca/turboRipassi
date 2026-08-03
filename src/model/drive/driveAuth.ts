/**
 * Config/Model — Google Drive token manager.
 *
 * OAuth 2.0 authorization with PKCE + offline access (via expo-auth-session),
 * so we get a refresh token and can renew the access token ourselves
 * (Supabase doesn't expose provider_token in a renewable way).
 *
 * Tokens are saved in SecureStore (Keychain/Keystore), encrypted at rest,
 * never sent to Supabase. Implements the DriveTokenManager interface.
 */
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";
import { DRIVE_SCOPES, GOOGLE_CLIENT_ID, isDriveConfigured } from "@/config/driveConfig";
import { parametriRedirect } from "@/model/auth/oauthRedirect";
import type { DriveTokenManager, DriveTokens } from "./driveTypes";

const STORE_KEY = "drive_tokens_v1";
const PENDING_KEY = "drive_pending_auth_v1";
// Safety margin: refresh if it expires within 60s.
const EXPIRY_SKEW_MS = 60_000;

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

// Google's native OAuth clients (iOS/Android) don't accept an arbitrary
// custom scheme as redirect: they require one derived from the app's bundle id
// / package name, in the form `<applicationId>:/oauthredirect`. This is exactly
// what expo-auth-session's own Google provider uses. Using the generic
// "ripassa://" scheme instead makes Google reject the request with
// `Error 400: invalid_request` (unrecognized redirect_uri).
// Note: in Expo Go the scheme can't be honored and this becomes an `exp://…`
// URL, which Google also rejects — a standalone/dev build is required.
export function driveRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    native: `${Application.applicationId}:/oauthredirect`,
  });
}

/**
 * An authorization started but not yet finished. Persisted because the app may
 * not survive the round trip through the browser: Android is free to kill a
 * backgrounded process, and the PKCE verifier only ever lived inside the
 * AuthRequest instance, so the redirect came back to an app that no longer had
 * any way to use it.
 */
interface AutorizzazioneInSospeso {
  codeVerifier: string;
  state: string;
}

// Authorization codes are single-use, and the redirect reaches us twice when
// the process does survive: once as the browser result, once as a deep link.
const codiciUsati = new Set<string>();

/** Exchanges an authorization code for tokens and stores them. */
async function completaScambio(code: string, codeVerifier: string | null): Promise<boolean> {
  if (codiciUsati.has(code)) return true;
  codiciUsati.add(code);

  const exchange = await AuthSession.exchangeCodeAsync(
    {
      clientId: GOOGLE_CLIENT_ID,
      code,
      redirectUri: driveRedirectUri(),
      extraParams: codeVerifier ? { code_verifier: codeVerifier } : undefined,
    },
    discovery
  );
  await saveTokens({
    accessToken: exchange.accessToken,
    refreshToken: exchange.refreshToken ?? null,
    expiresAt: Date.now() + (exchange.expiresIn ?? 3600) * 1000,
    scope: exchange.scope ?? DRIVE_SCOPES.join(" "),
  });
  await SecureStore.deleteItemAsync(PENDING_KEY);
  return true;
}

async function loadTokens(): Promise<DriveTokens | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DriveTokens;
  } catch {
    return null;
  }
}

async function saveTokens(t: DriveTokens): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(t));
}

/** Renews the access token using the refresh token (direct call to Google). */
async function refresh(tokens: DriveTokens): Promise<DriveTokens | null> {
  if (!tokens.refreshToken) return null;
  try {
    const result = await AuthSession.refreshAsync(
      { clientId: GOOGLE_CLIENT_ID, refreshToken: tokens.refreshToken, scopes: DRIVE_SCOPES },
      discovery
    );
    const refreshed: DriveTokens = {
      accessToken: result.accessToken,
      // Google doesn't always return a new refresh token: reuse the previous one.
      refreshToken: result.refreshToken ?? tokens.refreshToken,
      expiresAt: Date.now() + (result.expiresIn ?? 3600) * 1000,
      scope: result.scope ?? tokens.scope,
    };
    await saveTokens(refreshed);
    return refreshed;
  } catch {
    // Refresh token revoked/expired: the user will need to re-authorize.
    return null;
  }
}

export const driveTokenManager: DriveTokenManager = {
  async getValidAccessToken(): Promise<string | null> {
    let tokens = await loadTokens();
    if (!tokens) return null;
    if (Date.now() < tokens.expiresAt - EXPIRY_SKEW_MS) return tokens.accessToken;
    tokens = await refresh(tokens);
    return tokens?.accessToken ?? null;
  },

  async isAuthorized(): Promise<boolean> {
    const tokens = await loadTokens();
    return tokens !== null;
  },

  async authorize(): Promise<boolean> {
    if (!isDriveConfigured()) {
      throw new Error(
        "Google Drive non configurato: imposta EXPO_PUBLIC_GOOGLE_CLIENT_ID nel file .env."
      );
    }
    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: DRIVE_SCOPES,
      redirectUri: driveRedirectUri(),
      usePKCE: true,
      // access_type=offline + prompt=consent → Google returns a refresh token.
      extraParams: { access_type: "offline", prompt: "consent" },
    });

    // Builds the authorization url, and with it the PKCE verifier: it has to
    // exist before it can be persisted, and promptAsync would otherwise be the
    // first thing to create it.
    await request.makeAuthUrlAsync(discovery);
    const sospesa: AutorizzazioneInSospeso = {
      codeVerifier: request.codeVerifier ?? "",
      state: request.state,
    };
    await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(sospesa));

    const result = await request.promptAsync(discovery);
    if (result.type !== "success" || !result.params.code) return false;
    return completaScambio(result.params.code, request.codeVerifier ?? null);
  },

  async completaAutorizzazione(url: string): Promise<boolean> {
    const params = parametriRedirect(url);
    if (!params.code) return false;

    const raw = await SecureStore.getItemAsync(PENDING_KEY);
    if (!raw) return false;
    let sospesa: AutorizzazioneInSospeso;
    try {
      sospesa = JSON.parse(raw) as AutorizzazioneInSospeso;
    } catch {
      await SecureStore.deleteItemAsync(PENDING_KEY);
      return false;
    }

    // CSRF guard: the code has to belong to the request we started. Normally
    // AuthRequest checks this itself, but on this path there is no longer an
    // AuthRequest to check it.
    if (params.state && sospesa.state && params.state !== sospesa.state) return false;
    return completaScambio(params.code, sospesa.codeVerifier || null);
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(STORE_KEY);
    await SecureStore.deleteItemAsync(PENDING_KEY);
  },
};
