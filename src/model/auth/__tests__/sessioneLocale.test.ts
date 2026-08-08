/**
 * Tests for the session copy kept on the device.
 *
 * The module has one job — answer "who was signed in here?" without a network —
 * and one rule that matters more than the happy path: it must never be the
 * reason the app fails to start. A Keychain that refuses to answer, a value
 * truncated by a kill during a write, a JSON fragment from an older shape: each
 * one has to come back as "nothing saved", because the alternative is an
 * exception thrown on the first line of a cold start.
 */
const mockStore = new Map<string, string>();
let mockLetturaFallisce = false;
let mockScritturaFallisce = false;

jest.mock("@/config/secureAuthStorage", () => ({
  secureAuthStorage: {
    getItem: async (k: string) => {
      if (mockLetturaFallisce) throw new Error("Keychain non disponibile");
      return mockStore.get(k) ?? null;
    },
    setItem: async (k: string, v: string) => {
      if (mockScritturaFallisce) throw new Error("Keychain non disponibile");
      mockStore.set(k, v);
    },
    removeItem: async (k: string) => {
      mockStore.delete(k);
    },
  },
}));

import type { Session } from "@supabase/supabase-js";
import { dimenticaSessione, leggiSessione, salvaSessione } from "../sessioneLocale";

/** A session, reduced to the fields this module insists on. */
function sessione(): Session {
  return {
    access_token: "at",
    refresh_token: "rt",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "u1", email: "tizio@example.com" },
  } as unknown as Session;
}

beforeEach(() => {
  mockStore.clear();
  mockLetturaFallisce = false;
  mockScritturaFallisce = false;
});

it("restituisce la sessione salvata", async () => {
  await salvaSessione(sessione());

  const letta = await leggiSessione();

  expect(letta?.user.id).toBe("u1");
  expect(letta?.refresh_token).toBe("rt");
});

it("non trova niente su un dispositivo dove non si è mai entrati", async () => {
  expect(await leggiSessione()).toBeNull();
});

it("dimentica la sessione", async () => {
  await salvaSessione(sessione());

  await dimenticaSessione();

  expect(await leggiSessione()).toBeNull();
});

/**
 * Il caso per cui esiste il controllo di forma. Una scrittura interrotta lascia
 * JSON valido ma monco, e aprire l'app con una sessione senza refresh token
 * significa entrare in uno stato che nessuna riconnessione può riparare.
 */
it("rifiuta un valore senza i campi che lo rendono utilizzabile", async () => {
  mockStore.set("turboripassi.sessione-locale", JSON.stringify({ user: { id: "u1" } }));

  expect(await leggiSessione()).toBeNull();
});

it("rifiuta un valore che non è JSON", async () => {
  mockStore.set("turboripassi.sessione-locale", "{ tronca");

  expect(await leggiSessione()).toBeNull();
});

/**
 * Il motivo per cui ogni funzione inghiotte i propri errori: questo modulo
 * viene letto sulla prima riga di un avvio a freddo, e un'eccezione qui
 * sarebbe esattamente il guasto che dovrebbe evitare.
 */
it("un archivio illeggibile è «nessuna sessione», non un errore", async () => {
  mockLetturaFallisce = true;

  await expect(leggiSessione()).resolves.toBeNull();
});

it("una scrittura fallita non risale al chiamante", async () => {
  mockScritturaFallisce = true;

  await expect(salvaSessione(sessione())).resolves.toBeUndefined();
});
