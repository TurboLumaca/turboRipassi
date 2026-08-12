/**
 * View — the bottom bar: the four things that get opened every day.
 *
 * Four, not five or eleven. Video and letture used to be separate
 * destinations; they have the same frequency of use and the same nature, so
 * they share the Contenuti slot and split with a segmented control inside it.
 * The Flashcard, useful but opened weekly rather than daily, moved to the
 * drawer — in the bar it would have taken a place from something always used.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/view/theme/theme";
import { Icona, type NomeIcona } from "@/view/theme/icone";

/** Which of the four tabs is on screen. */
export type Tab = "home" | "allenati" | "ripassa" | "contenuti";

export const TABS: { chiave: Tab; label: string; icona: NomeIcona }[] = [
  { chiave: "home", label: "Home", icona: "home" },
  { chiave: "allenati", label: "Allenati", icona: "allenati" },
  { chiave: "ripassa", label: "TurboRipassi", icona: "ripassa" },
  { chiave: "contenuti", label: "Contenuti", icona: "contenuti" },
];

/** How much room the bar takes at the bottom of a scroll view. */
export const ALTEZZA_TAB_BAR = 64;

export function TabBar({ attiva, onCambia }: { attiva: Tab; onCambia: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  // The bar floats; without this it would sit on the home indicator, which is
  // exactly where the thumb rests.
  const bottom = Math.max(insets.bottom, theme.spacing.lg);

  return (
    <View style={[styles.barra, { bottom }]}>
      {TABS.map((t) => {
        const selezionata = t.chiave === attiva;
        // The selected tab is a filled accent pill, so its label reads in the
        // accent's own ink; the others sit straight on the dark bar.
        const inchiostro = selezionata ? theme.colors.textOnAccent : theme.ramp.neutral[400];
        return (
          <Pressable
            key={t.chiave}
            onPress={() => onCambia(t.chiave)}
            accessibilityRole="tab"
            accessibilityState={{ selected: selezionata }}
            accessibilityLabel={t.label}
            style={[styles.voce, selezionata && styles.voceAttiva]}
          >
            <Icona nome={t.icona} size={21} color={inchiostro} />
            <Text style={[styles.label, { color: inchiostro }]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    position: "absolute",
    left: theme.spacing.md,
    right: theme.spacing.md,
    height: ALTEZZA_TAB_BAR,
    padding: 4,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.inkSurface,
    flexDirection: "row",
    gap: 2,
    // The bar has to read as floating over the list, not as a footer welded to
    // the bottom of it.
    shadowColor: theme.colors.inkSurface,
    shadowOpacity: 0.25,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  voce: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 22,
  },
  voceAttiva: { backgroundColor: theme.colors.accent },
  label: { fontFamily: theme.family.semi, fontSize: 10, letterSpacing: 0.1 },
});
