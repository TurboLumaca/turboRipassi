/**
 * View — the side menu: what gets opened in weeks, not in days.
 *
 * The old drawer was a flat list of eleven entries that mixed the profile,
 * course content, system functions and lead generation, so finding anything
 * meant reading all of it. Three groups with a heading each, and a line under
 * every entry saying what it does — written for the person opening the app for
 * the first time, who is the only one who needs it and the only one nobody was
 * writing for.
 */
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/view/theme/theme";
import { Icona, type NomeIcona } from "@/view/theme/icone";
import { Iniziali, Kicker, Testo, Titolo } from "@/view/components/organic";

export interface VoceMenu {
  chiave: string;
  label: string;
  /** The line underneath: what this opens, in one clause. */
  nota: string;
  icona: NomeIcona;
  onPress: () => void;
  /** Guests see the entry, greyed, with no destination. */
  disabilitata?: boolean;
}

export interface GruppoMenu {
  label: string;
  voci: VoceMenu[];
}

export function MenuLaterale({
  aperto,
  onChiudi,
  nome,
  sottotitolo,
  iniziali,
  gruppi,
}: {
  aperto: boolean;
  onChiudi: () => void;
  nome: string;
  sottotitolo: string;
  iniziali: string;
  gruppi: GruppoMenu[];
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={aperto}
      transparent
      animationType="fade"
      onRequestClose={onChiudi}
      statusBarTranslucent
    >
      <View style={styles.sopra}>
        {/* Tapping the darkened list behind the drawer closes it: on a phone
            this is the gesture people try first, ahead of the × . */}
        <Pressable
          style={styles.velo}
          onPress={onChiudi}
          accessibilityRole="button"
          accessibilityLabel="Chiudi il menu"
        />
        <View style={[styles.pannello, { paddingTop: insets.top + theme.spacing.lg }]}>
          <View style={styles.testata}>
            <Iniziali testo={iniziali} size={46} />
            <View style={styles.testataTesti}>
              <Titolo size={theme.font.title} numberOfLines={1}>
                {nome}
              </Titolo>
              <Testo size={theme.font.meta} muto numberOfLines={1}>
                {sottotitolo}
              </Testo>
            </View>
            <Pressable
              onPress={onChiudi}
              accessibilityRole="button"
              accessibilityLabel="Chiudi"
              style={styles.chiudi}
            >
              <Icona nome="chiudi" size={17} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[styles.elenco, { paddingBottom: insets.bottom + theme.spacing.lg }]}
            showsVerticalScrollIndicator={false}
          >
            {gruppi.map((g) => (
              <View key={g.label} style={styles.gruppo}>
                <Kicker style={styles.gruppoLabel}>{g.label}</Kicker>
                {g.voci.map((v) => (
                  <Pressable
                    key={v.chiave}
                    onPress={v.onPress}
                    disabled={v.disabilitata}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: v.disabilitata }}
                    style={({ pressed }) => [
                      styles.voce,
                      pressed && styles.vocePremuta,
                      v.disabilitata && styles.voceSpenta,
                    ]}
                  >
                    <Icona nome={v.icona} size={19} color={theme.colors.text} />
                    <View style={styles.voceTesti}>
                      <Testo size={theme.font.body}>{v.label}</Testo>
                      {v.nota ? (
                        <Testo size={theme.font.meta} muto>
                          {v.nota}
                        </Testo>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sopra: { flex: 1, flexDirection: "row" },
  velo: { flex: 1, backgroundColor: "rgba(17,24,39,0.45)" },
  pannello: {
    width: 314,
    maxWidth: "88%",
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    shadowColor: theme.colors.inkSurface,
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: -12, height: 0 },
    elevation: 16,
  },
  testata: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  testataTesti: { flex: 1, gap: 1 },
  chiudi: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  elenco: { gap: theme.spacing.lg },
  gruppo: { gap: 3 },
  gruppoLabel: { paddingHorizontal: theme.spacing.sm, paddingBottom: theme.spacing.xs },
  voce: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: 11,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  vocePremuta: { backgroundColor: theme.colors.surface },
  voceSpenta: { opacity: 0.45 },
  voceTesti: { flex: 1, gap: 1 },
});
