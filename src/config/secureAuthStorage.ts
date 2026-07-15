/**
 * Secure storage for the Supabase session (JWT + refresh token).
 * AsyncStorage saves in plaintext on disk: here we use SecureStore
 * (Keychain on iOS, Keystore on Android), encrypted by the OS.
 *
 * SecureStore enforces a practical ~2KB limit per entry, but Supabase's
 * session JSON exceeds it, so the value is split into indexed chunks
 * (pattern recommended by Supabase for React Native).
 */
import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1800;
const META_SUFFIX = "_chunks";

async function readChunked(key: string): Promise<string | null> {
  const meta = await SecureStore.getItemAsync(`${key}${META_SUFFIX}`);
  if (!meta) return null;
  const count = parseInt(meta, 10);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${key}_${i}`);
    if (part === null) return null; // missing chunk: corrupted/partial data
    parts.push(part);
  }
  return parts.join("");
}

async function deleteChunked(key: string): Promise<void> {
  const meta = await SecureStore.getItemAsync(`${key}${META_SUFFIX}`);
  if (!meta) return;
  const count = parseInt(meta, 10);
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(`${key}_${i}`);
  }
  await SecureStore.deleteItemAsync(`${key}${META_SUFFIX}`);
}

/** Adapter compatible with the supabase-js `storage` interface. */
export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const chunked = await readChunked(key);
    if (chunked !== null) return chunked;
    // Small value, never chunked: stored directly under `key`.
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    // Clear any previous state (direct or chunked) before rewriting.
    await deleteChunked(key);
    await SecureStore.deleteItemAsync(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}_${i}`, chunk);
    }
    await SecureStore.setItemAsync(`${key}${META_SUFFIX}`, String(count));
  },

  async removeItem(key: string): Promise<void> {
    await deleteChunked(key);
    await SecureStore.deleteItemAsync(key);
  },
};
