/**
 * View — the card-over-backdrop shell of the date modals.
 *
 * The card is capped in width and height so that on a landscape iPad it stays
 * a card instead of stretching edge to edge (the calendar cells are square, so
 * a full-width card turns each day into a block the size of a button row), and
 * it scrolls when the screen is too short to hold it, as in landscape on a
 * phone. Tapping outside the card dismisses it.
 */
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet } from "react-native";
import { theme } from "@/view/theme/theme";

/** Wide enough for a comfortable month on a tablet, narrow enough to stay a card. */
const LARGHEZZA_MASSIMA = 440;

export function SchedaModale({
  visibile,
  onChiudi,
  children,
}: {
  visibile: boolean;
  onChiudi: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visibile}
      transparent
      animationType="fade"
      onRequestClose={onChiudi}
    >
      <Pressable style={styles.backdrop} onPress={onChiudi}>
        {/* Intercepts the tap so it does not reach the backdrop. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: LARGHEZZA_MASSIMA,
    maxHeight: "100%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
});
