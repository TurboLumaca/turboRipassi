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
  wrap: (c: unknown) => c,
}));

import { resolveSentryDsn } from "../crashReporting";

const DSN_VALIDO = "https://abc123@o42.ingest.sentry.io/99";

afterEach(() => {
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
});

/** Loads a fresh copy of the module, so the one-shot init flag starts unset. */
function caricaModulo(): {
  modulo: typeof import("../crashReporting");
  sentry: { init: jest.Mock; captureException: jest.Mock };
} {
  let modulo!: typeof import("../crashReporting");
  let sentry!: { init: jest.Mock; captureException: jest.Mock };
  jest.isolateModules(() => {
    sentry = require("@sentry/react-native");
    sentry.init.mockClear();
    sentry.captureException.mockClear();
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
