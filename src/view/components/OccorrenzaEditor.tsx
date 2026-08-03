/**
 * View — modal to edit a single occurrence.
 *
 * Requirements:
 *  - pick the date from a CALENDAR (any day), not just ±1 day;
 *  - the reminder's time of day stays unchanged (only the day is edited);
 *  - dismiss by tapping OUTSIDE the card (backdrop), staying on the ripasso screen.
 *
 * Pure React Native calendar: no extra native dependency.
 */
import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Badge, Button } from "@/view/components/ui";
import { formatData } from "@/view/lib/format";
import {
  conGiornoDi,
  grigliaMese,
  INTESTAZIONI_GIORNI,
  NOMI_MESE,
  stessoGiorno,
} from "@/view/lib/calendarUtils";
import type { Occorrenza } from "@/model/types";

interface Props {
  /** Occurrence being edited; null = modal closed. */
  occorrenza: Occorrenza | null;
  onChiudi: () => void;
  onSalvaData: (nuovaData: Date) => void;
  onToggleCompletata: (completata: boolean) => void;
}

export function OccorrenzaEditor({
  occorrenza,
  onChiudi,
  onSalvaData,
  onToggleCompletata,
}: Props) {
  const dataOriginale = useMemo(
    () => (occorrenza ? new Date(occorrenza.scheduled_at) : new Date()),
    [occorrenza]
  );

  // Day selected in the calendar and the currently displayed month.
  const [selezionata, setSelezionata] = useState<Date>(dataOriginale);
  const [meseVisibile, setMeseVisibile] = useState<{ anno: number; mese: number }>({
    anno: dataOriginale.getFullYear(),
    mese: dataOriginale.getMonth(),
  });

  // Reset when the occurrence being edited changes.
  React.useEffect(() => {
    setSelezionata(dataOriginale);
    setMeseVisibile({ anno: dataOriginale.getFullYear(), mese: dataOriginale.getMonth() });
  }, [dataOriginale]);

  const celle = useMemo(
    () => grigliaMese(meseVisibile.anno, meseVisibile.mese),
    [meseVisibile]
  );

  const oggi = new Date();

  function cambiaMese(delta: number) {
    setMeseVisibile((m) => {
      const d = new Date(m.anno, m.mese + delta, 1);
      return { anno: d.getFullYear(), mese: d.getMonth() };
    });
  }

  function salva() {
    if (!occorrenza) return;
    onSalvaData(conGiornoDi(dataOriginale, selezionata));
    onChiudi();
  }

  const modificata = occorrenza ? !stessoGiorno(selezionata, dataOriginale) : false;

  return (
    <Modal
      visible={occorrenza !== null}
      transparent
      animationType="fade"
      onRequestClose={onChiudi}
    >
      {/* Backdrop: tapping here outside the card dismisses the modal (stays on the ripasso). */}
      <Pressable style={styles.backdrop} onPress={onChiudi}>
        {/* Card: intercepts the tap so it does NOT propagate to the backdrop. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.titolo}>Modifica ripasso</Text>
          {occorrenza ? (
            <Text style={styles.sottotitolo}>{formatData(occorrenza.scheduled_at)}</Text>
          ) : null}

          {/* Completed toggle */}
          {occorrenza ? (
            <Button
              label={occorrenza.is_completed ? "Segna da fare" : "Segna completata"}
              variant={occorrenza.is_completed ? "ghost" : "accent"}
              onPress={() => {
                onToggleCompletata(!occorrenza.is_completed);
                onChiudi();
              }}
              style={{ marginBottom: theme.spacing.md }}
            />
          ) : null}

          {/* Month header with arrows */}
          <View style={styles.headerMese}>
            <Pressable onPress={() => cambiaMese(-1)} hitSlop={12} style={styles.freccia}>
              <Text style={styles.frecciaTxt}>‹</Text>
            </Pressable>
            <Text style={styles.meseLabel}>
              {NOMI_MESE[meseVisibile.mese]} {meseVisibile.anno}
            </Text>
            <Pressable onPress={() => cambiaMese(1)} hitSlop={12} style={styles.freccia}>
              <Text style={styles.frecciaTxt}>›</Text>
            </Pressable>
          </View>

          {/* Day headers */}
          <View style={styles.settimana}>
            {INTESTAZIONI_GIORNI.map((g) => (
              <Text key={g} style={styles.intestGiorno}>
                {g}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.griglia}>
            {celle.map((c, i) => {
              const isSel = stessoGiorno(c.data, selezionata);
              const isOggi = stessoGiorno(c.data, oggi);
              return (
                <Pressable
                  key={i}
                  style={styles.cella}
                  onPress={() => setSelezionata(c.data)}
                >
                  <View style={[styles.cellaInner, isSel && styles.cellaSel]}>
                    <Text
                      style={[
                        styles.cellaTxt,
                        !c.nelMese && styles.cellaFuori,
                        isSel && styles.cellaTxtSel,
                        isOggi && !isSel && styles.cellaOggi,
                      ]}
                    >
                      {c.data.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {modificata ? (
            <View style={styles.anteprima}>
              <Badge label="Nuova data" tone="accent" />
              <Text style={styles.anteprimaTxt}>
                {formatData(conGiornoDi(dataOriginale, selezionata).toISOString())}
              </Text>
            </View>
          ) : null}

          <View style={styles.azioni}>
            <Button label="Annulla" variant="ghost" onPress={onChiudi} style={{ flex: 1 }} />
            <Button
              label="Salva data"
              variant="accent"
              onPress={salva}
              disabled={!modificata}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CELLA = `${100 / 7}%`;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  titolo: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.primary },
  sottotitolo: {
    fontSize: theme.font.small,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  headerMese: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  freccia: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  frecciaTxt: { fontSize: 22, color: theme.colors.primary, fontWeight: "800", lineHeight: 24 },
  meseLabel: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.text },
  settimana: { flexDirection: "row" },
  intestGiorno: {
    width: CELLA as any,
    textAlign: "center",
    fontSize: theme.font.small,
    color: theme.colors.textMuted,
    fontWeight: "700",
    paddingVertical: theme.spacing.xs,
  },
  griglia: { flexDirection: "row", flexWrap: "wrap" },
  cella: { width: CELLA as any, aspectRatio: 1, padding: 2 },
  cellaInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
  },
  cellaSel: { backgroundColor: theme.colors.primary },
  cellaTxt: { fontSize: theme.font.body, color: theme.colors.text },
  cellaTxtSel: { color: theme.colors.textOnPrimary, fontWeight: "800" },
  cellaFuori: { color: theme.colors.completed },
  cellaOggi: { color: theme.colors.accentDark, fontWeight: "800" },
  anteprima: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  anteprimaTxt: { fontSize: theme.font.small, color: theme.colors.text, flexShrink: 1 },
  azioni: { flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing.lg },
});
