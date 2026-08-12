/**
 * Model layer — the catalogue of trainings, and how they group by phase.
 *
 * The old app grouped these by kind ("Le basi", "Lettura veloce", "PAV e
 * memoria"), which answers "what sort of exercise is this" — a question nobody
 * opens the app to ask. The redesign groups by *when it is needed* and keeps
 * the historical families as a label on each row. Both live here: the grouping
 * is computed, the family is data.
 */
import { DURATA_CORSO, type Fase } from "./fasi";

/** The three historical families, kept as the secondary label on every row. */
export type Famiglia = "Le basi" | "Lettura veloce" | "PAV e memoria";

/** Which phase a training belongs to. */
export type FaseAllenamento = "pre" | "corso";

export interface Allenamento {
  id: string;
  nome: string;
  famiglia: Famiglia;
  fase: FaseAllenamento;
  /** Day of course that unlocks it. Only meaningful when `fase` is "corso". */
  giornoSblocco?: number;
  descrizione: string;
}

/**
 * Ticks of mastery a training needs to count as mastered. Five, uniformly:
 * the design spec leaves the per-training threshold open ("da confermare"),
 * and one number is the assumption that costs least to revise.
 */
export const SOGLIA_PADRONANZA = 5;

/**
 * The two trainings that have to reach the threshold before day 1. They are
 * the ones that charge the battery, and the only ones the pre-course phase
 * asks for.
 */
export const RICHIESTI_PRIMA_DEL_CORSO = ["fonetica", "schedario"] as const;

/**
 * Sessions a week the maintenance plan asks for. From the mockup; the design
 * spec lists the real cadence among the things to confirm.
 */
export const SESSIONI_MANTENIMENTO = 3;

export const CATALOGO: readonly Allenamento[] = [
  {
    id: "fonetica",
    nome: "Conversione fonetica",
    famiglia: "Le basi",
    fase: "pre",
    descrizione:
      "Trasforma numeri in suoni e i suoni in immagini. È la base di tutte le tecniche di memoria del metodo.",
  },
  {
    id: "schedario",
    nome: "Schedario mentale",
    famiglia: "Le basi",
    fase: "pre",
    descrizione:
      "Costruisci e consolida i tuoi cento schedari: i luoghi mentali dove archivierai le informazioni.",
  },
  {
    id: "puntini",
    nome: "Puntini",
    famiglia: "Lettura veloce",
    fase: "corso",
    giornoSblocco: 2,
    descrizione:
      "Allarga il campo visivo: fissi il centro e riconosci quello che sta ai lati senza muovere gli occhi.",
  },
  {
    id: "rombo",
    nome: "Rombo",
    famiglia: "Lettura veloce",
    fase: "corso",
    giornoSblocco: 3,
    descrizione:
      "Allena il movimento verticale dello sguardo su righe di lunghezza crescente e poi decrescente.",
  },
  {
    id: "copri",
    nome: "Copri e scopri",
    famiglia: "Lettura veloce",
    fase: "corso",
    giornoSblocco: 5,
    descrizione:
      "Riduci il tempo di esposizione: leggi gruppi di cifre e parole in una frazione di secondo.",
  },
  {
    id: "parole",
    nome: "Parole e numeri",
    famiglia: "PAV e memoria",
    fase: "corso",
    giornoSblocco: 8,
    descrizione:
      "Associa parole astratte e numeri usando la conversione fonetica e lo schedario.",
  },
  {
    id: "date",
    nome: "Date e personaggi",
    famiglia: "PAV e memoria",
    fase: "corso",
    giornoSblocco: 10,
    descrizione:
      "Memorizza date storiche e nomi collegandoli a immagini già archiviate.",
  },
  {
    id: "griglia",
    nome: "Griglia numerica",
    famiglia: "PAV e memoria",
    fase: "corso",
    giornoSblocco: 12,
    descrizione:
      "Ricostruisci griglie di numeri a memoria: la prova finale sullo schedario.",
  },
];

export function allenamentoPerId(id: string): Allenamento | undefined {
  return CATALOGO.find((a) => a.id === id);
}

/** Ticks reached, per training id. Missing means zero. */
export type Padronanze = Readonly<Record<string, number>>;

export function padronanzaDi(padronanze: Padronanze, id: string): number {
  const v = padronanze[id];
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(SOGLIA_PADRONANZA, Math.round(v)));
}

/**
 * The condition of one training, as one word.
 *
 * WCAG 1.4.1 is the reason this is a value and not a colour: the View turns it
 * into a colour *and* a chip *and* a position, and all three have to come from
 * the same source or they drift apart.
 */
export type StatoAllenamento = "bloccato" | "da-fare" | "in-corso" | "raggiunto";

/** True when the lessons have already introduced this training. */
export function isSbloccato(a: Allenamento, giorno: number): boolean {
  if (a.fase === "pre") return true;
  return giorno >= (a.giornoSblocco ?? Number.POSITIVE_INFINITY);
}

export function statoAllenamento(
  a: Allenamento,
  giorno: number,
  padronanze: Padronanze
): StatoAllenamento {
  if (!isSbloccato(a, giorno)) return "bloccato";
  const p = padronanzaDi(padronanze, a.id);
  if (p >= SOGLIA_PADRONANZA) return "raggiunto";
  return p === 0 ? "da-fare" : "in-corso";
}

/** One row of the Allenati list, with everything the View needs to draw it. */
export interface VoceAllenamento {
  allenamento: Allenamento;
  stato: StatoAllenamento;
  padronanza: number;
  /** The chip: "Prima del corso", "Giorno 4", "Mantenimento". */
  chip: string;
  /** The line to the right of the pips: "3/5 tacche", "Bloccato", "2× a settimana". */
  nota: string;
}

/** A phase group: its heading, and the rows under it. */
export interface GruppoAllenamenti {
  id: string;
  /** Small caps line above the title. */
  kicker: string;
  titolo: string;
  /** Which phase colours this group. */
  fase: Fase;
  /** True only on the pre-course group, and only while the battery exists. */
  batteria: boolean;
  descrizione: string;
  voci: VoceAllenamento[];
}

function chipDi(a: Allenamento, fase: Fase): string {
  if (fase === "post") return "Mantenimento";
  if (a.fase === "pre") return "Prima del corso";
  return `Giorno ${a.giornoSblocco}`;
}

function voce(
  a: Allenamento,
  fase: Fase,
  giorno: number,
  padronanze: Padronanze,
  nota?: string
): VoceAllenamento {
  const stato = statoAllenamento(a, giorno, padronanze);
  const padronanza = stato === "bloccato" ? 0 : padronanzaDi(padronanze, a.id);
  return {
    allenamento: a,
    stato,
    padronanza,
    chip: chipDi(a, fase),
    nota:
      nota ??
      (stato === "bloccato"
        ? `Si sblocca al Giorno ${a.giornoSblocco}`
        : `${padronanza}/${SOGLIA_PADRONANZA} tacche`),
  };
}

const DEL_CORSO = CATALOGO.filter((a) => a.fase === "corso");
const DELLE_BASI = CATALOGO.filter((a) => a.fase === "pre");

/**
 * The Allenati screen, as data.
 *
 * The current phase is always the first group and the only one carrying the
 * battery; the others stay below, visible and compact. Nothing is ever removed
 * from the list — a training the student cannot open yet still says when it
 * opens, which is both the honest answer and, for a guest, the one that shows
 * how wide the method is.
 */
export function gruppiAllenamenti(
  fase: Fase,
  giorno: number,
  padronanze: Padronanze
): GruppoAllenamenti[] {
  if (fase === "durante") {
    return [
      {
        id: "corso",
        kicker: "Fase 2 · adesso",
        titolo: "Con le lezioni",
        fase: "durante",
        batteria: false,
        descrizione: `Giorno ${giorno} di ${DURATA_CORSO}. Gli allenamenti si aprono quando la lezione li introduce.`,
        voci: DEL_CORSO.map((a) => voce(a, fase, giorno, padronanze)),
      },
      {
        id: "basi",
        kicker: "Le basi",
        titolo: "Continua ad allenarle",
        fase: "pre",
        batteria: false,
        descrizione:
          "Conversione fonetica e schedario restano il motore di tutto il resto.",
        voci: DELLE_BASI.map((a) => voce(a, fase, giorno, padronanze, "Sempre disponibile")),
      },
      {
        id: "mantenimento",
        kicker: "Fase 3",
        titolo: "Dopo il corso",
        fase: "post",
        batteria: false,
        descrizione: `Il piano di mantenimento si attiva alla fine dei ${DURATA_CORSO} giorni.`,
        voci: [],
      },
    ];
  }

  if (fase === "post") {
    const settimanale = DEL_CORSO.slice(0, SESSIONI_MANTENIMENTO);
    return [
      {
        id: "settimana",
        kicker: "Fase 3 · adesso",
        titolo: "Il piano della settimana",
        fase: "post",
        batteria: false,
        descrizione: `${SESSIONI_MANTENIMENTO} sessioni per tenere il metodo allenato.`,
        voci: settimanale.map((a) =>
          voce(a, fase, giorno, padronanze, `${SESSIONI_MANTENIMENTO}× a settimana`)
        ),
      },
      {
        id: "archivio",
        kicker: "Archivio",
        titolo: "Tutti gli allenamenti",
        fase: "durante",
        batteria: false,
        descrizione: "Restano tutti disponibili, senza vincoli di giorno.",
        voci: CATALOGO.map((a) => voce(a, fase, giorno, padronanze, "Senza vincoli")),
      },
    ];
  }

  // "pre" and "ospite" draw the same three groups: the guest sees the shape of
  // the whole method, which is the point of leaving it visible.
  return [
    {
      id: "pre",
      kicker: "Fase 1 · adesso",
      titolo: "Prima del corso",
      fase: "pre",
      batteria: true,
      descrizione:
        "Due allenamenti da portare a 5 tacche: è la padronanza che carica la batteria, non le ore di allenamento.",
      voci: DELLE_BASI.map((a) => voce(a, fase, giorno, padronanze)),
    },
    {
      id: "corso",
      kicker: "Fase 2",
      titolo: "Con le lezioni",
      fase: "durante",
      batteria: false,
      descrizione: `Si sbloccano giorno per giorno durante i ${DURATA_CORSO} giorni, insieme alle lezioni in aula.`,
      voci: DEL_CORSO.map((a) => voce(a, fase, 0, padronanze)),
    },
    {
      id: "mantenimento",
      kicker: "Fase 3",
      titolo: "Dopo il corso",
      fase: "post",
      batteria: false,
      descrizione: `Alla fine del corso qui compare il piano di mantenimento: ${SESSIONI_MANTENIMENTO} sessioni a settimana, dieci minuti.`,
      voci: [],
    },
  ];
}
