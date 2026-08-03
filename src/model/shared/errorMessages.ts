/**
 * Model layer — translates technical errors into Italian user-facing messages.
 * Raw Supabase/Postgres errors are English and often mention constraints or
 * internals ("duplicate key value violates unique constraint ..."): never show
 * them as-is. Pure logic, no I/O, so it is unit-testable.
 *
 * The mapping is a table rather than a chain of ifs: the rules are data, the
 * matching is one loop, and adding a case means adding an entry instead of
 * finding the right place in a 150-line function.
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

/** Fields Supabase/Postgres errors carry their text in. */
const CAMPI_TESTO = ["message", "code", "details", "hint", "error_description", "error"] as const;

/** The non-empty string fields of an error-shaped object, in a fixed order. */
function campiOggetto(o: Record<string, unknown>): string[] {
  return CAMPI_TESTO.map((campo) => o[campo]).filter(
    (v): v is string => typeof v === "string" && v !== ""
  );
}

/** Searchable lowercase string from an unknown thrown value. */
function testoErrore(e: unknown): string {
  if (e === null || e === undefined) return "";
  if (typeof e === "string") return e.toLowerCase();
  // The name matters here: DriveNotAuthorizedError is recognized by it.
  if (e instanceof Error) return `${e.message} ${e.name}`.toLowerCase();
  if (typeof e === "object") {
    return campiOggetto(e as Record<string, unknown>)
      .join(" ")
      .toLowerCase();
  }
  return String(e).toLowerCase();
}

/** Like testoErrore but preserving case: this one is shown, not matched. */
function testoGrezzo(e: unknown): string {
  if (e === null || e === undefined) return "";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") return campiOggetto(e as Record<string, unknown>).join(" · ");
  return String(e);
}

/** Postgres SQLSTATE code, when the error carries one. */
function codicePostgres(e: unknown): string | null {
  if (e && typeof e === "object") {
    const code = (e as Record<string, unknown>).code;
    if (typeof code === "string") return code;
  }
  return null;
}

/**
 * HTTP status, when the error carries one as a field (DriveHttpError, and
 * anything else fetch-shaped).
 *
 * Read structurally on purpose. Status codes used to be matched by searching
 * the message for "500", "404", "413" and so on — but the message embeds the
 * response body verbatim, so any three digits anywhere in Google's JSON
 * decided the category. A 403 mentioning a quota of 500 requests was filed as
 * a transient server error, which also made it `ritentabile`, so the retry
 * layer hammered a request that could never succeed.
 */
function codiceHttp(e: unknown): number | null {
  if (e && typeof e === "object") {
    const status = (e as Record<string, unknown>).status;
    if (typeof status === "number") return status;
  }
  return null;
}

/**
 * One mapping rule. A rule matches when the SQLSTATE code is one of `codici`,
 * when the HTTP status is one of `statusHttp`, or when the lowercased error
 * text contains any of `frammenti`.
 *
 * Fragments must stay unambiguous: they are searched inside text that can
 * include a whole server response, so anything short or numeric belongs in
 * `statusHttp` / `codici` instead.
 */
interface RegolaErrore {
  codici?: string[];
  statusHttp?: number[];
  frammenti?: string[];
  esito: ErroreUtente;
}

const OFFLINE: ErroreUtente = {
  categoria: "rete",
  titolo: "Nessuna connessione",
  messaggio:
    "Non riesco a raggiungere il server. Controlla la connessione e riprova: i ripassi già scaricati restano consultabili.",
  ritentabile: true,
};

const SCONOSCIUTO: ErroreUtente = {
  categoria: "sconosciuto",
  titolo: "Qualcosa è andato storto",
  messaggio: "Operazione non riuscita. Riprova; se il problema persiste, riavvia l'app.",
  ritentabile: true,
};

/**
 * Matched top to bottom: specific cases come before the generic ones they
 * would otherwise fall into. The two Google branches in particular have to
 * precede the generic auth rules, which would send them to the "sconosciuto"
 * fallback and advise restarting the app — the one action that cannot help
 * with a revoked token or a spent authorization code.
 */
const REGOLE: RegolaErrore[] = [
  // --- Network / reachability ---------------------------------------------
  {
    frammenti: [
      "network request failed",
      "failed to fetch",
      "networkerror",
      "timeout",
      "timed out",
      "econnrefused",
      "enotfound",
      "unable to resolve host",
    ],
    esito: OFFLINE,
  },

  // --- Google Drive authorization -----------------------------------------
  // The stored tokens yield no usable access token: the refresh token was
  // revoked, or consent was never completed.
  {
    frammenti: ["drivenotauthorized", "google drive non autorizzato"],
    esito: {
      categoria: "autenticazione",
      titolo: "Google Drive non collegato",
      messaggio:
        "L'accesso al tuo Google Drive è scaduto o è stato revocato. Riprova: ti verrà chiesto di ricollegarlo.",
      ritentabile: true,
    },
  },

  // --- OAuth authorization code no longer usable ---------------------------
  // GoTrue's answer when the code carries no matching PKCE flow state: the
  // code was already spent, or the flow expired while consent was open.
  {
    frammenti: ["flow state", "flow_state"],
    esito: {
      categoria: "autenticazione",
      titolo: "Accesso da rifare",
      messaggio:
        "La richiesta di accesso è scaduta o era già stata completata. Tocca di nuovo «Continua con Google».",
      ritentabile: true,
    },
  },

  // --- Authentication ------------------------------------------------------
  // Before the credentials rule: an unconfirmed email needs its own action.
  {
    frammenti: ["email not confirmed"],
    esito: {
      categoria: "autenticazione",
      titolo: "Accesso non riuscito",
      messaggio: "Devi prima confermare l'indirizzo email: controlla la casella di posta.",
      ritentabile: false,
    },
  },
  {
    frammenti: ["invalid login credentials", "invalid_grant"],
    esito: {
      categoria: "autenticazione",
      titolo: "Accesso non riuscito",
      messaggio: "Email o password non corretti. Controlla i dati e riprova.",
      ritentabile: false,
    },
  },
  {
    // Spelled out one by one. A bare "session" fragment used to live here and
    // swallowed everything expo-auth-session says: a redirect scheme that was
    // never registered came out as "la sessione è scaduta, esci e riaccedi",
    // sending the user to do the one thing that cannot help.
    frammenti: [
      "utente non autenticato",
      "jwt expired",
      "invalid jwt",
      "not authenticated",
      "auth session missing",
      "session expired",
      "session not found",
      "session_not_found",
      "no session",
    ],
    esito: {
      categoria: "autenticazione",
      titolo: "Sessione scaduta",
      messaggio: "La sessione è scaduta. Esci e accedi di nuovo per continuare.",
      ritentabile: false,
    },
  },

  // --- Permissions (RLS) ---------------------------------------------------
  {
    codici: ["42501"],
    frammenti: ["row-level security", "permission denied", "insufficient"],
    esito: {
      categoria: "permessi",
      titolo: "Operazione non consentita",
      messaggio: "Non hai i permessi per questa operazione su questo elemento.",
      ritentabile: false,
    },
  },

  // --- Data integrity ------------------------------------------------------
  {
    codici: ["23505"],
    frammenti: ["duplicate key"],
    esito: {
      categoria: "duplicato",
      titolo: "Elemento già presente",
      messaggio: "Esiste già un elemento con questi dati.",
      ritentabile: false,
    },
  },
  {
    codici: ["23503"],
    frammenti: ["foreign key"],
    esito: {
      categoria: "non_trovato",
      titolo: "Elemento non disponibile",
      messaggio:
        "L'elemento collegato non esiste più: potrebbe essere stato eliminato da un altro dispositivo. Aggiorna la lista.",
      ritentabile: false,
    },
  },
  {
    statusHttp: [404],
    frammenti: ["not found"],
    esito: {
      categoria: "non_trovato",
      titolo: "Elemento non trovato",
      messaggio:
        "Non trovo più questo elemento: potrebbe essere stato eliminato da un altro dispositivo.",
      ritentabile: false,
    },
  },

  // --- Storage / quota -----------------------------------------------------
  {
    statusHttp: [413, 507],
    frammenti: ["quota", "storage full", "no space", "enospc", "payload too large"],
    esito: {
      categoria: "spazio",
      titolo: "Spazio esaurito",
      messaggio:
        "Non c'è spazio sufficiente per completare l'operazione. Libera spazio su Google Drive o sul dispositivo e riprova.",
      ritentabile: false,
    },
  },

  // --- Server-side transient -----------------------------------------------
  {
    statusHttp: [500, 502, 503, 504],
    frammenti: ["internal server error", "service unavailable", "bad gateway", "gateway timeout"],
    esito: {
      categoria: "rete",
      titolo: "Servizio non disponibile",
      messaggio: "Il servizio non risponde in questo momento. Riprova tra qualche istante.",
      ritentabile: true,
    },
  },
];

function corrisponde(
  regola: RegolaErrore,
  testo: string,
  code: string | null,
  status: number | null
): boolean {
  if (code !== null && regola.codici?.includes(code)) return true;
  if (status !== null && regola.statusHttp?.includes(status)) return true;
  return regola.frammenti?.some((frammento) => testo.includes(frammento)) ?? false;
}

/**
 * Maps any thrown value to a message the user can act on. Unknown errors get a
 * neutral fallback: better a vague Italian sentence than a Postgres constraint
 * name.
 */
export function traduciErrore(e: unknown): ErroreUtente {
  const testo = testoErrore(e);
  const code = codicePostgres(e);
  const status = codiceHttp(e);
  return REGOLE.find((regola) => corrisponde(regola, testo, code, status))?.esito ?? SCONOSCIUTO;
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

/** True when the error looks like a connectivity problem worth retrying. */
export function isErroreDiRete(e: unknown): boolean {
  return traduciErrore(e).categoria === "rete";
}
