/**
 * Tests for crashReporting DSN resolution and the init guard. Sentry is mocked:
 * we assert the resolution/guard logic, not the SDK. init tests use
 * isolateModules to reset the module-level "initialized" flag.
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

afterEach(() => {
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
});

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
    const dsn = "https://abc123@o42.ingest.sentry.io/99";
    process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
    expect(resolveSentryDsn()).toBe(dsn);
  });

});

describe("initCrashReporting", () => {
  it("does not enable reporting without a DSN", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.isolateModules(() => {
      const mod = require("../crashReporting");
      mod.initCrashReporting();
      expect(mod.isCrashReportingEnabled()).toBe(false);
    });
    warn.mockRestore();
  });

  it("enables reporting when a valid DSN is present", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://abc123@o42.ingest.sentry.io/99";
    jest.isolateModules(() => {
      const mod = require("../crashReporting");
      mod.initCrashReporting();
      expect(mod.isCrashReportingEnabled()).toBe(true);
    });
  });
});
