/**
 * Storage sicuro per la sessione Supabase (JWT + refresh token).
 * AsyncStorage salva in chiaro sul filesystem: qui usiamo SecureStore
 * (Keychain su iOS, Keystore su Android), cifrato dal sistema operativo.
 *
 * SecureStore impone un limite pratico di ~2KB per voce, ma il JSON di
 * sessione di Supabase lo supera: il valore viene quindi spezzato in più
 * voci indicizzate (pattern raccomandato da Supabase per React Native).
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
    if (part === null) return null; // chunk mancante: dato corrotto/parziale
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

/** Adapter compatibile con l'interfaccia `storage` di supabase-js. */
export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const chunked = await readChunked(key);
    if (chunked !== null) return chunked;
    // Valore piccolo, mai spezzato: salvato direttamente sotto `key`.
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    // Ripulisce eventuale stato precedente (diretto o chunked) prima di riscrivere.
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
