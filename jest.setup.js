/**
 * Jest setup — placeholder configuration so importing a module never explodes.
 *
 * `config/supabase.ts` builds the client at import time, and supabase-js
 * rejects an empty url outright. Any test that reaches that module through a
 * chain of imports — a Controller test, for instance, even one that never
 * touches the network — would fail to load rather than fail an assertion.
 * These values are deliberately obvious fakes: nothing in the suite talks to a
 * real backend, every test that cares about configuration sets its own values.
 */
process.env.EXPO_PUBLIC_SUPABASE_URL ||= "https://test.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= "chiave-di-test";

/**
 * `@sentry/react-native` starts a cleanup interval as a side effect of being
 * imported — before `Sentry.init()` is ever called, and never `.unref()`'d.
 * crashReporting.ts already no-ops without a DSN, but merely importing the
 * SDK through it (from any test that reaches crashReporting via some other
 * module, not just crashReporting.test.ts, which mocks it explicitly for its
 * own assertions and overrides this) left that timer running past the test
 * file's teardown, which is what kept a Jest worker from exiting cleanly.
 */
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
  wrap: (c) => c,
}));
