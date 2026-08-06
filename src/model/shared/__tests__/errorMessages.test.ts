/**
 * Tests for the technical-error to Italian-message mapping. The point of this
 * module is that raw Postgres/Supabase strings never reach the user, so the
 * assertions check both the category and that internals don't leak.
 */
import {
  dettaglioTecnico,
  isErroreDiRete,
  messaggioErrore,
  REGOLE,
  traduciErrore,
} from "../errorMessages";
import { DriveHttpError } from "@/model/drive/driveTypes";

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

describe("traduciErrore — linking Google to an existing account", () => {
  // Must not fall through to the generic auth rules, which would tell the
  // user their session expired and to sign in again — for a state that is not
  // an error at all and that signing out cannot change.
  it("recognizes an identity already attached elsewhere", () => {
    const r = traduciErrore({ message: "Identity is already linked to another user" });
    expect(r.categoria).toBe("duplicato");
    expect(r.titolo).toBe("Google già collegato");
    expect(r.ritentabile).toBe(false);
  });

  it("recognizes the error code form", () => {
    expect(traduciErrore({ error: "identity_already_exists" }).titolo).toBe("Google già collegato");
  });

  // The claim is conditional on purpose: a *different* address is a different
  // account, and the message must not promise otherwise.
  it("does not promise the ripassi are shared regardless of address", () => {
    const m = messaggioErrore({ message: "Identity is already linked to another user" });
    expect(m).toContain("Se è lo stesso indirizzo email");
  });
});

describe("traduciErrore — Google Drive authorization", () => {
  // This one used to reach the generic fallback, which told the user to
  // restart the app for a problem only re-authorization can fix.
  it("recognizes DriveNotAuthorizedError by name", () => {
    const e = new Error("Accesso a Google Drive non autorizzato.");
    e.name = "DriveNotAuthorizedError";
    const r = traduciErrore(e);
    expect(r.categoria).toBe("autenticazione");
    expect(r.titolo).toBe("Google Drive non collegato");
    expect(r.ritentabile).toBe(true);
  });

  it("recognizes the message alone, without the error name", () => {
    expect(traduciErrore({ message: "Accesso a Google Drive non autorizzato." }).titolo).toBe(
      "Google Drive non collegato"
    );
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

  // GoTrue's reply when the authorization code has no PKCE flow state left.
  // It used to reach the generic fallback, whose advice — restart the app —
  // is the one action that cannot recover a spent code.
  it("tells the user to log in again when the PKCE flow state is gone", () => {
    const r = traduciErrore({ message: "invalid flow state, no valid flow state found" });
    expect(r.categoria).toBe("autenticazione");
    expect(r.ritentabile).toBe(true);
    expect(r.messaggio).toMatch(/google/i);
    expect(r.messaggio).not.toMatch(/riavvia/i);
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

/**
 * The rules are matched top to bottom, so the property that actually keeps
 * this module correct is not "the right rule exists" but "no broader rule gets
 * there first". These are the negative tests for that: each one pins a border
 * that a previous version of the table crossed.
 */
describe("traduciErrore — confini fra le regole", () => {
  it("un errore HTTP non è classificato dai numeri che compaiono nel corpo", () => {
    // Il corpo di Google contiene "500" (una quota), ma lo stato è 403: non è
    // un guasto transitorio del server e ritentarlo non può funzionare.
    const e = new DriveHttpError(
      403,
      'Drive API 403: {"error":{"code":403,"message":"userRateLimitExceeded, quotaLimit 500 requests"}}'
    );
    const r = traduciErrore(e);
    expect(r.categoria).not.toBe("rete");
    expect(r.ritentabile).toBe(false);
  });

  it("classifica per stato HTTP quando c'è, non per testo", () => {
    expect(traduciErrore(new DriveHttpError(503, "Drive API 503: {}")).categoria).toBe("rete");
    expect(traduciErrore(new DriveHttpError(404, "Drive API 404: {}")).categoria).toBe(
      "non_trovato"
    );
    expect(traduciErrore(new DriveHttpError(413, "Drive API 413: {}")).categoria).toBe("spazio");
  });

  it("un errore di expo-auth-session non diventa «sessione scaduta»", () => {
    // "session" da solo era un frammento della regola di autenticazione: uno
    // scheme di redirect non registrato diceva all'utente di rifare il login,
    // cioè l'unica azione che non poteva servire a nulla.
    const r = traduciErrore(new Error("openAuthSessionAsync failed: no matching activity found"));
    expect(r.categoria).toBe("sconosciuto");
    expect(r.messaggio).not.toMatch(/sessione/i);
  });

  it("il codice RLS vince sul testo «not found» presente nello stesso errore", () => {
    const r = traduciErrore({
      code: "42501",
      message: "permission denied: relation not found in policy",
    });
    expect(r.categoria).toBe("permessi");
  });

  it("l'errore di autorizzazione Drive precede le regole generiche di autenticazione", () => {
    // Contiene sia il nome dell'errore Drive sia "not authenticated": deve
    // vincere il primo, perché la sola azione utile è ricollegare Drive.
    const e = new Error("Drive not authenticated");
    e.name = "DriveNotAuthorizedError";
    expect(traduciErrore(e).titolo).toBe("Google Drive non collegato");
  });
});

/**
 * La tabella percorsa una regola alla volta.
 *
 * I test qui sopra fissano i casi che qualcuno ha gia' sbagliato una volta:
 * sono scritti a mano, e nessuno di essi si accorge di una regola aggiunta in
 * mezzo alla lista senza un caso che la raggiunga. Questo blocco parte
 * dall'altra estremita' — dalla tabella — e chiede a ciascuna delle sue voci di
 * essere raggiungibile: una regola nuova senza campione fa fallire la suite,
 * invece di passare inosservata.
 *
 * Il confronto e' per identita' dell'oggetto `esito`, non per categoria o
 * titolo: due regole possono produrre lo stesso titolo (le due di
 * autenticazione lo fanno), e confrontare i testi direbbe "coperta" per una
 * regola che in realta' non e' mai stata raggiunta perche' un'altra la precede.
 */
const CAMPIONI: unknown[] = [
  // rete / raggiungibilita'
  new TypeError("Network request failed"),
  new Error("Request timed out"),
  { message: "ECONNREFUSED 127.0.0.1:443" },
  // autorizzazione Drive
  (() => {
    const e = new Error("Accesso a Google Drive non autorizzato.");
    e.name = "DriveNotAuthorizedError";
    return e;
  })(),
  // codice OAuth gia' speso
  { message: "invalid flow state, no valid flow state found" },
  // identita' Google gia' collegata altrove
  { message: "Identity is already linked to another user" },
  // email non confermata
  { message: "Email not confirmed" },
  // credenziali sbagliate
  { message: "Invalid login credentials" },
  // sessione scaduta
  { message: "JWT expired" },
  // permessi (RLS)
  { code: "42501", message: "new row violates row-level security policy" },
  // duplicato
  { code: "23505", message: 'duplicate key value violates unique constraint "ripassi_pkey"' },
  // riferimento a una riga che non c'e' piu'
  { code: "23503", message: "foreign key violation" },
  // elemento non trovato
  new DriveHttpError(404, "Drive API 404: {}"),
  // spazio esaurito
  { message: "Quota exceeded" },
  // guasto transitorio del server
  new DriveHttpError(503, "Drive API 503: {}"),
];

describe("copertura della tabella delle regole", () => {
  it.each(REGOLE.map((regola, i) => [i, regola.esito.titolo, regola] as const))(
    "la regola %i (%s) ha almeno un caso che la fa scattare",
    (_i, _titolo, regola) => {
      const raggiunta = CAMPIONI.some((campione) => traduciErrore(campione) === regola.esito);
      expect(raggiunta).toBe(true);
    }
  );

  // L'altra meta' della stessa proprieta': un campione che smette di
  // corrispondere non deve restare nella lista a fingere di coprire qualcosa.
  it("nessun campione e' diventato inerte", () => {
    for (const campione of CAMPIONI) {
      expect(REGOLE.some((regola) => regola.esito === traduciErrore(campione))).toBe(true);
    }
  });
});

describe("dettaglioTecnico", () => {
  // Serve solo per la categoria "sconosciuto": senza il testo originale, un
  // allegato fallito su Drive, su Postgres o sul filesystem e' la stessa cosa.
  it("riporta il testo grezzo di un Error", () => {
    expect(dettaglioTecnico(new Error("PGRST301: JWSError"))).toBe("PGRST301: JWSError");
  });

  it("riporta i campi di un errore Supabase, uno di seguito all'altro", () => {
    expect(dettaglioTecnico({ message: "boom", hint: "riprova" })).toBe("boom · riprova");
  });

  it("normalizza gli a capo, che in un Alert diventerebbero righe vuote", () => {
    expect(dettaglioTecnico("prima\n\n  seconda ")).toBe("prima seconda");
  });

  it("tronca invece di riversare in un Alert un corpo di risposta intero", () => {
    const lungo = dettaglioTecnico("x".repeat(500));
    expect(lungo).toHaveLength(301);
    expect(lungo?.endsWith("…")).toBe(true);
  });

  it("non produce niente quando non c'e' niente da dire", () => {
    expect(dettaglioTecnico(null)).toBeNull();
    expect(dettaglioTecnico(new Error(""))).toBeNull();
    expect(dettaglioTecnico({})).toBeNull();
  });

  it("gestisce un valore lanciato che non e' ne' stringa ne' oggetto", () => {
    expect(dettaglioTecnico(42)).toBe("42");
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
