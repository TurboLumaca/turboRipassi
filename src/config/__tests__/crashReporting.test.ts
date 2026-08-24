/**
 * Tests for crashReporting: DSN resolution, and what the module actually asks
 * of the Sentry SDK. The SDK is mocked, so the assertions are on the options
 * passed to init — the choices documented in the report (no reporting in
 * __DEV__, no performance tracing) are only real if they reach the SDK.
 *
 * Note: the env-var branch is covered here. The extra.sentryDsn (app.json)
 * fallback isn't unit-tested because jest-expo replaces expo-constants at the
 * native level (Constants.expoConfig is undefined under jest and can't be
 * overridden). That branch is identical to the trusted supabase.ts /
 * driveConfig.ts read pattern and is exercised in real builds via app.json.
 */

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
  wrap: (c: unknown) => c,
}));

// Le segnalazioni escono dall'app come mail, e a spedirle e' una Edge
// Function: qui si asserisce il corpo che parte e la lettura della risposta,
// non il transport di Sentry.
jest.mock("../supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

import { resolveSentryDsn } from "../crashReporting";

const DSN_VALIDO = "https://abc123@o42.ingest.sentry.io/99";

afterEach(() => {
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
});

interface FintoSentry {
  init: jest.Mock;
  captureException: jest.Mock;
  captureMessage: jest.Mock;
  flush: jest.Mock;
}

/** L'invoke della Edge Function, ricaricato insieme al modulo. */
function fintoInvoke(): jest.Mock {
  return require("../supabase").supabase.functions.invoke as jest.Mock;
}

/** Loads a fresh copy of the module, so the one-shot init flag starts unset. */
function caricaModulo(): {
  modulo: typeof import("../crashReporting");
  sentry: FintoSentry;
} {
  let modulo!: typeof import("../crashReporting");
  let sentry!: FintoSentry;
  jest.isolateModules(() => {
    sentry = require("@sentry/react-native");
    sentry.init.mockClear();
    sentry.captureException.mockClear();
    sentry.captureMessage.mockClear();
    sentry.flush.mockClear().mockResolvedValue(true);
    fintoInvoke().mockReset().mockResolvedValue({ data: { ok: true }, error: null });
    modulo = require("../crashReporting");
  });
  return { modulo, sentry };
}

describe("resolveSentryDsn", () => {
  it("returns null when nothing is configured", () => {
    expect(resolveSentryDsn()).toBeNull();
  });

  it("treats the placeholder value as not configured", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = "SENTRY_DSN_PLACEHOLDER";
    expect(resolveSentryDsn()).toBeNull();
  });

  it("treats the example xxxxxxxx value as not configured", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://xxxxxxxx@oxxxxxxx.ingest.sentry.io/1";
    expect(resolveSentryDsn()).toBeNull();
  });

  it("reads a real DSN from the env var", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN_VALIDO;
    expect(resolveSentryDsn()).toBe(DSN_VALIDO);
  });
});

describe("initCrashReporting", () => {
  it("does not touch the SDK without a DSN", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { modulo, sentry } = caricaModulo();

    modulo.initCrashReporting();

    expect(sentry.init).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("initializes with the resolved DSN and the documented options", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN_VALIDO;
    const { modulo, sentry } = caricaModulo();

    modulo.initCrashReporting();

    expect(sentry.init).toHaveBeenCalledTimes(1);
    const opzioni = sentry.init.mock.calls[0][0];
    expect(opzioni.dsn).toBe(DSN_VALIDO);
    // Development errors must not reach the production dashboard, and crash
    // reporting is the goal here — performance tracing is not.
    expect(opzioni.enabled).toBe(!__DEV__);
    expect(opzioni.environment).toBe(__DEV__ ? "development" : "production");
    expect(opzioni.tracesSampleRate).toBe(0);
  });

  it("initializes at most once", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN_VALIDO;
    const { modulo, sentry } = caricaModulo();

    modulo.initCrashReporting();
    modulo.initCrashReporting();

    expect(sentry.init).toHaveBeenCalledTimes(1);
  });
});

describe("reportError", () => {
  it("stays silent when reporting was never initialized", () => {
    const { modulo, sentry } = caricaModulo();

    modulo.reportError(new Error("boom"), { operazione: "test" });

    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("forwards the error and its context once initialized", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN_VALIDO;
    const { modulo, sentry } = caricaModulo();
    const errore = new Error("boom");

    modulo.initCrashReporting();
    modulo.reportError(errore, { operazione: "ruotaCache", falliti: 2 });

    expect(sentry.captureException).toHaveBeenCalledWith(errore, {
      extra: { operazione: "ruotaCache", falliti: 2 },
    });
  });

  it("omits the extra block when there is no context", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN_VALIDO;
    const { modulo, sentry } = caricaModulo();

    modulo.initCrashReporting();
    modulo.reportError(new Error("boom"));

    expect(sentry.captureException.mock.calls[0][1]).toBeUndefined();
  });
});

/**
 * Problem reports. Unlike a crash, this one is sent while the user is looking
 * at the screen and waiting for an answer, and it is not telemetry: it is a
 * message to a person, so it leaves as an email through the Edge Function.
 * What is asserted here is that the answer on screen matches what the function
 * said, and that the context the user should not have to reconstruct travels
 * with it.
 */
describe("inviaSegnalazione", () => {
  const DATI = {
    descrizione: "ho allegato una foto e non è stata caricata",
    email: "tizio@example.com",
    ultimoErrore: "caricaAllegato: Non c'è spazio sufficiente",
  };

  it("allega quello che l'utente non dovrebbe dover ricostruire", async () => {
    const { modulo } = caricaModulo();

    await expect(modulo.inviaSegnalazione(DATI)).resolves.toBe("inviata");

    const [nome, opzioni] = fintoInvoke().mock.calls[0];
    expect(nome).toBe("segnala-problema");
    expect(opzioni.body).toMatchObject({
      descrizione: DATI.descrizione,
      email: DATI.email,
      ultimoErrore: DATI.ultimoErrore,
    });
    // Piattaforma e versione: la prima domanda di chi legge la segnalazione.
    expect(opzioni.body.piattaforma).toBeDefined();
    expect(opzioni.body.versioneApp).toBeDefined();
  });

  it("registra un null esplicito quando non c'è un errore da allegare", async () => {
    const { modulo } = caricaModulo();

    await modulo.inviaSegnalazione({ descrizione: "l'app è lenta" });

    expect(fintoInvoke().mock.calls[0][1].body).toMatchObject({
      email: null,
      ultimoErrore: null,
    });
  });

  it("parte anche senza DSN: la mail non dipende da Sentry", async () => {
    const { modulo, sentry } = caricaModulo();

    await expect(modulo.inviaSegnalazione(DATI)).resolves.toBe("inviata");

    expect(fintoInvoke()).toHaveBeenCalledTimes(1);
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("manda a Sentry una copia quando è configurato", async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN_VALIDO;
    const { modulo, sentry } = caricaModulo();
    modulo.initCrashReporting();

    await modulo.inviaSegnalazione(DATI);

    expect(sentry.captureMessage).toHaveBeenCalledWith("Segnalazione utente", {
      level: "info",
      extra: expect.objectContaining({ descrizione: DATI.descrizione }),
    });
  });

  // 501 e' la funzione che dice di non avere un provider di posta: non c'e'
  // niente da riprovare, ed e' una frase diversa da "non e' partita".
  it("distingue «non configurato» da «non riuscita»", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { modulo } = caricaModulo();
    fintoInvoke().mockResolvedValue({
      data: null,
      error: Object.assign(new Error("non configurato"), { context: { status: 501 } }),
    });

    await expect(modulo.inviaSegnalazione(DATI)).resolves.toBe("nonConfigurato");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("dice che non è partita quando la funzione risponde con un errore", async () => {
    const { modulo } = caricaModulo();
    fintoInvoke().mockResolvedValue({
      data: null,
      error: Object.assign(new Error("boom"), { context: { status: 502 } }),
    });

    await expect(modulo.inviaSegnalazione(DATI)).resolves.toBe("nonRiuscita");
  });

  it("non lascia sfuggire l'errore di rete", async () => {
    const { modulo } = caricaModulo();
    fintoInvoke().mockRejectedValue(new Error("offline"));

    await expect(modulo.inviaSegnalazione(DATI)).resolves.toBe("nonRiuscita");
  });
});
