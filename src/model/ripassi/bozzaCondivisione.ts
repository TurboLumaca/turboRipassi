/**
 * Model — da ciò che un'altra app condivide alla bozza di un nuovo ripasso.
 *
 * Il foglio "Condividi" di iOS e Android consegna testo, un link o dei file.
 * Qui si decide cosa diventano: il testo va nelle note, la prima riga (o il
 * titolo della pagina) diventa il titolo, i file diventano allegati in attesa.
 * Funzione pura: il modulo nativo che riceve la condivisione sta nel controller.
 */

/** Un file arrivato dalla condivisione, già nella forma di un allegato. */
export interface FileCondiviso {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
}

/** Ciò che il form del ripasso trova già compilato quando si apre. */
export interface BozzaCondivisa {
  titolo: string;
  note: string;
  file: FileCondiviso[];
}

/** Il sottoinsieme di ciò che consegna `expo-share-intent` che serve qui. */
export interface CondivisioneRicevuta {
  text?: string | null;
  webUrl?: string | null;
  meta?: { title?: string } | null;
  files?:
    | {
        path: string;
        fileName?: string | null;
        mimeType?: string | null;
        size?: number | null;
      }[]
    | null;
}

const LUNGHEZZA_MAX_TITOLO = 80;

function accorcia(testo: string): string {
  const t = testo.trim();
  return t.length <= LUNGHEZZA_MAX_TITOLO ? t : `${t.slice(0, LUNGHEZZA_MAX_TITOLO - 1).trimEnd()}…`;
}

function senzaEstensione(nome: string): string {
  const punto = nome.lastIndexOf(".");
  return punto > 0 ? nome.slice(0, punto) : nome;
}

function dominio(url: string): string {
  const m = url.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i);
  return m ? m[1] : url;
}

/** Il nome del file: quello dichiarato, altrimenti l'ultimo pezzo del percorso. */
function nomeFile(path: string, dichiarato: string | null | undefined, indice: number): string {
  if (dichiarato && dichiarato.trim() !== "") return dichiarato;
  const ultimo = decodeURIComponent(path.split("?")[0].split("/").pop() ?? "");
  return ultimo !== "" ? ultimo : `condiviso-${indice + 1}`;
}

export function bozzaDaCondivisione(c: CondivisioneRicevuta): BozzaCondivisa {
  const file: FileCondiviso[] = (c.files ?? []).map((f, i) => ({
    uri: f.path,
    name: nomeFile(f.path, f.fileName, i),
    mimeType: f.mimeType ?? null,
    size: f.size ?? null,
  }));

  const testo = (c.text ?? "").trim();
  const url = c.webUrl?.trim() || null;
  const titoloPagina = c.meta?.title?.trim() || "";

  let titolo = "";
  let note = "";

  if (testo !== "" || url) {
    const corpo = testo !== "" ? testo : (url as string);
    if (titoloPagina !== "") {
      titolo = accorcia(titoloPagina);
      note = corpo;
    } else if (url && corpo.trim() === url) {
      titolo = accorcia(dominio(url));
      note = corpo;
    } else {
      const primaRiga = corpo.split(/\r?\n/).find((r) => r.trim() !== "") ?? "";
      titolo = accorcia(primaRiga);
      // Una sola riga breve è già tutta nel titolo: ripeterla nelle note è rumore.
      note = corpo === titolo ? "" : corpo;
    }
  } else if (file.length > 0) {
    titolo = accorcia(senzaEstensione(file[0].name));
  }

  return { titolo, note, file };
}

/** True quando la condivisione non porta niente da cui fare un ripasso. */
export function condivisioneVuota(c: CondivisioneRicevuta): boolean {
  return (
    (c.text ?? "").trim() === "" && !c.webUrl?.trim() && (c.files ?? []).length === 0
  );
}
