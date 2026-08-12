/**
 * View — le superfici su cui poggia tutto il resto: la scheda chiara, la
 * scheda scura, e la riga che porta da qualche parte.
 *
 * Sono tre e non di più di proposito. Il difetto che il sistema di design è
 * nato per togliere era proprio questo: ogni schermata disegnava la sua idea di
 * card, con il suo raggio e il suo padding.
 */
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "@/view/theme/theme";
import { Icona, type NomeIcona } from "@/view/theme/icone";
import { TONI, type Tono } from "./toni";
import { Testo } from "./testo";

/** A content card on the app's light ground. */
export function Scheda({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (!onPress) return <View style={[styles.scheda, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.scheda, pressed && styles.premuta, style]}
    >
      {children}
    </Pressable>
  );
}

/**
 * The dark card. Used for the four or five moments the app speaks in the first
 * person — the phase card on the Home, the battery, the flashcard in session,
 * the lead-gen veil — and nowhere else, so that "dark" keeps meaning something.
 */
export function SchedaScura({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.schedaScura, style]}>{children}</View>;
}

/** A row that leads somewhere: icon, two lines of text, chevron. */
export function RigaNavigabile({
  icona,
  tono = "accento",
  titolo,
  nota,
  onPress,
}: {
  icona: NomeIcona;
  tono?: Tono;
  titolo: string;
  nota?: string;
  onPress: () => void;
}) {
  const { tinta, inchiostro } = TONI[tono];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.riga, pressed && styles.premuta]}
    >
      <View style={[styles.rigaTondo, { backgroundColor: tinta }]}>
        <Icona nome={icona} size={18} color={inchiostro} />
      </View>
      <View style={styles.rigaTesti}>
        <Testo size={theme.font.body} forte numberOfLines={1}>
          {titolo}
        </Testo>
        {nota ? (
          <Testo size={theme.font.small} muto numberOfLines={1}>
            {nota}
          </Testo>
        ) : null}
      </View>
      <Icona nome="avanti" size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scheda: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  schedaScura: {
    backgroundColor: theme.colors.inkSurface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
  },
  premuta: { opacity: 0.85 },
  riga: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    paddingRight: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  rigaTondo: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  rigaTesti: { flex: 1, gap: 1 },
});
