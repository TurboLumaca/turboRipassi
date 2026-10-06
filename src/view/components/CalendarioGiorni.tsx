/**
 * View — month calendar that picks a single day.
 *
 * Shared by the occurrence editor and by the creation form, which both need
 * "any day, from a calendar" and would otherwise each carry their own copy of
 * the grid. Pure React Native: no extra native dependency.
 *
 * The cells are square (aspectRatio 1) and sized from the width, so the
 * component must never be given the whole width of a landscape iPad: callers
 * wrap it in `SchedaModale`, which caps the width.
 */
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import {
  grigliaMese,
  INTESTAZIONI_GIORNI,
  NOMI_MESE,
  stessoGiorno,
} from "@/view/lib/calendarUtils";

interface Props {
  selezionata: Date;
  onSeleziona: (giorno: Date) => void;
}

export function CalendarioGiorni({ selezionata, onSeleziona }: Props) {
  // The visible month starts on the selected day and then moves on its own.
  const [meseVisibile, setMeseVisibile] = useState<{
    anno: number;
    mese: number;
  }>({
    anno: selezionata.getFullYear(),
    mese: selezionata.getMonth(),
  });

  const celle = useMemo(
    () => grigliaMese(meseVisibile.anno, meseVisibile.mese),
    [meseVisibile],
  );
  const oggi = new Date();

  function cambiaMese(delta: number) {
    setMeseVisibile((m) => {
      const d = new Date(m.anno, m.mese + delta, 1);
      return { anno: d.getFullYear(), mese: d.getMonth() };
    });
  }

  return (
    <View>
      <View style={styles.headerMese}>
        <Pressable
          onPress={() => cambiaMese(-1)}
          hitSlop={12}
          style={styles.freccia}
        >
          <Text style={styles.frecciaTxt}>‹</Text>
        </Pressable>
        <Text style={styles.meseLabel}>
          {NOMI_MESE[meseVisibile.mese]} {meseVisibile.anno}
        </Text>
        <Pressable
          onPress={() => cambiaMese(1)}
          hitSlop={12}
          style={styles.freccia}
        >
          <Text style={styles.frecciaTxt}>›</Text>
        </Pressable>
      </View>

      <View style={styles.settimana}>
        {INTESTAZIONI_GIORNI.map((g) => (
          <Text key={g} style={styles.intestGiorno}>
            {g}
          </Text>
        ))}
      </View>

      <View style={styles.griglia}>
        {celle.map((c, i) => {
          const isSel = stessoGiorno(c.data, selezionata);
          const isOggi = stessoGiorno(c.data, oggi);
          return (
            <Pressable
              key={i}
              style={styles.cella}
              onPress={() => onSeleziona(c.data)}
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
    </View>
  );
}

const CELLA = `${100 / 7}%`;

const styles = StyleSheet.create({
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
  frecciaTxt: {
    fontSize: 22,
    color: theme.colors.primary,
    fontWeight: "800",
    lineHeight: 24,
  },
  meseLabel: {
    fontSize: theme.font.body,
    fontWeight: "700",
    color: theme.colors.text,
  },
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
});
