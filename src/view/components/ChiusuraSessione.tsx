/**
 * View — la schermata di chiusura: il punto in cui l'app dichiara di aver
 * finito di chiedere attenzione.
 *
 * È l'opposto esatto dell'infinite scroll, e la differenza non sta
 * nell'assenza di contenuti — ce ne sono sempre, di concetti da ripassare —
 * ma nel fatto che questa schermata *non è un ponte*. Non propone altro, non
 * suggerisce una seconda sessione, non offre "ancora un concetto". Dice che
 * oggi è finito e mostra la porta.
 *
 * L'anticipo di domani è uno Zeigarnik deliberato e insieme il suo contrario:
 * lascia un anello aperto, ma l'anello si chiude da solo domani secondo lo
 * spacing, non stasera per pressione. È informazione vera — quella domanda è
 * già nello scheduler — e in Modalità Riposo non compare affatto, perché in
 * riposo un'anticipazione smette di essere un'informazione e diventa una
 * ragione per tornare.
 */
import React from "react";
import { Modal, StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Icona } from "@/view/theme/icone";
import { Kicker, Pillola, Testo, Titolo } from "@/view/components/organic";
import type { AnticipoDomani } from "@/model/ripassi/sessioneLogic";

export function ChiusuraSessione({
  aperta,
  riepilogo,
  domani,
  onChiudi,
}: {
  aperta: boolean;
  riepilogo: string;
  domani: AnticipoDomani | null;
  onChiudi: () => void;
}) {
  if (!aperta) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onChiudi}>
      <View style={styles.velo}>
        <View style={styles.scheda}>
          <View style={styles.segno}>
            <Icona nome="fatto" size={22} color={theme.colors.accentInk} />
          </View>

          <Kicker colore={theme.colors.accent}>Sessione conclusa</Kicker>
          <Titolo size={24} style={styles.titolo}>
            {riepilogo}
          </Titolo>

          {domani ? (
            <View style={styles.domani}>
              <Testo size={theme.font.meta} muto>
                Domani
              </Testo>
              <Testo size={theme.font.body} forte>
                {`«${domani.domanda}»`}
              </Testo>
              <Testo size={theme.font.meta} muto>
                60 secondi.
              </Testo>
            </View>
          ) : (
            <Testo size={theme.font.small} muto style={styles.titolo}>
              {"Domani non c'è niente in scadenza. Il tempo lavora lo stesso."}
            </Testo>
          )}

          <Pillola label="Chiudi" onPress={onChiudi} style={styles.bottone} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  velo: {
    flex: 1,
    backgroundColor: "rgba(17,26,46,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  scheda: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  segno: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
  },
  titolo: { textAlign: "center" },
  domani: {
    width: "100%",
    gap: 3,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
  },
  bottone: { marginTop: theme.spacing.lg, minWidth: 180 },
});
