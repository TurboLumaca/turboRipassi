/**
 * View — "Segnala problema": the way a handled failure reaches whoever can do
 * something about it.
 *
 * Only unhandled crashes reached crash reporting on their own (ErrorBoundary
 * and the Sentry wrap around the root). Everything the app catches and
 * translates — an upload that did not land, a write refused by the server —
 * was read by the user and then gone. This is the missing half: the person who
 * saw it says what happened, and the report carries the context they would
 * otherwise have to reconstruct.
 *
 * The last error is attached automatically, and shown before sending rather
 * than smuggled along: what leaves the device is something the user has read.
 */
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Button } from "@/view/components/ui";
import { useAuthCtx } from "@/controller/AuthContext";
import { ultimoErroreMostrato } from "@/controller/avvisoErrore";
import { inviaSegnalazione, type EsitoSegnalazione } from "@/config/crashReporting";

/** What the user reads for each way the send can end. */
const MESSAGGI: Record<EsitoSegnalazione, string> = {
  inviata: "Segnalazione inviata. Grazie: ci aiuta a capire cosa è successo.",
  nonRiuscita:
    "Non sono riuscito a inviare la segnalazione. Controlla la connessione e riprova: il testo resta qui.",
  nonConfigurato:
    "Le segnalazioni non sono attive in questa versione dell'app. Non è colpa tua: non c'è niente da riprovare.",
};

export function SegnalaProblema() {
  const { session } = useAuthCtx();
  const [aperto, setAperto] = useState(false);
  const [descrizione, setDescrizione] = useState("");
  const [inviando, setInviando] = useState(false);
  const [esito, setEsito] = useState<EsitoSegnalazione | null>(null);

  const ultimo = aperto ? ultimoErroreMostrato() : null;

  function apri() {
    setEsito(null);
    setAperto(true);
  }

  /**
   * Closing keeps the text only while the send failed: a report that went out
   * and stays in the box invites sending it twice, and one that was never
   * written has nothing to keep.
   */
  function chiudi() {
    if (esito === "inviata") setDescrizione("");
    setAperto(false);
  }

  async function invia() {
    if (descrizione.trim() === "" || inviando) return;
    setInviando(true);
    setEsito(null);
    try {
      setEsito(
        await inviaSegnalazione({
          descrizione: descrizione.trim(),
          email: session?.user.email,
          ultimoErrore: ultimo
            ? `${ultimo.operazione}: ${ultimo.messaggio}${
                ultimo.dettaglio ? ` — ${ultimo.dettaglio}` : ""
              }`
            : null,
        })
      );
    } finally {
      setInviando(false);
    }
  }

  return (
    <>
      <Text style={styles.nota}>
        Qualcosa non ha funzionato? Raccontacelo: alla segnalazione alleghiamo da soli
        l&apos;ultimo errore che hai visto, il tuo indirizzo e la versione dell&apos;app.
      </Text>
      <Button label="Segnala problema" variant="ghost" onPress={apri} />

      <Modal visible={aperto} transparent animationType="fade" onRequestClose={chiudi}>
        {/* Tapping outside closes it, like the other panels of the app. */}
        <Pressable style={styles.sfondo} onPress={chiudi}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.titolo}>Segnala un problema</Text>

            <TextInput
              placeholder="Cosa è successo? Es. «ho allegato una foto e non è stata caricata»"
              placeholderTextColor={theme.colors.textMuted}
              value={descrizione}
              onChangeText={setDescrizione}
              multiline
              style={styles.input}
            />

            {ultimo ? (
              <Text style={styles.contesto} numberOfLines={3}>
                Ultimo errore mostrato: {ultimo.messaggio}
              </Text>
            ) : (
              <Text style={styles.contesto}>
                Nessun errore recente da allegare: descrivi tu cosa hai visto.
              </Text>
            )}

            {esito ? (
              <Text style={esito === "inviata" ? styles.esitoOk : styles.esitoKo}>
                {MESSAGGI[esito]}
              </Text>
            ) : null}

            <View style={styles.azioni}>
              <Button
                label={esito === "inviata" ? "Chiudi" : "Annulla"}
                variant="ghost"
                onPress={chiudi}
                style={{ flex: 1 }}
              />
              <Button
                label="Invia"
                variant="accent"
                loading={inviando}
                disabled={descrizione.trim() === ""}
                onPress={() => void invia()}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  nota: { color: theme.colors.textMuted, fontSize: theme.font.small, marginBottom: theme.spacing.sm },
  sfondo: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  titolo: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.primary },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.font.body,
    color: theme.colors.text,
    minHeight: 110,
    textAlignVertical: "top",
  },
  contesto: { color: theme.colors.textMuted, fontSize: theme.font.small, fontStyle: "italic" },
  esitoOk: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: "700" },
  esitoKo: { color: theme.colors.danger, fontSize: theme.font.small, fontWeight: "700" },
  azioni: { flexDirection: "row", gap: theme.spacing.md },
});
