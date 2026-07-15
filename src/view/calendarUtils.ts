/**
 * View helper — pure construction of a month grid (no UI or network
 * dependency). Week starts on Monday (Italian/European convention).
 */

export interface CellaCalendario {
  /** Cell date (local midnight). */
  data: Date;
  /** True if it belongs to the displayed month (false = "spillover" day). */
  nelMese: boolean;
}

export const NOMI_MESE = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export const INTESTAZIONI_GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

/** 0..6 index with Monday = 0 (getDay gives Sunday = 0). */
function lunedizeroIndice(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Are two dates the same local day? */
export function stessoGiorno(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * 6-row × 7-column grid (42 cells) covering the whole month `anno`/`mese`
 * (0-based), padded with days from adjacent months. 42 cells cover any
 * month while keeping a stable height.
 */
export function grigliaMese(anno: number, mese: number): CellaCalendario[] {
  const primo = new Date(anno, mese, 1);
  const offset = lunedizeroIndice(primo); // how many days of the previous month to show
  const celle: CellaCalendario[] = [];
  const inizio = new Date(anno, mese, 1 - offset);
  for (let i = 0; i < 42; i++) {
    const data = new Date(inizio.getFullYear(), inizio.getMonth(), inizio.getDate() + i);
    celle.push({ data, nelMese: data.getMonth() === mese });
  }
  return celle;
}

/**
 * Applies the day of `giorno` to `base`, keeping `base`'s hour/minute/second
 * (requirement: change the date but not the reminder's time of day).
 */
export function conGiornoDi(base: Date, giorno: Date): Date {
  return new Date(
    giorno.getFullYear(),
    giorno.getMonth(),
    giorno.getDate(),
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds()
  );
}
