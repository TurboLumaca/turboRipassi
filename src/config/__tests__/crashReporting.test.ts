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
 * at the screen and waiting for an answer, so what matters as much as the
 * payload is that the answer is honest: "inviata" must mean the event left the
 * device, which is what the flush is there for.
 */
describe("inviaSegnalazione", () => {
  const DATI = {
    descrizione: "ho allegato una foto e non è stata caricata",
    email: "tizio@example.com",
    ultimoErrore: "caricaAllegato: Non c'è spazio sufficiente",
  };

  it("non tocca l'SDK quando le segnalazioni non sono configurate", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { modulo, sentry } = caricaModulo();

    await expect(modulo.inviaSegnalazione(DATI)).resolves.toBe("nonConfigurato");

    expect(sentry.captureMessage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("allega quello che l'utente non dovrebbe dover ricostruire", async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN_VALIDO;
    const { modulo, sentry } = caricaModulo();
    modulo.initCrashReporting();

    await modulo.inviaSegnalazione(DATI);

    const [messaggio, opzioni] = sentry.captureMessage.mock.calls[0];
    expect(messaggio).toBe("Segnalazione utente");
    expect(opzioni.extra).toMatchObject({
      descrizione: DATI.descrizione,
      email: DATI.email,
      ultimoErrore: DATI.ultimoErrore,
    });
    // Piattaforma e versione: la prima domanda di chi legge la segnalazione.
    expect(opzioni.extra.piattaforma).toBeDefined();
    expect(opzioni.extra.versioneApp).toBeDefined();
  });

  it("registra un null esplicito quando non c'è un errore da allegare", async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN_VALIDO;
    const { modulo, sentry } = caricaModulo();
    modulo.initCrashReporting();

    await modulo.inviaSegnalazione({ descrizione: "l'app è lenta" });

    expect(sentry.captureMessage.mock.calls[0][1].extra).toMatchObject({
      email: null,
      ultimoErrore: null,
    });
  });

  // Senza l'attesa, la schermata direbbe "inviata" a chi è in galleria senza
  // connessione: l'evento sarebbe solo in coda.
  it("conferma l'invio solo quando la coda si è svuotata", async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN_VALIDO;
    const { modulo, sentry } = caricaModulo();
    modulo.initCrashReporting();

    await expect(modulo.inviaSegnalazione(DATI)).resolves.toBe("inviata");
    expect(sentry.flush).toHaveBeenCalledTimes(1);
  });

  it("dice che non è partita quando la coda non si svuota", async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN_VALIDO;
    const { modulo, sentry } = caricaModulo();
    modulo.initCrashReporting();
    sentry.flush.mockResolvedValue(false);

    await expect(modulo.inviaSegnalazione(DATI)).resolves.toBe("nonRiuscita");
  });

  it("non lascia sfuggire l'errore del trasporto", async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN_VALIDO;
    const { modulo, sentry } = caricaModulo();
    modulo.initCrashReporting();
    sentry.flush.mockRejectedValue(new Error("transport chiuso"));

    await expect(modulo.inviaSegnalazione(DATI)).resolves.toBe("nonRiuscita");
  });
});
