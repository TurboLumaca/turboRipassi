/**
 * View — la micro-sheet del richiamo: il checkbox *è* il richiamo.
 *
 * Il fallimento silenzioso delle app di ripasso a spunta è lo
 * zombie-completion: si spuntano voci senza richiamare niente, e il contatore
 * misura la disciplina nel toccare cerchi. Qui il tondino apre una domanda, la
 * risposta resta coperta finché non si è provato, e solo dopo si dice com'è
 * andata. Da quel momento il completamento è un atto di testing, e non c'è più
 * modo di "vincere il meccanismo" senza richiamare.
 *
 * Due risposte e non cinque gradi: "Lo ricordavo" e "Non del tutto". Una scala
 * fine sembra più scientifica e in pratica introduce una decisione in più in
 * un momento che deve durare secondi.
 *
 * Il terzo passo è l'errore produttivo. Palette neutra-calda, mai rossa: non è
 * una colpa, è la parte dello studio che funziona meglio — i tentativi falliti
 * con feedback insegnano quanto i successi. La frase è vera e varia solo nella
 * forma; la riprogrammazione è visibile perché sapere quando il concetto torna
 * sposta il desiderio sul prossimo incontro con *quel* concetto, che è dove
 * serve che stia.
 */
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Icona } from "@/view/theme/icone";
import { Kicker, Pillola, Testo, Titolo } from "@/view/components/organic";
import { ProgressoMaturazione } from "@/view/components/ProgressoMaturazione";
import { progressoMaturazione } from "@/model/ripassi/capitaleMentaleLogic";
import { haDomandaPropria } from "@/model/ripassi/richiamoLogic";
import type { StatoRichiamo } from "@/controller/ripassi/useRichiamo";

export function SchedaRichiamo({ richiamo }: { richiamo: StatoRichiamo }) {
  const {
    voce,
    passo,
    domanda,
    feedback,
    inCaricamento,
    errore,
    mostraRisposta,
    rispondi,
    chiudi,
  } = richiamo;

  if (!voce) return null;

  const { ripasso } = voce;
  const progresso = progressoMaturazione(ripasso);
  const allegati = ripasso.allegati.length;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={chiudi}
    >
      <View style={styles.schermo}>
        <View style={styles.testata}>
          <Kicker colore={theme.colors.accent}>
            {passo === "erroreProduttivo" ? "Errore produttivo" : "Richiamo"}
          </Kicker>
          <Pressable
            onPress={chiudi}
            accessibilityRole="button"
            accessibilityLabel="Chiudi richiamo"
            hitSlop={12}
          >
            <Icona nome="chiudi" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.contenuto}>
          {passo === "erroreProduttivo" && feedback ? (
            <View style={styles.bloccoErrore}>
              <Titolo size={22}>Hai appena rafforzato questo concetto.</Titolo>
              <Testo size={theme.font.body} style={styles.testoErrore}>
                {feedback.frase}
              </Testo>
              <View style={styles.rientro}>
                <Icona nome="calendario" size={15} color={theme.colors.accentInk} />
                <Testo size={theme.font.small} colore={theme.colors.accentInk} forte>
                  {feedback.rientro}
                </Testo>
              </View>
            </View>
          ) : (
            <>
              <Titolo size={24}>{domanda}</Titolo>
              {haDomandaPropria(ripasso) ? (
                <Testo size={theme.font.meta} muto>
                  {ripasso.titolo}
                </Testo>
              ) : null}

              {passo === "domanda" ? (
                <Testo size={theme.font.small} muto style={styles.invito}>
                  Prova a rispondere a mente, poi scopri la risposta.
                </Testo>
              ) : (
                <View style={styles.risposta}>
                  {ripasso.note ? (
                    <Testo size={theme.font.body}>{ripasso.note}</Testo>
                  ) : (
                    <Testo size={theme.font.body} muto>
                      Questo concetto non ha note: la risposta è quella che hai
                      appena provato a richiamare.
                    </Testo>
                  )}
                  {allegati > 0 ? (
                    <View style={styles.allegati}>
                      <Icona nome="allegato" size={14} color={theme.colors.textMuted} />
                      <Testo size={theme.font.meta} muto>
                        {allegati === 1 ? "1 allegato" : `${allegati} allegati`} — apri il
                        concetto per vederli
                      </Testo>
                    </View>
                  ) : null}
                </View>
              )}

              <ProgressoMaturazione progresso={progresso} />
            </>
          )}

          {errore ? (
            <Testo size={theme.font.small} colore={theme.colors.danger}>
              {errore}
            </Testo>
          ) : null}
        </ScrollView>

        <View style={styles.azioni}>
          {passo === "domanda" ? (
            <Pillola label="Mostra risposta" icona="occhio" onPress={mostraRisposta} />
          ) : passo === "risposta" ? (
            <>
              <Pillola
                label={inCaricamento ? "Salvataggio…" : "Lo ricordavo"}
                icona="fatto"
                disabled={inCaricamento}
                onPress={() => void rispondi("ricordato")}
              />
              <Pillola
                label="Non del tutto"
                variante="secondaria"
                disabled={inCaricamento}
                onPress={() => void rispondi("parziale")}
              />
            </>
          ) : (
            <Pillola label="Ho capito" onPress={chiudi} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  schermo: { flex: 1, backgroundColor: theme.colors.background },
  testata: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  contenuto: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  invito: { fontStyle: "italic" },
  risposta: {
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
  },
  allegati: { flexDirection: "row", alignItems: "center", gap: 5 },
  // Neutra-calda, mai rossa: questo schermo non contesta niente a nessuno.
  bloccoErrore: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
  },
  testoErrore: { lineHeight: 22 },
  rientro: { flexDirection: "row", alignItems: "center", gap: 6 },
  azioni: {
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
});
