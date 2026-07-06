/**
 * View helper — formattazione date in italiano. Nessuna logica di business.
 */
const GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const MESI = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

export function formatData(iso: string): string {
  const d = new Date(iso);
  const g = GIORNI[d.getDay()];
  const ora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${g} ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()} · ${ora}`;
}

export function formatDataBreve(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESI[d.getMonth()]}`;
}

/** Etichetta relativa: Oggi / Domani / Ieri / data breve. */
export function etichettaRelativa(iso: string): string {
  const d = new Date(iso);
  const oggi = new Date();
  const g0 = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  const gd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((gd.getTime() - g0.getTime()) / 86400000);
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Domani";
  if (diff === -1) return "Ieri";
  return formatDataBreve(iso);
}

export function isPassato(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}
