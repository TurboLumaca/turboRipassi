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
