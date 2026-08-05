/**
 * View helper — Italian date formatting. No business logic.
 */
const GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const MESI = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

export function formatData(iso: string): string {
  const d = new Date(iso);
  return `${GIORNI[d.getDay()]} ${formatGiorno(iso)} · ${formatOra(iso)}`;
}

/** Day of the list rows: "5 ago 2026". No weekday, no time. */
export function formatGiorno(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

/** Time of day, zero-padded: "09:05". */
export function formatOra(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDataBreve(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESI[d.getMonth()]}`;
}

/** Relative label: Oggi / Domani / Ieri (Today/Tomorrow/Yesterday) / short date. */
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
