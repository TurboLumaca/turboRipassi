/**
 * View — the rows that list a ripasso's review dates.
 *
 * Two shapes share one look: a stored occurrence, which is tappable and shows
 * its state (completed / overdue / the manual +1h), and a computed one shown
 * while creating, which has no state yet and shows the offset it came from.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Badge } from "@/view/components/ui";
import { formatData, isPassato } from "@/view/lib/format";
import { ETICHETTE_OFFSET, type OccorrenzaCalcolata } from "@/model/ripassi/occorrenzeDates";
import type { Occorrenza } from "@/model/types";

/** A stored occurrence: tap to reschedule it or mark it done. */
export function RigaOccorrenza({
  occorrenza,
  onPress,
}: {
  occorrenza: Occorrenza;
  onPress: (o: Occorrenza) => void;
}) {
  return (
    <Pressable style={styles.riga} onPress={() => onPress(occorrenza)}>
      <View style={styles.corpo}>
        <Text style={[styles.data, occorrenza.is_completed && styles.completata]}>
          {formatData(occorrenza.scheduled_at)}
        </Text>
        <View style={styles.tag}>
          {occorrenza.is_manual_1h ? <Badge label="+1 ora" tone="accent" /> : null}
          {occorrenza.is_completed ? (
            <Badge label="Completato" tone="muted" />
          ) : isPassato(occorrenza.scheduled_at) ? (
            <Badge label="Scaduto" tone="muted" />
          ) : null}
        </View>
      </View>
      <Text style={styles.iconaModifica}>✎</Text>
    </Pressable>
  );
}

/** An occurrence that will be created on save: not tappable, labelled by offset. */
export function RigaAnteprimaOccorrenza({ occorrenza }: { occorrenza: OccorrenzaCalcolata }) {
  return (
    <View style={styles.riga}>
      <View style={styles.corpo}>
        <Text style={styles.data}>{formatData(occorrenza.scheduled_at)}</Text>
        <View style={styles.tag}>
          <Badge
            label={ETICHETTE_OFFSET[occorrenza.offset]}
            tone={occorrenza.is_manual_1h ? "accent" : "primary"}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  riga: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  corpo: { flex: 1 },
  data: { fontSize: theme.font.body, color: theme.colors.text, fontWeight: "600" },
  completata: { textDecorationLine: "line-through", color: theme.colors.completed },
  tag: { flexDirection: "row", gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  iconaModifica: { fontSize: 20, color: theme.colors.primary, paddingHorizontal: theme.spacing.sm },
});
