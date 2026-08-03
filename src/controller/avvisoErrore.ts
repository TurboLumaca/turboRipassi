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
  Alert.alert(titolo, dettaglio ? `${messaggio}\n\nDettagli: ${dettaglio}` : messaggio);
}
