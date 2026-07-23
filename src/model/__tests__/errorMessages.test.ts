/**
 * Tests for the technical-error to Italian-message mapping. The point of this
 * module is that raw Postgres/Supabase strings never reach the user, so the
 * assertions check both the category and that internals don't leak.
 */
import { isErroreDiRete, messaggioErrore, traduciErrore } from "../errorMessages";

describe("traduciErrore — network", () => {
  it("recognizes the React Native fetch failure", () => {
    const r = traduciErrore(new TypeError("Network request failed"));
    expect(r.categoria).toBe("rete");
    expect(r.ritentabile).toBe(true);
  });

  it("recognizes timeouts", () => {
    expect(traduciErrore(new Error("Request timed out")).categoria).toBe("rete");
  });

  it("recognizes DNS failures", () => {
    expect(traduciErrore(new Error("Unable to resolve host")).categoria).toBe("rete");
  });

  it("treats 5xx as retryable server trouble", () => {
    const r = traduciErrore({ message: "503 Service Unavailable" });
    expect(r.categoria).toBe("rete");
    expect(r.ritentabile).toBe(true);
  });
});

describe("traduciErrore — authentication", () => {
  it("maps wrong credentials without echoing the English text", () => {
    const r = traduciErrore({ message: "Invalid login credentials" });
    expect(r.categoria).toBe("autenticazione");
    expect(r.ritentabile).toBe(false);
    expect(r.messaggio.toLowerCase()).not.toContain("invalid");
  });

  it("maps unconfirmed email to its own instruction", () => {
    const r = traduciErrore({ message: "Email not confirmed" });
    expect(r.messaggio).toMatch(/conferma/i);
  });

  it("maps an expired session", () => {
    const r = traduciErrore({ message: "JWT expired" });
    expect(r.categoria).toBe("autenticazione");
    expect(r.messaggio).toMatch(/sessione/i);
  });

  it("maps the repo's own Italian auth error", () => {
    expect(traduciErrore(new Error("Utente non autenticato.")).categoria).toBe(
      "autenticazione"
    );
  });
});

describe("traduciErrore — Postgres codes", () => {
  it("maps 23505 to a duplicate message without the constraint name", () => {
    const r = traduciErrore({
      code: "23505",
      message: 'duplicate key value violates unique constraint "ripassi_pkey"',
    });
    expect(r.categoria).toBe("duplicato");
    expect(r.messaggio).not.toContain("ripassi_pkey");
    expect(r.messaggio).not.toMatch(/constraint/i);
  });

  it("maps 42501 (RLS) to a permission message", () => {
    const r = traduciErrore({ code: "42501", message: "new row violates row-level security policy" });
    expect(r.categoria).toBe("permessi");
    expect(r.messaggio).not.toMatch(/row-level/i);
  });

  it("maps 23503 (foreign key) to a stale-reference message", () => {
    expect(traduciErrore({ code: "23503", message: "foreign key violation" }).categoria).toBe(
      "non_trovato"
    );
  });
});

describe("traduciErrore — storage", () => {
  it("maps quota exhaustion", () => {
    const r = traduciErrore({ message: "Quota exceeded" });
    expect(r.categoria).toBe("spazio");
    expect(r.messaggio).toMatch(/spazio/i);
  });

  it("maps an oversized payload", () => {
    expect(traduciErrore({ message: "413 Payload Too Large" }).categoria).toBe("spazio");
  });
});

describe("traduciErrore — fallback", () => {
  it("never leaks an unrecognized technical message", () => {
    const raw = "PGRST301: JWSError JWSInvalidSignature at column 42";
    const r = traduciErrore(new Error(raw));
    expect(r.categoria).toBe("sconosciuto");
    expect(r.messaggio).not.toContain("PGRST301");
    expect(r.messaggio).not.toContain("JWSError");
  });

  it("handles null and undefined without throwing", () => {
    expect(traduciErrore(null).categoria).toBe("sconosciuto");
    expect(traduciErrore(undefined).categoria).toBe("sconosciuto");
  });

  it("handles a plain string", () => {
    expect(traduciErrore("Network request failed").categoria).toBe("rete");
  });

  it("always produces a non-empty Italian message", () => {
    for (const e of [null, undefined, {}, new Error(""), "", 42]) {
      const r = traduciErrore(e);
      expect(r.messaggio.length).toBeGreaterThan(0);
      expect(r.titolo.length).toBeGreaterThan(0);
    }
  });
});

describe("helpers", () => {
  it("messaggioErrore returns just the sentence", () => {
    expect(messaggioErrore(new Error("Network request failed"))).toBe(
      traduciErrore(new Error("Network request failed")).messaggio
    );
  });

  it("isErroreDiRete distinguishes connectivity from other failures", () => {
    expect(isErroreDiRete(new Error("Network request failed"))).toBe(true);
    expect(isErroreDiRete({ code: "23505", message: "duplicate key" })).toBe(false);
  });
});
