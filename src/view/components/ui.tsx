/**
 * View — reusable UI components (no business logic).
 */
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { theme } from "@/view/theme/theme";

type Variant = "primary" | "accent" | "ghost" | "danger";
type Tone = "primary" | "accent" | "muted";

/**
 * Colour of each variant, as data rather than as a chain of ternaries.
 *
 * The chains this replaces each ended in a fallback branch, so leaving a new
 * variant out of one of them satisfied the `Variant` union while producing an
 * unreadable text-on-background pairing that no type could catch. A `Record`
 * keyed on the union is exhaustive: omitting a case is a compile error, and
 * adding one means adding a line. Same argument the Model already makes for
 * the error translation table.
 */
const VARIANTI: Record<Variant, { bg: string; fg: string; bordo?: boolean }> = {
  primary: { bg: theme.colors.primary, fg: theme.colors.textOnPrimary },
  accent: { bg: theme.colors.accent, fg: theme.colors.textOnAccent },
  ghost: { bg: "transparent", fg: theme.colors.primary, bordo: true },
  danger: { bg: theme.colors.danger, fg: theme.colors.textOnPrimary },
};

const TONI: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: theme.colors.primaryLight, fg: theme.colors.textOnPrimary },
  accent: { bg: theme.colors.accent, fg: theme.colors.textOnAccent },
  muted: { bg: theme.colors.surfaceAlt, fg: theme.colors.textMuted },
};

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const { label, onPress, variant = "primary", disabled, loading, style } = props;
  const { bg, fg, bordo } = VARIANTI[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        bordo && styles.btnBordo,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Card(props: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, props.style]}>{props.children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/**
 * A checkbox and its label, tappable as one target.
 *
 * The Home filter used to draw its own box inline. The occurrence editor needs
 * the same control, and two hand-drawn checkboxes drift apart in size and
 * colour the first time either one is touched — so there is one.
 */
export function Casella({
  label,
  sotto,
  valore,
  onCambia,
  style,
}: {
  label: string;
  /** Optional second line: what ticking the box will actually do. */
  sotto?: string;
  valore: boolean;
  onCambia: (v: boolean) => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      style={[styles.casellaRiga, style]}
      onPress={() => onCambia(!valore)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: valore }}
    >
      <View style={[styles.casella, valore && styles.casellaPiena]}>
        {valore ? <Text style={styles.casellaSpunta}>✓</Text> : null}
      </View>
      <View style={styles.casellaTesti}>
        <Text style={styles.casellaLabel}>{label}</Text>
        {sotto ? <Text style={styles.casellaSotto}>{sotto}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * A label and the value next to it. Both profile sections are built out of
 * these, and they used to declare an identical copy each.
 */
export function Voce({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <View style={styles.voce}>
      <Text style={styles.voceEtichetta}>{etichetta}</Text>
      <Text style={styles.voceValore} numberOfLines={1}>
        {valore}
      </Text>
    </View>
  );
}

export function Badge({ label, tone = "primary" }: { label: string; tone?: Tone }) {
  const { bg, fg } = TONI[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
  },
  btnBordo: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  btnLabel: {
    fontSize: theme.font.body,
    fontWeight: "700",
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: theme.font.title,
    fontWeight: "800",
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  voce: { flexDirection: "row", gap: theme.spacing.sm },
  voceEtichetta: { color: theme.colors.textMuted, fontSize: theme.font.small, width: 88 },
  voceValore: { flex: 1, color: theme.colors.text, fontSize: theme.font.small },
  casellaRiga: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  casella: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.sm,
    borderWidth: 2,
    borderColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  casellaPiena: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  casellaSpunta: {
    color: theme.colors.textOnPrimary,
    fontSize: theme.font.small,
    fontWeight: "800",
  },
  casellaTesti: { flex: 1, gap: 2 },
  casellaLabel: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: "600" },
  casellaSotto: { color: theme.colors.textMuted, fontSize: theme.font.small },
  badge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: theme.font.small,
    fontWeight: "700",
  },
});
