/**
 * View — i tre livelli di testo del sistema, più lo stato vuoto.
 *
 * Nessuno di loro sceglie una dimensione arbitraria: le misure vengono da
 * `theme.font`, e i chiamanti passano una delle sue voci. È il motivo per cui
 * una schermata nuova non può inventarsi un quarto livello di gerarchia.
 */
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { theme } from "@/view/theme/theme";

/**
 * The eyebrow line above a section: a light italic serif, the LEARN IS voice
 * above a headline. It replaced the tracked small-caps this system used to
 * set here — capitals build hierarchy through weight, this system now builds
 * it through contrast of face instead, the serif italic against the
 * condensed sans of the `Titolo` beneath it.
 */
export function Kicker({
  children,
  colore = theme.colors.textMuted,
  style,
}: {
  children: React.ReactNode;
  colore?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.kicker, { color: colore }, style]}>{children}</Text>;
}

/** A heading in the display face. Never uppercased, never bolded — one weight. */
export function Titolo({
  children,
  size = theme.font.heading,
  colore = theme.colors.text,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  size?: number;
  colore?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[styles.titolo, { fontSize: size, lineHeight: size * 1.14, color: colore }, style]}
    >
      {children}
    </Text>
  );
}

/** Running text. `muto` is the secondary colour, not a smaller size. */
export function Testo({
  children,
  size = theme.font.small,
  muto = false,
  colore,
  forte = false,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  size?: number;
  muto?: boolean;
  colore?: string;
  forte?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: forte ? theme.family.semi : theme.family.body,
          fontSize: size,
          lineHeight: size * 1.5,
          color: colore ?? (muto ? theme.colors.textMuted : theme.colors.text),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** The empty state of a list: a sentence, never an empty screen. */
export function Vuoto({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.vuoto}>
      <Testo muto>{children}</Testo>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: theme.family.eyebrow,
    fontSize: theme.kicker.fontSize,
    letterSpacing: theme.kicker.letterSpacing,
    textTransform: "none",
  },
  titolo: { fontFamily: theme.family.heading },
  vuoto: { paddingVertical: theme.spacing.xl, alignItems: "center" },
});
