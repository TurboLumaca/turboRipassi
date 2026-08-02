/**
 * Tests for OAuth redirect parsing. The redirects use custom schemes, which
 * `new URL()` handles inconsistently, so the assertions pin down the shapes
 * the app actually receives — and that a malformed one never throws on the
 * login path.
 */
import { corrispondeRedirect, parametriRedirect } from "../oauthRedirect";

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

describe("corrispondeRedirect", () => {
  const LOGIN = "ripassa://";
  const DRIVE = "com.turboLumaca.turboRipassi:/oauthredirect";

  it("recognizes the login redirect carrying a code", () => {
    expect(corrispondeRedirect("ripassa://?code=abc", LOGIN)).toBe(true);
  });

  it("recognizes the Drive redirect carrying a code", () => {
    expect(
      corrispondeRedirect("com.turboLumaca.turboRipassi:/oauthredirect?code=abc", DRIVE)
    ).toBe(true);
  });

  // Browsers hand the url back with the scheme lowercased.
  it("ignores the case of the scheme", () => {
    expect(
      corrispondeRedirect("com.turbolumaca.turboripassi:/oauthredirect?code=abc", DRIVE)
    ).toBe(true);
  });

  it("treats two and three slashes as the same target", () => {
    expect(corrispondeRedirect("ripassa:///?code=abc", LOGIN)).toBe(true);
  });

  // The whole point: both flows come back with a code, and spending one
  // flow's code on the other loses the authorization.
  it("keeps the two flows apart", () => {
    expect(corrispondeRedirect("ripassa://?code=abc", DRIVE)).toBe(false);
    expect(corrispondeRedirect(`${DRIVE}?code=abc`, LOGIN)).toBe(false);
  });

  it("does not match an unrelated deep link on the same scheme", () => {
    expect(corrispondeRedirect("ripassa://ripasso/42", LOGIN)).toBe(false);
  });

  it("matches the bare redirect with no parameters at all", () => {
    expect(corrispondeRedirect("ripassa://", LOGIN)).toBe(true);
  });

  it("ignores a fragment as well as a query", () => {
    expect(corrispondeRedirect("ripassa://#access_token=x", LOGIN)).toBe(true);
  });
});
