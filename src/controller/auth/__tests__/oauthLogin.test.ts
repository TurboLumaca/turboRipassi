/**
 * Tests for the Google login helpers that hold no React state.
 *
 * `providerCollegati` reads a field the app does not control: app_metadata is
 * whatever Supabase put in the JWT, and an older session, an anonymous user
 * or a provider list that never got written all reach this function. Every
 * one of them must come out as "no providers", not as a crash on a screen the
 * user reached by simply opening the app.
 */
import { providerCollegati } from "../oauthLogin";
import type { User } from "@supabase/supabase-js";

/** Minimal stand-in: only app_metadata is read. */
function utente(app_metadata: Record<string, unknown>): User {
  return { app_metadata } as unknown as User;
}

describe("providerCollegati", () => {
  it("reads the providers attached to the session", () => {
    expect(providerCollegati(utente({ providers: ["email", "google"] }))).toEqual([
      "email",
      "google",
    ]);
  });

  it("returns nothing for a missing user", () => {
    expect(providerCollegati(null)).toEqual([]);
    expect(providerCollegati(undefined)).toEqual([]);
  });

  it("returns nothing when app_metadata carries no provider list", () => {
    expect(providerCollegati(utente({}))).toEqual([]);
  });

  // Supabase documents `providers` as an array, but app_metadata is typed as
  // free-form: a single string is exactly the shape that would slip through a
  // `.includes()` and match substrings ("google" inside "googleworkspace").
  it("ignores a providers field that is not an array", () => {
    expect(providerCollegati(utente({ providers: "google" }))).toEqual([]);
  });

  it("drops non-string entries instead of passing them on", () => {
    expect(providerCollegati(utente({ providers: ["email", null, 7] }))).toEqual(["email"]);
  });
});
