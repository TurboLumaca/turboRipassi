/**
 * View — Tempo Risparmiato Stat Component (Ebbinghaus Savings Method).
 *
 * Quantifies cognitive ROI by displaying estimated study hours saved
 * with interactive explanation on tap.
 */
import React from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Icona } from "@/view/theme/icone";
import { Card } from "@/view/components/ui";
import { Kicker, Testo, Titolo } from "@/view/components/organic";
import { useStatisticheRipassi } from "@/controller/ripassi/useStatisticheRipassi";
import type { RisparmioTempoResult } from "@/model/ripassi/savingsLogic";

export const SPIEGAZIONE_RISPARMIO =
  "Tempo che avresti dovuto spendere per ristudiare da capo questi concetti se li avessi dimenticati.";

export function TempoRisparmiatoStat({
  risparmioTempo: customRisparmio,
  onPress,
}: {
  risparmioTempo?: RisparmioTempoResult;
  onPress?: () => void;
}) {
  const { risparmioTempo: hookRisparmio } = useStatisticheRipassi();
  const risparmio = customRisparmio ?? hookRisparmio;

  function mostraInfo() {
    if (onPress) {
      onPress();
      return;
    }
    Alert.alert(
      "Tempo di Studio Risparmiato",
      SPIEGAZIONE_RISPARMIO,
      [{ text: "Ho capito" }]
    );
  }

  const tempoTesto = `~${risparmio.oreFormattate} risparmiate`;

  return (
    <Pressable
      onPress={mostraInfo}
      accessibilityRole="button"
      accessibilityLabel={`Tempo di studio risparmiato: ${tempoTesto}. Tocca per informazioni.`}
      style={({ pressed }) => [pressed && styles.premuto]}
    >
      <Card style={styles.card}>
        <View style={styles.riga}>
          <View style={styles.iconaContenitore}>
            <Icona nome="ripassa" size={18} color={theme.colors.accentInk} />
          </View>
          <View style={styles.testoColonna}>
            <Kicker colore={theme.colors.accentInk}>Efficienza Studio</Kicker>
            <Titolo size={17} style={styles.valore}>
              {tempoTesto}
            </Titolo>
            <Testo size={theme.font.meta} muto>
              {"Tocca per capire come viene calcolato ⓘ"}
            </Testo>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderColor: theme.ramp.accent[200],
  },
  premuto: {
    opacity: 0.85,
  },
  riga: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  iconaContenitore: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.ramp.accent[100],
    alignItems: "center",
    justifyContent: "center",
  },
  testoColonna: {
    flex: 1,
    gap: 1,
  },
  valore: {
    color: theme.colors.text,
  },
});
