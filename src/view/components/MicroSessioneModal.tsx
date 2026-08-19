/**
 * View — MicroSessioneModal: micro-sessione di ripasso rapido (60s / Pausa Caffè)
 * basata su attrito zero e abitudini atomiche (Fogg Behavior Model).
 */
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { theme } from "@/view/theme/theme";
import { Icona } from "@/view/theme/icone";
import {
  Barra,
  Chip,
  Kicker,
  Pillola,
  Scheda,
  Testo,
  Titolo,
} from "@/view/components/organic";
import type { StatoMicroSessione } from "@/controller/ripassi/useMicroSessione";

export function MicroSessioneModal({
  sessione,
}: {
  sessione: StatoMicroSessione;
}) {
  const {
    aperta,
    elementi,
    indiceCorrente,
    elementoCorrente,
    completata,
    conteggioCompletati,
    secondiTrascorsi,
    inCaricamento,
    confermaCorrente,
    posticipaCorrente,
    chiudi,
  } = sessione;

  const [mostraNota, setMostraNota] = useState(false);
  const [testoNota, setTestoNota] = useState("");

  if (!aperta) return null;

  async function gestisciConferma() {
    await confermaCorrente(testoNota);
    setTestoNota("");
    setMostraNota(false);
  }

  async function gestisciPosticipo() {
    await posticipaCorrente();
    setTestoNota("");
    setMostraNota(false);
  }

  const totale = elementi.length;
  const percentualeAvanzamento =
    totale > 0 ? Math.min(100, Math.round(((indiceCorrente + 1) / totale) * 100)) : 0;

  return (
    <Modal
      visible={aperta}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={chiudi}
    >
      <View style={styles.schermo}>
        {/* Intestazione con chiusura e avanzamento */}
        <View style={styles.testata}>
          <View style={styles.rigaTestata}>
            <Kicker colore={theme.colors.accent}>Pausa rapida · 60s</Kicker>
            <Pressable
              onPress={chiudi}
              accessibilityRole="button"
              accessibilityLabel="Chiudi ripasso rapido"
              hitSlop={12}
              style={styles.pulsanteChiudi}
            >
              <Icona nome="chiudi" size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {!completata && totale > 0 ? (
            <View style={styles.avanzamento}>
              <View style={styles.barra}>
                <Barra percentuale={percentualeAvanzamento} />
              </View>
              <Testo size={theme.font.meta} muto>
                {indiceCorrente + 1} di {totale}
              </Testo>
            </View>
          ) : null}
        </View>

        {completata ? (
          /* Schermata di riepilogo / successo */
          <View style={styles.centroCompletato}>
            <View style={styles.iconaSuccesso}>
              <Icona nome="fatto" size={32} color={theme.colors.textOnAccent} />
            </View>
            <Titolo size={26} style={styles.titoloSuccesso}>
              Ottimo lavoro!
            </Titolo>
            <Testo size={theme.font.body} muto style={styles.testoSuccesso}>
              {conteggioCompletati === 1
                ? `1 concetto consolidato in ${secondiTrascorsi} secondi.`
                : `${conteggioCompletati} concetti consolidati in ${secondiTrascorsi} secondi.`}
            </Testo>
            <Pillola
              label="Torna alla Home"
              onPress={chiudi}
              style={styles.bottoneFine}
            />
          </View>
        ) : elementoCorrente ? (
          /* Scheda del concetto attivo */
          <ScrollView
            contentContainerStyle={styles.contenuto}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Scheda style={styles.schedaConcetto}>
              <Titolo size={24}>{elementoCorrente.ripasso.titolo}</Titolo>

              {elementoCorrente.ripasso.note ? (
                <Testo size={theme.font.body} style={styles.noteEsistenti}>
                  {elementoCorrente.ripasso.note}
                </Testo>
              ) : null}

              {elementoCorrente.ripasso.allegati.length > 0 ? (
                <View style={styles.rigaAllegati}>
                  <Chip
                    label={`${elementoCorrente.ripasso.allegati.length} ${
                      elementoCorrente.ripasso.allegati.length === 1
                        ? "allegato"
                        : "allegati"
                    }`}
                    tono="neutro"
                  />
                </View>
              ) : null}
            </Scheda>

            {/* Micro-nota facoltativa a scomparsa */}
            <View style={styles.sezioneNota}>
              {!mostraNota ? (
                <Pressable
                  onPress={() => setMostraNota(true)}
                  style={styles.toggleNota}
                  accessibilityRole="button"
                >
                  <Icona nome="piu" size={16} color={theme.colors.accent} />
                  <Testo size={theme.font.small} colore={theme.colors.accent} forte>
                    Aggiungi micro-riflessione (opzionale)
                  </Testo>
                </Pressable>
              ) : (
                <View style={styles.boxNota}>
                  <TextInput
                    value={testoNota}
                    onChangeText={setTestoNota}
                    placeholder="Scrivi un appunto veloce..."
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.inputNota}
                    multiline
                    autoFocus
                  />
                </View>
              )}
            </View>

            {/* Pulsanti di azione a 1 tap */}
            <View style={styles.azioni}>
              <Pillola
                label={inCaricamento ? "Salvataggio…" : "Ho ripassato"}
                onPress={() => void gestisciConferma()}
                disabled={inCaricamento}
                icona="fatto"
                style={styles.bottoneConferma}
              />
              <Pillola
                label="Rimanda a domani"
                variante="secondaria"
                onPress={() => void gestisciPosticipo()}
                disabled={inCaricamento}
                style={styles.bottonePosticipa}
              />
            </View>
          </ScrollView>
        ) : (
          <View style={styles.centroVuoto}>
            <Testo muto>Nessun concetto disponibile per la sessione rapida.</Testo>
            <Pillola label="Chiudi" onPress={chiudi} style={styles.bottoneFine} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.md,
  },
  testata: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  rigaTestata: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pulsanteChiudi: {
    padding: theme.spacing.xs,
  },
  avanzamento: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  barra: {
    flex: 1,
  },
  contenuto: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  schedaConcetto: {
    gap: theme.spacing.md,
    minHeight: 180,
    justifyContent: "center",
  },
  noteEsistenti: {
    opacity: 0.9,
    lineHeight: 22,
  },
  rigaAllegati: {
    flexDirection: "row",
    marginTop: theme.spacing.xs,
  },
  sezioneNota: {
    gap: theme.spacing.xs,
  },
  toggleNota: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  boxNota: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputNota: {
    fontFamily: theme.family.body,
    fontSize: theme.font.body,
    color: theme.colors.text,
    minHeight: 60,
  },
  azioni: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  bottoneConferma: {
    minHeight: 52,
  },
  bottonePosticipa: {
    minHeight: 46,
  },
  centroCompletato: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  iconaSuccesso: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  titoloSuccesso: {
    textAlign: "center",
  },
  testoSuccesso: {
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  centroVuoto: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  bottoneFine: {
    minWidth: 180,
  },
});
