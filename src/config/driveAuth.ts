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
import { DRIVE_SCOPES, GOOGLE_CLIENT_ID, isDriveConfigured } from "./driveConfig";
import type { DriveTokenManager, DriveTokens } from "@/model/driveTypes";

const STORE_KEY = "drive_tokens_v1";
// Safety margin: refresh if it expires within 60s.
const EXPIRY_SKEW_MS = 60_000;

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

// Redirect into the app via the custom "ripassa" scheme.
function redirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: "ripassa", path: "drive-auth" });
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
      redirectUri: redirectUri(),
      usePKCE: true,
      // access_type=offline + prompt=consent → Google returns a refresh token.
      extraParams: { access_type: "offline", prompt: "consent" },
    });

    const result = await request.promptAsync(discovery);
    if (result.type !== "success" || !result.params.code) return false;

    const exchange = await AuthSession.exchangeCodeAsync(
      {
        clientId: GOOGLE_CLIENT_ID,
        code: result.params.code,
        redirectUri: redirectUri(),
        extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
      },
      discovery
    );

    await saveTokens({
      accessToken: exchange.accessToken,
      refreshToken: exchange.refreshToken ?? null,
      expiresAt: Date.now() + (exchange.expiresIn ?? 3600) * 1000,
      scope: exchange.scope ?? DRIVE_SCOPES.join(" "),
    });
    return true;
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(STORE_KEY);
  },
};
