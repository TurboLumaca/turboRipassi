/**
 * View — Flashcard.
 *
 * Reached from the drawer, not from the bar: useful, but opened weekly rather
 * than daily, and in the bar it would have taken the place of something that is
 * opened every time.
 *
 * The three answers are three full-width buttons rather than a swipe or a pair.
 * "Non sono sicuro" is a real state, and folding it into "no" throws away the
 * only signal that separates a word being learned from one that never started.
 */
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import {
  Barra,
  Kicker,
  Pillola,
  Scheda,
  SchedaScura,
  TONI,
  Tendina,
  Testo,
  Titolo,
  Vuoto,
} from "@/view/components/organic";
import { usePercorso } from "@/controller/PercorsoContext";
import {
  ETICHETTE_RISPOSTA,
  LINGUE,
  RISPOSTE,
  daRivedere,
  giorniAlRitorno,
  mazzoDi,
  type Risposta,
} from "@/model/flashcard/flashcard";

/**
 * The colour of each answer. Best on the left, as they are read.
 *
 * The two tinted answers borrow the phase voices from `TONI` instead of naming
 * ramp steps again: a third copy of the same pairs is a third place to forget
 * when the palette moves.
 */
const ASPETTO: Record<Risposta, { sfondo: string; inchiostro: string; bordo: string }> = {
  so: { sfondo: TONI.salvia.tinta, inchiostro: TONI.salvia.inchiostro, bordo: "transparent" },
  incerto: {
    sfondo: TONI.accento.tinta,
    inchiostro: TONI.accento.inchiostro,
    bordo: "transparent",
  },
  "non-so": {
    sfondo: "transparent",
    inchiostro: theme.colors.text,
    bordo: theme.colors.borderStrong,
  },
};

export function FlashcardScreen() {
  const { lingua, scegliLingua } = usePercorso();
  const [inSessione, setInSessione] = useState(false);
  const [indice, setIndice] = useState(0);
  const [girata, setGirata] = useState(false);
  const [spiegazione, setSpiegazione] = useState(false);

  const mazzo = useMemo(() => mazzoDi(lingua), [lingua]);
  const carta = mazzo[indice];

  function rispondi(r: Risposta) {
    if (!carta) return;
    // The interval is computed but not persisted: the deck has no server yet,
    // so what a session teaches lasts as long as the session. The rule itself
    // is in the Model and already tested, which is the part worth keeping.
    void giorniAlRitorno(carta.livello, r);
    setGirata(false);
    if (indice + 1 >= mazzo.length) {
      setInSessione(false);
      setIndice(0);
      return;
    }
    setIndice(indice + 1);
  }

  if (inSessione && carta) {
    return (
      <ScrollView contentContainerStyle={styles.contenuto} showsVerticalScrollIndicator={false}>
        <View style={styles.avanzamento}>
          <View style={styles.barra}>
            <Barra percentuale={((indice + 1) / mazzo.length) * 100} />
          </View>
          <Testo size={theme.font.small} muto>
            {indice + 1} / {mazzo.length}
          </Testo>
        </View>

        <Pressable
          onPress={() => setGirata((g) => !g)}
          accessibilityRole="button"
          accessibilityLabel="Gira la carta"
        >
          <SchedaScura style={styles.carta}>
            <Kicker colore={theme.ramp.neutral[400]}>
              {girata ? `Italiano → ${lingua}` : `${lingua} → Italiano`}
            </Kicker>
            <Titolo size={38} colore={theme.colors.textOnInk} style={styles.parola}>
              {girata ? carta.retro : carta.fronte}
            </Titolo>
            <Testo size={theme.font.small} colore={theme.colors.textOnInk} style={styles.tenue}>
              {girata ? "Tocca per tornare" : "Tocca per girare"}
            </Testo>
          </SchedaScura>
        </Pressable>

        <View style={styles.risposte}>
          {RISPOSTE.map((r) => (
            <Pressable
              key={r}
              onPress={() => rispondi(r)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.risposta,
                {
                  backgroundColor: ASPETTO[r].sfondo,
                  borderColor: ASPETTO[r].bordo,
                  borderWidth: ASPETTO[r].bordo === "transparent" ? 0 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Testo size={14.5} forte colore={ASPETTO[r].inchiostro}>
                {ETICHETTE_RISPOSTA[r]}
              </Testo>
            </Pressable>
          ))}
        </View>

        <Pillola
          label="Chiudi la sessione"
          variante="fantasma"
          onPress={() => {
            setInSessione(false);
            setIndice(0);
            setGirata(false);
          }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.contenuto} showsVerticalScrollIndicator={false}>
      <Titolo size={24}>Vocaboli, ripetuti{"\n"}quando serve</Titolo>

      <Tendina
        titolo="Come funziona?"
        aperto={spiegazione}
        onPremi={() => setSpiegazione((v) => !v)}
      >
        <Testo>
          Per ogni vocabolo scegli La so, Non sono sicuro o Non la so: le parole che non hai ancora
          acquisito tornano più spesso, quelle che sai si allontanano.
        </Testo>
      </Tendina>

      <View style={styles.sezione}>
        <Kicker>Lingua</Kicker>
        {/* Pills, not the pair of arrows the old screen used: with twelve
            languages, stepping through them one at a time is not a choice. */}
        <View style={styles.lingue}>
          {LINGUE.map((l) => {
            const scelta = l === lingua;
            return (
              <Pressable
                key={l}
                onPress={() => scegliLingua(l)}
                accessibilityRole="button"
                accessibilityState={{ selected: scelta }}
                style={[styles.lingua, scelta && styles.linguaScelta]}
              >
                <Testo
                  size={theme.font.small}
                  forte
                  colore={scelta ? theme.colors.textOnInk : theme.colors.text}
                >
                  {l}
                </Testo>
              </Pressable>
            );
          })}
        </View>
      </View>

      {mazzo.length === 0 ? (
        <Vuoto>Non ci sono ancora vocaboli in {lingua}.</Vuoto>
      ) : (
        <>
          <Scheda style={styles.mazzo}>
            <View style={styles.mazzoTesti}>
              <Testo size={theme.font.body} forte>
                Mazzo attivo
              </Testo>
              <Testo size={theme.font.small} muto>
                {mazzo.length} vocaboli · {daRivedere(lingua)} da rivedere
              </Testo>
            </View>
            <Titolo size={26} colore={theme.colors.accentInk}>
              {daRivedere(lingua)}
            </Titolo>
          </Scheda>

          <Pillola label="Inizia la sessione" onPress={() => setInSessione(true)} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenuto: { gap: theme.spacing.md, padding: theme.spacing.lg },
  sezione: { gap: theme.spacing.sm },
  lingue: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  lingua: {
    height: 40,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  linguaScelta: {
    backgroundColor: theme.colors.inkSurface,
    borderColor: theme.colors.inkSurface,
  },
  mazzo: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  mazzoTesti: { flex: 1, gap: 2 },
  avanzamento: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  barra: { flex: 1 },
  carta: {
    height: 250,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
  },
  parola: { textAlign: "center" },
  tenue: { opacity: 0.6 },
  risposte: { gap: theme.spacing.sm },
  risposta: {
    // 48px: the minimum target the design spec sets for this screen, and the
    // three buttons are pressed dozens of times in a row.
    height: 48,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
