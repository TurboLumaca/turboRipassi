/**
 * View — Allenati.
 *
 * The old screen was a grid of flush-edged tiles, seventy per cent
 * illustration, grouped by kind of exercise. It said nothing about what to do
 * now: not which trainings are required before the course, not which are still
 * locked, not how far any of them had got.
 *
 * This one is a list grouped by phase, with the current phase first and
 * expanded. Every row carries a state — a chip, a colour and a position, three
 * signals rather than one, so the grouping does not depend on colour alone
 * (WCAG 1.4.1). Locked trainings stay on screen and say when they open.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { theme } from "@/view/theme/theme";
import { ICONA_ALLENAMENTO, Icona } from "@/view/theme/icone";
import {
  Batteria,
  Kicker,
  SchedaScura,
  Tacche,
  Testo,
  Titolo,
  TONI,
  type Tono,
} from "@/view/components/organic";
import { ALTEZZA_TAB_BAR } from "@/view/components/TabBar";
import { usePercorso } from "@/controller/PercorsoContext";
import { SOGLIA_PADRONANZA, gruppiAllenamenti, type VoceAllenamento } from "@/model/percorso/allenamenti";
import { batteriaVisibile, type Fase } from "@/model/percorso/fasi";
import type { RootStackParamList } from "@/view/navigation";

type Navigazione = NativeStackNavigationProp<RootStackParamList, "Principale">;

/** The phase a group belongs to, as the colour voice it speaks in. */
const TONO_DI: Record<Fase, Tono> = {
  ospite: "neutro",
  pre: "accento",
  durante: "salvia",
  post: "neutro",
};

export function AllenatiScreen() {
  const nav = useNavigation<Navigazione>();
  const { fase, giorno, padronanze, batteria } = usePercorso();
  const gruppi = gruppiAllenamenti(fase, giorno, padronanze);

  return (
    <ScrollView contentContainerStyle={styles.contenuto} showsVerticalScrollIndicator={false}>
      {gruppi.map((g) => {
        const tono = TONO_DI[g.fase];
        return (
          <View key={g.id} style={styles.gruppo}>
            <View style={styles.kickerRiga}>
              <View style={[styles.punto, { backgroundColor: TONI[tono].base }]} />
              <Kicker colore={TONI[tono].base}>{g.kicker}</Kicker>
            </View>
            <Titolo>{g.titolo}</Titolo>
            <Testo muto>{g.descrizione}</Testo>

            {/* The battery has one home per screen and this is it: the header
                of the group whose trainings charge it. It is drawn only while
                the phase says it exists. */}
            {g.batteria && batteriaVisibile(fase) ? (
              <SchedaScura style={styles.batteria}>
                <Batteria percentuale={batteria} compatta />
              </SchedaScura>
            ) : null}

            {g.voci.map((v) => (
              <RigaAllenamento
                key={v.allenamento.id}
                voce={v}
                tono={tono}
                onPress={() => nav.navigate("Allenamento", { id: v.allenamento.id })}
              />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

/**
 * One training. The same row in all three phases — only the chip and the state
 * change — so the student learns one component and finds it again for the whole
 * journey.
 */
function RigaAllenamento({
  voce,
  tono,
  onPress,
}: {
  voce: VoceAllenamento;
  tono: Tono;
  onPress: () => void;
}) {
  const bloccato = voce.stato === "bloccato";
  const colori = TONI[tono];
  const icona = ICONA_ALLENAMENTO[voce.allenamento.id] ?? "allenati";

  return (
    <Pressable
      onPress={onPress}
      disabled={bloccato}
      accessibilityRole="button"
      accessibilityState={{ disabled: bloccato }}
      accessibilityLabel={`${voce.allenamento.nome}, ${voce.nota}`}
      style={({ pressed }) => [
        styles.riga,
        bloccato && styles.rigaBloccata,
        pressed && styles.premuta,
      ]}
    >
      <View
        style={[
          styles.tondo,
          { backgroundColor: bloccato ? theme.colors.border : colori.tinta },
        ]}
      >
        <Icona
          nome={bloccato ? "lucchetto" : icona}
          size={19}
          color={bloccato ? theme.ramp.neutral[600] : colori.inchiostro}
        />
      </View>

      <View style={styles.testi}>
        <Testo
          size={theme.font.body}
          forte
          colore={bloccato ? theme.colors.textMuted : theme.colors.text}
          numberOfLines={1}
        >
          {voce.allenamento.nome}
        </Testo>
        <View style={styles.metaRiga}>
          <View
            style={[
              styles.chip,
              { backgroundColor: bloccato ? theme.ramp.neutral[300] : colori.tinta },
            ]}
          >
            <Testo
              size={10.5}
              colore={bloccato ? theme.ramp.neutral[800] : colori.inchiostro}
            >
              {voce.chip}
            </Testo>
          </View>
          <Testo size={theme.font.meta} muto>
            {voce.allenamento.famiglia}
          </Testo>
        </View>
      </View>

      <View style={styles.stato}>
        <Tacche raggiunte={voce.padronanza} totale={SOGLIA_PADRONANZA} tono={tono} />
        <Testo size={theme.font.meta} muto>
          {voce.nota}
        </Testo>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenuto: { gap: theme.spacing.xl, paddingBottom: ALTEZZA_TAB_BAR + theme.spacing.xxl },
  gruppo: { gap: theme.spacing.sm },
  kickerRiga: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  punto: { width: 9, height: 9, borderRadius: theme.radius.pill },
  batteria: { paddingVertical: theme.spacing.md, borderRadius: theme.radius.lg },
  riga: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: "transparent",
  },
  // Locked is a step back, not a disappearance: the row stays legible enough
  // to read what it is and when it opens.
  rigaBloccata: {
    backgroundColor: theme.ramp.neutral[200],
    borderColor: theme.colors.border,
  },
  premuta: { opacity: 0.85 },
  tondo: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  testi: { flex: 1, gap: 5 },
  metaRiga: { flexDirection: "row", alignItems: "center", gap: 7 },
  chip: { borderRadius: theme.radius.pill, paddingHorizontal: 9, paddingVertical: 2 },
  stato: { alignItems: "flex-end", gap: 5 },
});
