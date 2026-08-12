/**
 * View — quello che mostra una quantità: tacche, batteria, barra, iniziali.
 *
 * Nessuno di questi sa che cosa sta misurando. La batteria in particolare non
 * prende una fase come proprietà, ed è voluto: un componente che può disegnarsi
 * durante il corso prima o poi si disegna durante il corso.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { TONI, type Tono } from "./toni";

/**
 * The mastery indicator: five pips, as many filled as ticks reached.
 *
 * Five discrete marks rather than a percentage because the threshold is the
 * whole point — "three out of five" answers "how much is left" at a glance,
 * where "60%" needs the reader to remember what the target was.
 */
export function Tacche({
  raggiunte,
  totale = 5,
  tono = "accento",
  grandi = false,
}: {
  raggiunte: number;
  totale?: number;
  tono?: Tono;
  grandi?: boolean;
}) {
  const { base } = TONI[tono];
  return (
    <View
      style={grandi ? styles.taccheGrandi : styles.tacche}
      accessibilityLabel={`${raggiunte} tacche su ${totale}`}
    >
      {Array.from({ length: totale }, (_, i) => (
        <View
          key={i}
          style={[
            grandi ? styles.taccaGrande : styles.tacca,
            { backgroundColor: i < raggiunte ? base : theme.colors.border },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * The battery: a segmented bar with its nub, and the percentage beside it.
 *
 * It exists only before the course starts. Nothing here enforces that — the
 * phase does, in the Model — but it is the reason the component takes no
 * "phase" prop: a battery that could render during the course would eventually
 * render during the course.
 */
export function Batteria({
  percentuale,
  compatta = false,
}: {
  percentuale: number;
  compatta?: boolean;
}) {
  const carica = Math.max(0, Math.min(100, Math.round(percentuale)));
  return (
    <View style={styles.batteriaRiga} accessibilityLabel={`Batteria al ${carica} per cento`}>
      <View style={styles.batteriaCorpo}>
        <View style={[styles.batteriaGuscio, compatta && styles.batteriaGuscioCompatto]}>
          <View
            style={[
              styles.batteriaCarica,
              compatta && styles.batteriaCaricaCompatta,
              { width: `${carica}%` },
            ]}
          />
        </View>
        <View style={[styles.batteriaNub, compatta && styles.batteriaNubCompatto]} />
      </View>
      <Text style={[styles.batteriaPct, compatta && styles.batteriaPctCompatta]}>{carica}%</Text>
    </View>
  );
}

/** A thin progress bar: reading progress, goals. */
export function Barra({
  percentuale,
  colore = theme.colors.accent,
}: {
  percentuale: number;
  colore?: string;
}) {
  const p = Math.max(0, Math.min(100, Math.round(percentuale)));
  return (
    <View style={styles.barra}>
      <View style={[styles.barraPiena, { width: `${p}%`, backgroundColor: colore }]} />
    </View>
  );
}

/** The circular avatar with initials. */
export function Iniziali({
  testo,
  size = 52,
  sfondo = theme.colors.accent,
}: {
  testo: string;
  size?: number;
  sfondo?: string;
}) {
  return (
    <View
      style={[
        styles.iniziali,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: sfondo },
      ]}
    >
      <Text style={[styles.inizialiTesto, { fontSize: size * 0.36 }]}>{testo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tacche: { flexDirection: "row", gap: 3 },
  tacca: { width: 7, height: 7, borderRadius: theme.radius.pill },
  taccheGrandi: { flexDirection: "row", gap: 6 },
  taccaGrande: { flex: 1, height: 12, borderRadius: theme.radius.pill },
  batteriaRiga: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  batteriaCorpo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  batteriaGuscio: {
    flex: 1,
    height: 38,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: theme.colors.textOnInk,
    padding: 4,
    flexDirection: "row",
  },
  batteriaGuscioCompatto: { height: 26, borderRadius: 11, borderWidth: 2, padding: 3 },
  batteriaCarica: { borderRadius: 10, backgroundColor: theme.colors.accentBright },
  batteriaCaricaCompatta: { borderRadius: 7 },
  batteriaNub: {
    width: 5,
    height: 15,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: theme.colors.textOnInk,
  },
  batteriaNubCompatto: { width: 4, height: 11 },
  batteriaPct: {
    fontFamily: theme.family.heading,
    fontSize: 32,
    color: theme.colors.textOnInk,
  },
  batteriaPctCompatta: { fontSize: 19 },
  barra: {
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border,
    overflow: "hidden",
  },
  barraPiena: { height: "100%", borderRadius: theme.radius.pill },
  iniziali: { alignItems: "center", justifyContent: "center" },
  inizialiTesto: { fontFamily: theme.family.heading, color: theme.colors.textOnAccent },
});
