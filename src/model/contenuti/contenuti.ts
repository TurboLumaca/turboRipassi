/**
 * Model layer — the course material: recorded lessons and readings.
 *
 * They used to be two separate destinations. They have the same frequency of
 * use and the same nature — material of the course, to be consumed once — so
 * they share one navigation slot and differ only by a segmented control. What
 * makes that work is that both are the same shape here.
 */

export type TipoContenuto = "video" | "lettura";

/** Where a piece of material stands for this student. */
export type StatoContenuto = "nuovo" | "a-meta" | "visto";

export const ETICHETTE_STATO: Record<StatoContenuto, string> = {
  nuovo: "Nuovo",
  "a-meta": "A metà",
  visto: "Visto",
};

export interface Contenuto {
  id: string;
  tipo: TipoContenuto;
  titolo: string;
  /** The module it belongs to; drives the filter chips. */
  modulo: string;
  /** "17 marzo · 48 min", "PDF · 24 pagine". */
  meta: string;
  /**
   * Two or three characters standing in for a thumbnail.
   *
   * The old app used the company logo on all six cards, so the thumbnail told
   * you nothing — its only job is letting you recognise the item in half a
   * second. Until real stills exist, the day number does that job and the logo
   * did not.
   */
  sigla: string;
  /** Overlaid on the corner of a video. Empty for readings. */
  durata?: string;
  /** How much of it has been consumed, 0–100. */
  progresso: number;
}

export const CONTENUTI: readonly Contenuto[] = [
  {
    id: "v1",
    tipo: "video",
    titolo: "Eserciziario Giorno 1",
    modulo: "Eserciziari",
    meta: "17 marzo · 48 min",
    sigla: "01",
    durata: "48:20",
    progresso: 100,
  },
  {
    id: "v2",
    tipo: "video",
    titolo: "Eserciziario Giorno 2",
    modulo: "Eserciziari",
    meta: "28 marzo · 52 min",
    sigla: "02",
    durata: "52:15",
    progresso: 45,
  },
  {
    id: "v3",
    tipo: "video",
    titolo: "Eserciziario Giorno 3",
    modulo: "Eserciziari",
    meta: "4 aprile · 44 min",
    sigla: "03",
    durata: "44:02",
    progresso: 0,
  },
  {
    id: "v4",
    tipo: "video",
    titolo: "Lettura veloce — ripasso tecnico",
    modulo: "Lettura veloce",
    meta: "12 aprile · 21 min",
    sigla: "LV",
    durata: "21:40",
    progresso: 0,
  },
  {
    id: "v5",
    tipo: "video",
    titolo: "Memoria — schedari in pratica",
    modulo: "Memoria",
    meta: "20 aprile · 33 min",
    sigla: "ME",
    durata: "33:10",
    progresso: 0,
  },
  {
    id: "l1",
    tipo: "lettura",
    titolo: "Il metodo, capitolo 1",
    modulo: "Capitoli",
    meta: "Lettura guidata · 12 min",
    sigla: "01",
    progresso: 100,
  },
  {
    id: "l2",
    tipo: "lettura",
    titolo: "Schedari: come costruirli",
    modulo: "Capitoli",
    meta: "Lettura guidata · 9 min",
    sigla: "02",
    progresso: 60,
  },
  {
    id: "l3",
    tipo: "lettura",
    titolo: "Dispensa lettura veloce",
    modulo: "Dispense",
    meta: "PDF · 24 pagine",
    sigla: "PDF",
    progresso: 25,
  },
  {
    id: "l4",
    tipo: "lettura",
    titolo: "Appunti del Giorno 3",
    modulo: "Appunti d’aula",
    meta: "Materiale d’aula · 6 pagine",
    sigla: "AP",
    progresso: 0,
  },
];

/** The chip that is always first, and always means "no filter". */
export const FILTRO_TUTTI = "Tutti";

export function statoContenuto(c: Contenuto): StatoContenuto {
  if (c.progresso >= 100) return "visto";
  return c.progresso > 0 ? "a-meta" : "nuovo";
}

/**
 * The filter chips for one tab: "Tutti" plus every module actually present,
 * in the order the material appears. Derived rather than written down twice,
 * so a new module cannot end up unfilterable.
 */
export function moduliDi(
  tipo: TipoContenuto,
  elenco: readonly Contenuto[] = CONTENUTI
): string[] {
  const moduli: string[] = [FILTRO_TUTTI];
  for (const c of elenco) {
    if (c.tipo === tipo && !moduli.includes(c.modulo)) moduli.push(c.modulo);
  }
  return moduli;
}

/**
 * The list for one tab, narrowed by module and by the search box.
 *
 * Search looks at the title and at the module: typing "giorno 3" has to find
 * both the video and the notes, and typing "dispense" has to work even when
 * the chip for it is not the one selected.
 */
export function filtraContenuti(
  tipo: TipoContenuto,
  modulo: string,
  query: string,
  elenco: readonly Contenuto[] = CONTENUTI
): Contenuto[] {
  const q = query.trim().toLowerCase();
  return elenco.filter((c) => {
    if (c.tipo !== tipo) return false;
    if (modulo !== FILTRO_TUTTI && c.modulo !== modulo) return false;
    if (!q) return true;
    return (
      c.titolo.toLowerCase().includes(q) ||
      c.modulo.toLowerCase().includes(q) ||
      c.meta.toLowerCase().includes(q)
    );
  });
}

/** The newest thing not yet opened, for the Home's "Oggi" list. */
export function primoDaVedere(
  tipo: TipoContenuto,
  elenco: readonly Contenuto[] = CONTENUTI
): Contenuto | undefined {
  return elenco.find((c) => c.tipo === tipo && c.progresso === 0);
}
