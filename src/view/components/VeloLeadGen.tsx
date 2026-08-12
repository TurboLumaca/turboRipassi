/**
 * View — what a person who has not bought the course sees on the sections that
 * come with it.
 *
 * Not a paywall and not a modal. The real content stays on screen, faded, with
 * one card over it saying what it is and offering exactly two things: find out
 * about the course, or go and use the ripassi — which are free, complete, and
 * the one part of the method that works on its own.
 *
 * One conversion per screen, always the same pair. The old app had three
 * equally-weighted buttons on the Home and nothing anywhere else.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Icona } from "@/view/theme/icone";
import { Kicker, Pillola, SchedaScura, Testo, Titolo } from "@/view/components/organic";
import { ALTEZZA_TAB_BAR } from "@/view/components/TabBar";

/** The copy of the veil, per section. */
export const TESTI_VELO: Record<string, { titolo: string; corpo: string }> = {
  allenati: {
    titolo: "Gli allenamenti si attivano con il corso",
    corpo:
      "Diciotto allenamenti guidati fra lettura veloce, memoria e metodo, sbloccati passo dopo passo.",
  },
  contenuti: {
    titolo: "Video e letture sono per i corsisti",
    corpo:
      "Ogni giornata del corso resta disponibile fra lezioni registrate e materiali da leggere.",
  },
  flashcard: {
    titolo: "Le flashcard arrivano con il corso",
    corpo: "Vocaboli ripetuti negli intervalli giusti, in dodici lingue.",
  },
};

const PREDEFINITO = {
  titolo: "Questa sezione è per i corsisti",
  corpo: "Intanto puoi usare i ripassi: sono liberi e completi.",
};

/**
 * Wraps a section and dims it.
 *
 * The dimming is opacity rather than a real blur: a gaussian blur on native
 * needs `expo-blur`, and a whole native dependency to soften a preview is more
 * than the effect is worth. What matters is that the content is legible enough
 * to want and not legible enough to use, and opacity does that.
 */
export function VeloLeadGen({
  sezione,
  attivo,
  onScopriIlCorso,
  onUsaRipassi,
  children,
}: {
  sezione: string;
  attivo: boolean;
  onScopriIlCorso: () => void;
  onUsaRipassi: () => void;
  children: React.ReactNode;
}) {
  if (!attivo) return <>{children}</>;
  const testo = TESTI_VELO[sezione] ?? PREDEFINITO;

  return (
    <View style={styles.root}>
      <View style={styles.contenuto} pointerEvents="none">
        {children}
      </View>

      <SchedaScura style={styles.cartello}>
        <View style={styles.intestazione}>
          <Icona nome="lucchetto" size={18} color={theme.colors.accentBright} />
          <Kicker colore={theme.colors.accentBright}>Incluso nel corso</Kicker>
        </View>
        <Titolo size={19} colore={theme.colors.textOnInk}>
          {testo.titolo}
        </Titolo>
        <Testo colore={theme.colors.textOnInk} style={styles.corpo}>
          {testo.corpo}
        </Testo>
        <View style={styles.azioni}>
          <Pillola label="Scopri il corso" onPress={onScopriIlCorso} style={styles.primaria} />
          <Pillola
            label="Usa i ripassi"
            variante="secondaria"
            suScuro
            onPress={onUsaRipassi}
          />
        </View>
      </SchedaScura>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  contenuto: { flex: 1, opacity: 0.35 },
  cartello: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: ALTEZZA_TAB_BAR + theme.spacing.xl,
    gap: theme.spacing.sm,
    shadowColor: theme.colors.inkSurface,
    shadowOpacity: 0.3,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  intestazione: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  corpo: { opacity: 0.8 },
  azioni: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  primaria: { flex: 1 },
});
