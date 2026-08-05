/**
 * View — one line of the Home list: a scheduled review, with the circle that
 * marks it as done on the left and the date it falls on at the right.
 *
 * The circle is a separate Pressable inside the row: tapping the row opens the
 * ripasso, tapping the circle only changes its state, so marking something done
 * never costs a screen transition.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { formatGiorno, formatOra } from "@/view/lib/format";
import type { VoceRipasso } from "@/model/ripassi/ripassiLogic";

export function RigaVoce({
  voce,
  onApri,
  onCompleta,
}: {
  voce: VoceRipasso;
  onApri: (v: VoceRipasso) => void;
  onCompleta: (v: VoceRipasso) => void;
}) {
  const { ripasso, occorrenza } = voce;
  const completata = occorrenza.is_completed;

  return (
    <Pressable style={styles.riga} onPress={() => onApri(voce)}>
      <Pressable
        onPress={() => onCompleta(voce)}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completata }}
        accessibilityLabel={`Segna come completato: ${ripasso.titolo}`}
        style={[styles.tondino, completata && styles.tondinoPieno]}
      >
        {completata ? <Text style={styles.spunta}>✓</Text> : null}
      </Pressable>

      <View style={styles.corpo}>
        <Text style={[styles.titolo, completata && styles.titoloCompletato]} numberOfLines={3}>
          {ripasso.titolo}
        </Text>
        {ripasso.allegati.length > 0 ? (
          <Text style={styles.allegati}>📎 {ripasso.allegati.length}</Text>
        ) : null}
      </View>

      <View style={styles.quando}>
        <Text style={styles.data}>{formatGiorno(occorrenza.scheduled_at)}</Text>
        <View style={styles.separatore} />
        <Text style={styles.data}>{formatOra(occorrenza.scheduled_at)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  riga: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  tondino: {
    width: 26,
    height: 26,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  tondinoPieno: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  spunta: { color: theme.colors.textOnPrimary, fontSize: theme.font.small, fontWeight: "800" },
  corpo: { flex: 1, gap: 2 },
  titolo: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.text },
  titoloCompletato: { color: theme.colors.completed },
  allegati: { fontSize: theme.font.small, color: theme.colors.textMuted },
  quando: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  data: { fontSize: theme.font.small, color: theme.colors.textMuted },
  separatore: { width: 1, height: 16, backgroundColor: theme.colors.border },
});
