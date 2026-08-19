/**
 * View — one line of the TurboRipassi list: a scheduled review, with the circle
 * that marks it done on the left and the date it falls on at the right.
 *
 * The circle is a separate Pressable inside the row: tapping the row opens the
 * ripasso, tapping the circle only changes its state, so marking something done
 * never costs a screen transition.
 *
 * The redesign moved the deadline out of the row and into the structure of the
 * list — the row no longer has to shout that it is today, because the heading
 * above it already said so. What is left here is the title, what is attached to
 * it, and the hour.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Icona } from "@/view/theme/icone";
import { Testo } from "@/view/components/organic";
import { formatDataBreve, formatOra } from "@/view/lib/format";
import { type VoceRipasso } from "@/model/ripassi/ripassiLogic";
import { calcolaLivelloVoce } from "@/model/ripassi/capitaleMentaleLogic";

/**
 * `inCoda` and `nonDisponibile` are the two ways a line can be less than it
 * looks, and they are opposites worth telling apart at a glance: the first is
 * saved here and nowhere else, the second is saved everywhere but here. Both
 * are decided by the caller — the row is not going to ask the cache anything.
 *
 * `inRitardo` colours the date, and only the date: a missed ripasso is still an
 * ordinary row, it is simply the one whose day has gone.
 */
export function RigaVoce({
  voce,
  inCoda = false,
  nonDisponibile = false,
  inRitardo = false,
  onApri,
  onCompleta,
}: {
  voce: VoceRipasso;
  inCoda?: boolean;
  nonDisponibile?: boolean;
  inRitardo?: boolean;
  onApri: (v: VoceRipasso) => void;
  onCompleta: (v: VoceRipasso) => void;
}) {
  const { ripasso, occorrenza } = voce;
  const completata = occorrenza.is_completed;
  const allegati = ripasso.allegati.length;
  const isPermanente = calcolaLivelloVoce(ripasso) === "permanente";

  return (
    <Pressable
      style={({ pressed }) => [styles.riga, pressed && styles.premuta]}
      onPress={() => onApri(voce)}
    >
      <Pressable
        onPress={() => onCompleta(voce)}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completata }}
        accessibilityLabel={`Segna come completato: ${ripasso.titolo}`}
        style={[styles.tondino, completata && styles.tondinoPieno]}
      >
        {completata ? <Icona nome="fatto" size={14} color={theme.colors.textOnInk} /> : null}
      </Pressable>

      <View style={styles.corpo}>
        <Testo
          size={theme.font.body}
          forte
          numberOfLines={3}
          style={completata ? styles.titoloCompletato : undefined}
        >
          {ripasso.titolo}
        </Testo>
        <View style={styles.etichette}>
          {isPermanente ? (
            <View
              style={styles.badgePermanente}
              accessibilityLabel="Memoria permanente"
            >
              <Icona nome="lucchetto" size={11} color={theme.colors.accentDark} />
              <Testo size={theme.font.meta} colore={theme.colors.accentDark} forte>
                Permanente
              </Testo>
            </View>
          ) : null}
          {allegati > 0 ? (
            <View style={styles.allegati}>
              <Icona nome="allegato" size={13} color={theme.colors.textMuted} />
              <Testo size={theme.font.meta} muto>
                {String(allegati)}
              </Testo>
            </View>
          ) : null}
          {inCoda ? (
            <Testo size={theme.font.meta} colore={theme.colors.accentInk} forte>
              ↑ da caricare
            </Testo>
          ) : null}
          {nonDisponibile ? (
            <Testo size={theme.font.meta} muto forte>
              ⬇ non offline
            </Testo>
          ) : null}
        </View>
      </View>

      <View style={styles.quando}>
        <Testo
          size={theme.font.small}
          forte
          colore={inRitardo ? theme.colors.accentInk : theme.ramp.neutral[800]}
        >
          {formatDataBreve(occorrenza.scheduled_at)}
        </Testo>
        <Testo size={theme.font.meta} muto>
          {formatOra(occorrenza.scheduled_at)}
        </Testo>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  riga: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  premuta: { opacity: 0.85 },
  tondino: {
    width: 26,
    height: 26,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  // Blue, as the ticked circle has always been: this is the one confirmation
  // the list gives twenty times a day, and it is the app's own voice.
  tondinoPieno: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  corpo: { flex: 1, gap: 2 },
  titoloCompletato: {
    color: theme.colors.completed,
    textDecorationLine: "line-through",
  },
  etichette: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, flexWrap: "wrap" },
  badgePermanente: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.sm,
  },
  allegati: { flexDirection: "row", alignItems: "center", gap: 3 },
  quando: { alignItems: "flex-end" },
});
