/**
 * Controller — the single way a failed operation reaches the user.
 *
 * Sits in the Controller layer, alongside the other wrappers around platform
 * APIs (NetInfo, the pickers): `Alert` is an imperative OS call, not a React
 * component, and the View is meant to describe what is on screen rather than
 * to decide how a Postgres error should read.
 *
 * Before this, four screens each rewrote `traduciErrore` + `Alert.alert` and
 * reported nothing to crash reporting, while the attachment controller had a
 * richer variant of its own. One function now means an error is translated,
 * reported and shown the same way wherever it happens.
 */
import { Alert } from "react-native";
import { dettaglioTecnico, traduciErrore } from "@/model/shared/errorMessages";
import { reportError } from "@/config/crashReporting";

/** The last failure the user actually saw, for a report they write later. */
export interface ErroreMostrato {
  /** The action that failed, as filed in the crash report. */
  operazione: string;
  /** The Italian sentence the user read. */
  messaggio: string;
  /** Original text, when the error was not classifiable. */
  dettaglio: string | null;
  quando: Date;
}

/**
 * Kept in a module variable and not in React state: nothing re-renders when it
 * changes, and every screen writes to it through mostraErrore. A Context would
 * mean a provider around the whole app for a value only the report form reads,
 * once, at the moment it is opened.
 */
let ultimoMostrato: ErroreMostrato | null = null;

/**
 * The last error shown, for the problem report. Handled failures are
 * translated, read and forgotten; someone reporting one half an hour later
 * remembers "non si caricava", not which operation failed or what Drive said.
 */
export function ultimoErroreMostrato(): ErroreMostrato | null {
  return ultimoMostrato;
}

/** Only for tests: forgets what was shown, so one test cannot see another's. */
export function dimenticaUltimoErrore(): void {
  ultimoMostrato = null;
}

/**
 * Reports the error and shows it translated.
 *
 * Unclassifiable errors also carry the original text: an attachment can fail
 * in Drive, in Postgres or on the filesystem, and "Operazione non riuscita"
 * alone gives the user nothing to report. Recognized errors already read well
 * and are deliberately left clean.
 *
 * `operazione` is the label the crash report is filed under — pass the action
 * that failed ("uploadAllegato", "eliminaRipasso"), not a sentence.
 */
export function mostraErrore(
  e: unknown,
  operazione?: string,
  contesto?: Record<string, unknown>
): void {
  reportError(e, { operazione: operazione ?? "sconosciuta", ...contesto });

  const { titolo, messaggio, categoria } = traduciErrore(e);
  const dettaglio = categoria === "sconosciuto" ? dettaglioTecnico(e) : null;
  ultimoMostrato = {
    operazione: operazione ?? "sconosciuta",
    messaggio,
    // The technical text of a classified error too: what the user read is
    // enough to recognize the failure, not to investigate it.
    dettaglio: dettaglio ?? dettaglioTecnico(e),
    quando: new Date(),
  };
  Alert.alert(titolo, dettaglio ? `${messaggio}\n\nDettagli: ${dettaglio}` : messaggio);
}
