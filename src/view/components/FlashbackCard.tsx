/**
 * View — Flashback / "Ricordi" Card (Apple Memories style).
 *
 * Spontaneous, friction-free rediscovery card validating long-term retention
 * and boosting self-efficacy without imposing mandatory tests.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Icona } from "@/view/theme/icone";
import { Kicker, Pillola, Scheda, Testo, Titolo } from "@/view/components/organic";
import {
  etichettaTraguardo,
  type FlashbackItem,
} from "@/model/ripassi/flashbackLogic";

export function FlashbackCard({
  flashback,
  onApri,
  onConferma,
  onDismiss,
  celebrato = false,
}: {
  flashback: FlashbackItem;
  onApri?: (voceId: string) => void;
  onConferma?: () => void;
  onDismiss?: () => void;
  celebrato?: boolean;
}) {
  const etichetta = etichettaTraguardo(
    flashback.traguardo,
    flashback.giorniTrascorsi
  );

  return (
    <Scheda style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badgeRiga}>
          <Icona nome="calendario" size={15} color={theme.colors.accentInk} />
          <Kicker colore={theme.colors.accentInk}>
            {`Ricordo · ${etichetta}`}
          </Kicker>
        </View>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Chiudi ricordo"
            style={styles.bottoneChiudi}
          >
            <Icona nome="chiudi" size={16} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <Titolo size={19} style={styles.titolo}>
        {flashback.titolo}
      </Titolo>

      <Testo size={theme.font.small} muto style={styles.anteprima}>
        {flashback.anteprima}
      </Testo>

      {celebrato ? (
        <View style={styles.celebratoContenitore}>
          <View style={styles.celebratoTestoRiga}>
            <Icona nome="fatto" size={16} color={theme.colors.sage} />
            <Testo size={theme.font.small} colore={theme.colors.sage} forte>
              {"La tua memoria a lungo termine è solida!"}
            </Testo>
          </View>
          {onDismiss ? (
            <Pillola
              label="Chiudi"
              variante="secondaria"
              onPress={onDismiss}
              style={styles.bottoneAzione}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.azioni}>
          {onConferma ? (
            <Pillola
              label="Ho ancora in mente!"
              variante="primaria"
              icona="fatto"
              onPress={onConferma}
              style={styles.bottoneAzione}
            />
          ) : null}
          {onApri ? (
            <Pillola
              label="Apri scheda"
              variante="secondaria"
              onPress={() => onApri(flashback.voceId)}
              style={styles.bottoneAzione}
            />
          ) : null}
        </View>
      )}
    </Scheda>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.ramp.accent[200],
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xs,
  },
  badgeRiga: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bottoneChiudi: {
    padding: theme.spacing.xs,
  },
  titolo: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
    color: theme.colors.text,
  },
  anteprima: {
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  azioni: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  bottoneAzione: {
    marginRight: theme.spacing.xs,
  },
  celebratoContenitore: {
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  celebratoTestoRiga: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
