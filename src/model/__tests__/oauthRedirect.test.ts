/**
 * Tests for OAuth redirect parsing. The redirects use custom schemes, which
 * `new URL()` handles inconsistently, so the assertions pin down the shapes
 * the app actually receives — and that a malformed one never throws on the
 * login path.
 */
import { parametriRedirect } from "../oauthRedirect";

describe("parametriRedirect", () => {
  it("reads the code from the query string of a custom scheme", () => {
    expect(parametriRedirect("ripassa://?code=abc123")).toEqual({ code: "abc123" });
  });

  it("reads parameters from a single-slash native redirect", () => {
    const p = parametriRedirect(
      "com.turboLumaca.turboRipassi:/oauthredirect?code=abc&state=xyz"
    );
    expect(p).toEqual({ code: "abc", state: "xyz" });
  });

  it("reads parameters left in the fragment", () => {
    const p = parametriRedirect("ripassa://#access_token=tok&token_type=bearer");
    expect(p.access_token).toBe("tok");
    expect(p.token_type).toBe("bearer");
  });

  it("merges query string and fragment", () => {
    const p = parametriRedirect("ripassa://?code=abc#state=xyz");
    expect(p).toEqual({ code: "abc", state: "xyz" });
  });

  it("percent-decodes values, including the error description", () => {
    const p = parametriRedirect(
      "ripassa://?error=access_denied&error_description=Utente%20non%20autorizzato"
    );
    expect(p.error).toBe("access_denied");
    expect(p.error_description).toBe("Utente non autorizzato");
  });

  it("decodes '+' as a space", () => {
    expect(parametriRedirect("ripassa://?error_description=non+valido").error_description).toBe(
      "non valido"
    );
  });

  it("keeps the first occurrence of a duplicated key", () => {
    expect(parametriRedirect("ripassa://?code=primo&code=secondo").code).toBe("primo");
  });

  it("returns nothing for a redirect with no parameters", () => {
    expect(parametriRedirect("ripassa://")).toEqual({});
  });

  it("survives malformed percent-encoding instead of throwing", () => {
    expect(() => parametriRedirect("ripassa://?code=%E0%A4%A")).not.toThrow();
    expect(parametriRedirect("ripassa://?code=%E0%A4%A").code).toBe("%E0%A4%A");
  });

  it("ignores empty pairs and valueless keys", () => {
    expect(parametriRedirect("ripassa://?&=vuoto&code=abc&")).toEqual({ code: "abc" });
  });
});
