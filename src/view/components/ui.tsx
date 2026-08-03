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

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const { label, onPress, variant = "primary", disabled, loading, style } = props;
  const bg =
    variant === "accent"
      ? theme.colors.accent
      : variant === "ghost"
      ? "transparent"
      : variant === "danger"
      ? theme.colors.danger
      : theme.colors.primary;
  const fg =
    variant === "accent"
      ? theme.colors.textOnAccent
      : variant === "ghost"
      ? theme.colors.primary
      : theme.colors.textOnPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        variant === "ghost" && styles.btnGhost,
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

export function Badge({ label, tone = "primary" }: { label: string; tone?: "primary" | "accent" | "muted" }) {
  const bg =
    tone === "accent" ? theme.colors.accent : tone === "muted" ? theme.colors.surfaceAlt : theme.colors.primaryLight;
  const fg = tone === "accent" ? theme.colors.textOnAccent : tone === "muted" ? theme.colors.textMuted : theme.colors.textOnPrimary;
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
  btnGhost: {
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
