/**
 * Model layer — translates technical errors into Italian user-facing messages.
 * Raw Supabase/Postgres errors are English and often mention constraints or
 * internals ("duplicate key value violates unique constraint ..."): never show
 * them as-is. Pure logic, no I/O, so it is unit-testable.
 */

/** Categories the UI can react to differently (e.g. offline needs no retry prompt). */
export type CategoriaErrore =
  | "rete"
  | "autenticazione"
  | "permessi"
  | "duplicato"
  | "non_trovato"
  | "spazio"
  | "sconosciuto";

export interface ErroreUtente {
  categoria: CategoriaErrore;
  /** Short title for an Alert/banner. */
  titolo: string;
  /** Actionable explanation, in Italian, no technical jargon. */
  messaggio: string;
  /** Whether retrying the same action can plausibly succeed. */
  ritentabile: boolean;
}

/** Extracts a searchable lowercase string from an unknown thrown value. */
function testoErrore(e: unknown): string {
  if (e === null || e === undefined) return "";
  if (typeof e === "string") return e.toLowerCase();
  if (e instanceof Error) return `${e.message} ${e.name}`.toLowerCase();
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    // Supabase errors carry message/code/details/hint.
    return [o.message, o.code, o.details, o.hint, o.error_description, o.error]
      .filter((v) => typeof v === "string")
      .join(" ")
      .toLowerCase();
  }
  return String(e).toLowerCase();
}

/** Postgres SQLSTATE code, when the error carries one. */
function codicePostgres(e: unknown): string | null {
  if (e && typeof e === "object") {
    const code = (e as Record<string, unknown>).code;
    if (typeof code === "string") return code;
  }
  return null;
}

const OFFLINE: ErroreUtente = {
  categoria: "rete",
  titolo: "Nessuna connessione",
  messaggio:
    "Non riesco a raggiungere il server. Controlla la connessione e riprova: i ripassi già scaricati restano consultabili.",
  ritentabile: true,
};

/**
 * Maps any thrown value to a message the user can act on. Unknown errors get a
 * neutral fallback: better a vague Italian sentence than a Postgres constraint
 * name.
 */
export function traduciErrore(e: unknown): ErroreUtente {
  const testo = testoErrore(e);
  const code = codicePostgres(e);

  // --- Network / reachability -------------------------------------------
  if (
    testo.includes("network request failed") ||
    testo.includes("failed to fetch") ||
    testo.includes("networkerror") ||
    testo.includes("timeout") ||
    testo.includes("timed out") ||
    testo.includes("econnrefused") ||
    testo.includes("enotfound") ||
    testo.includes("unable to resolve host")
  ) {
    return OFFLINE;
  }

  // --- Google Drive authorization ----------------------------------------
  // Raised when the stored tokens yield no usable access token: the refresh
  // token was revoked, or consent was never completed. Matched before the
  // generic branches, which would otherwise send it to the "unknown" fallback
  // and tell the user to restart the app — which cannot possibly help.
  if (testo.includes("drivenotauthorized") || testo.includes("google drive non autorizzato")) {
    return {
      categoria: "autenticazione",
      titolo: "Google Drive non collegato",
      messaggio:
        "L'accesso al tuo Google Drive è scaduto o è stato revocato. Riprova: ti verrà chiesto di ricollegarlo.",
      ritentabile: true,
    };
  }

  // --- OAuth authorization code no longer usable -------------------------
  // GoTrue's answer when the code carries no matching PKCE flow state: the
  // code was already spent, or the flow expired while the consent page was
  // open. Matched before the generic auth branches, which would send it to
  // the "unknown" fallback and suggest restarting the app — the one thing
  // that cannot help, since a fresh login is what's needed.
  if (testo.includes("flow state") || testo.includes("flow_state")) {
    return {
      categoria: "autenticazione",
      titolo: "Accesso da rifare",
      messaggio:
        "La richiesta di accesso è scaduta o era già stata completata. Tocca di nuovo «Continua con Google».",
      ritentabile: true,
    };
  }

  // --- Authentication ----------------------------------------------------
  if (
    testo.includes("invalid login credentials") ||
    testo.includes("invalid_grant") ||
    testo.includes("email not confirmed")
  ) {
    return {
      categoria: "autenticazione",
      titolo: "Accesso non riuscito",
      messaggio: testo.includes("email not confirmed")
        ? "Devi prima confermare l'indirizzo email: controlla la casella di posta."
        : "Email o password non corretti. Controlla i dati e riprova.",
      ritentabile: false,
    };
  }
  if (
    testo.includes("utente non autenticato") ||
    testo.includes("jwt expired") ||
    testo.includes("invalid jwt") ||
    testo.includes("not authenticated") ||
    testo.includes("session")
  ) {
    return {
      categoria: "autenticazione",
      titolo: "Sessione scaduta",
      messaggio: "La sessione è scaduta. Esci e accedi di nuovo per continuare.",
      ritentabile: false,
    };
  }

  // --- Permissions (RLS) -------------------------------------------------
  if (
    code === "42501" ||
    testo.includes("row-level security") ||
    testo.includes("permission denied") ||
    testo.includes("insufficient")
  ) {
    return {
      categoria: "permessi",
      titolo: "Operazione non consentita",
      messaggio: "Non hai i permessi per questa operazione su questo elemento.",
      ritentabile: false,
    };
  }

  // --- Data integrity ----------------------------------------------------
  if (code === "23505" || testo.includes("duplicate key")) {
    return {
      categoria: "duplicato",
      titolo: "Elemento già presente",
      messaggio: "Esiste già un elemento con questi dati.",
      ritentabile: false,
    };
  }
  if (code === "23503" || testo.includes("foreign key")) {
    return {
      categoria: "non_trovato",
      titolo: "Elemento non disponibile",
      messaggio:
        "L'elemento collegato non esiste più: potrebbe essere stato eliminato da un altro dispositivo. Aggiorna la lista.",
      ritentabile: false,
    };
  }
  if (testo.includes("not found") || testo.includes("404")) {
    return {
      categoria: "non_trovato",
      titolo: "Elemento non trovato",
      messaggio:
        "Non trovo più questo elemento: potrebbe essere stato eliminato da un altro dispositivo.",
      ritentabile: false,
    };
  }

  // --- Storage / quota ---------------------------------------------------
  if (
    testo.includes("quota") ||
    testo.includes("storage full") ||
    testo.includes("no space") ||
    testo.includes("enospc") ||
    testo.includes("payload too large") ||
    testo.includes("413")
  ) {
    return {
      categoria: "spazio",
      titolo: "Spazio esaurito",
      messaggio:
        "Non c'è spazio sufficiente per completare l'operazione. Libera spazio su Google Drive o sul dispositivo e riprova.",
      ritentabile: false,
    };
  }

  // --- Server-side transient --------------------------------------------
  if (
    testo.includes("500") ||
    testo.includes("502") ||
    testo.includes("503") ||
    testo.includes("504") ||
    testo.includes("internal server error") ||
    testo.includes("service unavailable")
  ) {
    return {
      categoria: "rete",
      titolo: "Servizio non disponibile",
      messaggio: "Il servizio non risponde in questo momento. Riprova tra qualche istante.",
      ritentabile: true,
    };
  }

  return {
    categoria: "sconosciuto",
    titolo: "Qualcosa è andato storto",
    messaggio: "Operazione non riuscita. Riprova; se il problema persiste, riavvia l'app.",
    ritentabile: true,
  };
}

/** Convenience: just the sentence, for inline error text. */
export function messaggioErrore(e: unknown): string {
  return traduciErrore(e).messaggio;
}

/**
 * Raw error text, truncated, for the few places where the translated message
 * alone leaves nobody able to act. Deliberately NOT folded into
 * traduciErrore: the contract of this module is that internals never reach
 * the normal UI. Callers should use it only for the "sconosciuto" category —
 * an attachment upload, for instance, can fail in Drive, in Postgres or on
 * the filesystem, and without the original text those are indistinguishable.
 */
export function dettaglioTecnico(e: unknown, limite = 300): string | null {
  const grezzo = testoGrezzo(e).replace(/\s+/g, " ").trim();
  if (grezzo === "") return null;
  return grezzo.length > limite ? `${grezzo.slice(0, limite)}…` : grezzo;
}

/** Like testoErrore but preserving case: this one is shown, not matched. */
function testoGrezzo(e: unknown): string {
  if (e === null || e === undefined) return "";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    return [o.message, o.code, o.details, o.hint, o.error_description, o.error]
      .filter((v) => typeof v === "string" && v !== "")
      .join(" · ");
  }
  return String(e);
}

/** True when the error looks like a connectivity problem worth retrying. */
export function isErroreDiRete(e: unknown): boolean {
  return traduciErrore(e).categoria === "rete";
}
