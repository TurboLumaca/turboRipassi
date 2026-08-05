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
