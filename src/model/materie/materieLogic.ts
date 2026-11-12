/**
 * Model layer — PURE rules for the materie (subject tags).
 *
 * No I/O and no React: choosing a colour, validating a name and filtering the
 * list are the decisions worth testing without a device.
 */
import type { Materia, RipassoCompleto } from "../types";

/** Lunghezza massima del nome, la stessa del check sul database. */
export const LUNGHEZZA_MAX_NOME = 40;

/**
 * I colori fra cui sceglie una materia nuova.
 *
 * Una tavolozza chiusa e non un selettore libero: ogni colore è leggibile sul
 * fondo dell'app e distinguibile dagli altri, cosa che un color picker non
 * garantisce. Sono gli stessi dei tag iniziali, così una materia creata a mano
 * non stona accanto a quelle seminate.
 */
export const PALETTE_MATERIE: readonly string[] = [
  "#5AA9E6", // azzurro (le materie universitarie)
  "#B38AF2", // viola
  "#4E9C7C", // verde
  "#EE6A5F", // corallo
  "#D8B07A", // sabbia
  "#5B9BEF", // blu
  "#3FA8E3", // celeste
  "#E58BB8", // rosa
  "#8FCB5A", // lime
  "#F2A65A", // arancio
  "#8F9BA8", // grigio
];

/** Nome ripulito: spazi ai bordi e interni ridotti a uno. */
export function normalizzaNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

/** Chiave di confronto: lo stesso criterio dell'indice univoco sul database. */
function chiave(nome: string): string {
  return normalizzaNome(nome).toLowerCase();
}

/** La materia con questo nome, senza badare a maiuscole e spazi; altrimenti null. */
export function trovaPerNome(materie: readonly Materia[], nome: string): Materia | null {
  const k = chiave(nome);
  return materie.find((m) => chiave(m.nome) === k) ?? null;
}

/** Perché un nome non va bene, in italiano per l'utente; null se va bene. */
export function erroreNome(materie: readonly Materia[], nome: string): string | null {
  const pulito = normalizzaNome(nome);
  if (pulito === "") return "Scrivi il nome della materia.";
  if (pulito.length > LUNGHEZZA_MAX_NOME) {
    return `Il nome può avere al massimo ${LUNGHEZZA_MAX_NOME} caratteri.`;
  }
  if (trovaPerNome(materie, pulito)) return "Esiste già una materia con questo nome.";
  return null;
}

/**
 * Il colore per una materia nuova: il primo della tavolozza non ancora usato.
 * Con la tavolozza esaurita si riparte dal meno usato, così i colori restano
 * ripartiti in modo uniforme invece di accumularsi sul primo.
 */
export function prossimoColore(materie: readonly Materia[]): string {
  const usi = new Map<string, number>(PALETTE_MATERIE.map((c) => [c, 0]));
  for (const m of materie) {
    const c = m.colore.toUpperCase();
    for (const p of PALETTE_MATERIE) {
      if (p.toUpperCase() === c) usi.set(p, (usi.get(p) ?? 0) + 1);
    }
  }
  const minimo = Math.min(...usi.values());
  return PALETTE_MATERIE.find((c) => usi.get(c) === minimo) ?? PALETTE_MATERIE[0];
}

/** Le materie in ordine alfabetico, senza badare a maiuscole né accenti. */
export function ordinaMaterie(materie: readonly Materia[]): Materia[] {
  return materie.slice().sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }));
}

/** Indice per id, per risolvere `materia_id` di ogni riga senza una ricerca lineare. */
export function perId(materie: readonly Materia[]): Map<string, Materia> {
  return new Map(materie.map((m) => [m.id, m]));
}

/**
 * Il filtro della lista. `materiaId` null significa "tutte": non filtra.
 *
 * Una materia sparita (cancellata su un altro dispositivo) azzera
 * `materia_id` sul server; fino alla prossima ricarica un ripasso può avere
 * ancora l'id vecchio, e non corrisponde più a niente: semplicemente non
 * compare sotto nessun filtro, tranne "tutte".
 */
export function filtraPerMateria<T extends Pick<RipassoCompleto, "materia_id">>(
  ripassi: readonly T[],
  materiaId: string | null
): T[] {
  if (materiaId === null) return ripassi.slice();
  return ripassi.filter((r) => r.materia_id === materiaId);
}

/** Inchiostro leggibile (chiaro o scuro) sopra un colore di sfondo esadecimale. */
export function inchiostroSu(sfondo: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(sfondo);
  if (!m) return "#1C253F";
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
  // Luminanza percepita (Rec. 601).
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.6 ? "#1C253F" : "#FFFFFF";
}
