/**
 * View — the "Come funziona?" strip at the top of the Home, and the panel it
 * opens over the list.
 *
 * It is a Modal rather than an expanding section on purpose: the explanation is
 * read once and then never again, and an overlay leaves the list underneath
 * exactly where the user left it instead of pushing every row down the screen.
 */
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";

/** Why the app is worth the trouble — the first thing a new user reads. */
const TESTO =
  "Quante ore hai già investito per imparare cose che poi hai dimenticato? " +
  "TurboRipassi riporta a galla ciò che studi nei momenti in cui stai per " +
  "perderlo: dopo un'ora, un giorno, una settimana, un mese e sei mesi. " +
  "Non devi ricordarti di ripassare né tenere il conto: ogni ripasso si " +
  "programma da solo e ti aspetta in lista, con la sua data e la sua ora. " +
  "Segni quello che hai fatto con un tocco sul tondino, e quelli dei giorni " +
  "passati si spostano nello storico, dove puoi ritrovare in un attimo ciò " +
  "che avevi saltato. Alle note puoi allegare foto, PDF e appunti, " +
  "disponibili anche senza connessione. Il risultato è che le nozioni che ti " +
  "interessano restano tue, invece di svanire poco dopo l'esame.";

export function ComeFunziona() {
  const [aperto, setAperto] = useState(false);

  return (
    <>
      <Pressable style={styles.testata} onPress={() => setAperto(true)}>
        <Text style={styles.titolo}>Come funziona?</Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <Modal
        visible={aperto}
        animationType="fade"
        transparent
        onRequestClose={() => setAperto(false)}
      >
        {/* Tapping outside closes it: on a phone the panel covers most of the
            screen, and reaching the X with one hand is not always possible. */}
        <Pressable style={styles.sfondo} onPress={() => setAperto(false)}>
          <Pressable style={styles.pannello} onPress={() => {}}>
            <View style={styles.barra}>
              <Text style={styles.titolo}>Come funziona?</Text>
              <Pressable
                onPress={() => setAperto(false)}
                hitSlop={12}
                accessibilityLabel="Chiudi"
                style={styles.chiudi}
              >
                <Text style={styles.chiudiIcona}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.corpo}>
              <Text style={styles.testo}>{TESTO}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  testata: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  titolo: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.text },
  chevron: { fontSize: theme.font.heading, color: theme.colors.text, marginTop: -6 },
  sfondo: { flex: 1, backgroundColor: "rgba(17, 24, 39, 0.35)" },
  pannello: {
    backgroundColor: theme.colors.surface,
    maxHeight: "70%",
    borderBottomLeftRadius: theme.radius.lg,
    borderBottomRightRadius: theme.radius.lg,
  },
  barra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  chiudi: {
    position: "absolute",
    right: theme.spacing.lg,
    bottom: theme.spacing.md,
  },
  chiudiIcona: { fontSize: theme.font.heading, color: theme.colors.text },
  corpo: { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl },
  testo: {
    fontSize: theme.font.body,
    lineHeight: 24,
    color: theme.colors.text,
    textAlign: "center",
  },
});
