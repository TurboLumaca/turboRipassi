/**
 * View — la Cerimonia di Promozione: l'unico schermo intero dell'app.
 *
 * Al centro non c'è un numero che sale né un badge: c'è la *storia di
 * spacing*, le date dei quattro richiami distribuite su una linea del tempo.
 * È la scelta che fa la differenza fra una celebrazione e un micro-
 * insegnamento: il protagonista della schermata è il meccanismo scientifico —
 * la distribuzione nel tempo — e chi la guarda impara ogni volta qualcosa
 * sul perché lo spacing funziona, invece di ricevere l'ennesima coccarda.
 *
 * Il premio è certo nella consegna e vario solo nella forma: la frase cambia
 * fra un concetto e l'altro, ma nessuno sta giocando a ottenerne una
 * migliore. Non c'è varianza da rigiocare, e infatti non si può riaprire:
 * `ceremony_shown_at` la chiude per sempre.
 *
 * Il juice: questo è il livello `cerimonia` di `theme/juice.ts`, e nient'altro
 * nell'app può arrivarci. Senza suono e senza haptics — non perché sarebbero
 * sbagliati (un suono dedicato sarebbe il posto giusto per averne uno) ma
 * perché richiederebbero un modulo nativo in più, e questo progetto ha appena
 * pagato il prezzo di un crash da moduli nativi disallineati. Il gradino è
 * dato dalla scala, dalla durata e dallo schermo intero, che sono tre canali
 * indipendenti e bastano a renderlo il momento più grande che c'è.
 */
import React, { useEffect, useState } from "react";
import { Animated, Modal, StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { JUICE } from "@/view/theme/juice";
import { Icona } from "@/view/theme/icone";
import { Kicker, Pillola, Testo, Titolo } from "@/view/components/organic";
import { formatDataBreve } from "@/view/lib/format";
import type { CerimoniaDaMostrare } from "@/controller/ripassi/useCerimoniaPromozione";

/** Quanti giorni separano il primo richiamo dall'ultimo: la cifra grande. */
function giorniAttraversati(storia: string[]): number {
  if (storia.length < 2) return 0;
  const da = new Date(storia[0]).getTime();
  const a = new Date(storia[storia.length - 1]).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(a)) return 0;
  return Math.max(0, Math.round((a - da) / 86_400_000));
}

export function CerimoniaPromozione({
  cerimonia,
  onChiudi,
}: {
  cerimonia: CerimoniaDaMostrare | null;
  onChiudi: () => void;
}) {
  // `useState` con inizializzatore pigro e non `useRef().current`: il valore
  // va creato una volta sola, ma leggerlo durante il render da un ref e' la
  // cosa che il compilatore non puo' garantire corretta.
  const [entrata] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!cerimonia) return;
    entrata.setValue(0);
    Animated.timing(entrata, {
      toValue: 1,
      duration: JUICE.cerimonia.durata,
      useNativeDriver: true,
    }).start();
  }, [cerimonia, entrata]);

  if (!cerimonia) return null;

  const { ripasso, storia, promossoIl, frase } = cerimonia;
  const giorni = giorniAttraversati(storia);

  const scala = entrata.interpolate({
    inputRange: [0, 1],
    outputRange: [JUICE.cerimonia.scala, 1],
  });

  return (
    <Modal visible animationType="fade" onRequestClose={onChiudi}>
      <View style={styles.schermo}>
        <Animated.View style={[styles.corpo, { opacity: entrata, transform: [{ scale: scala }] }]}>
          <View style={styles.sigillo}>
            <Icona nome="lucchetto" size={26} color={theme.colors.textOnInk} />
          </View>

          <Kicker colore={theme.colors.accentBright}>Memoria permanente</Kicker>
          <Titolo size={30} colore={theme.colors.textOnInk} style={styles.titolo}>
            {ripasso.titolo}
          </Titolo>

          {/* Il numero grande è i giorni attraversati, non i richiami fatti:
              la cosa rara qui è il tempo, e i richiami sono come lo si è
              attraversato. */}
          <Testo size={64} colore={theme.colors.textOnInk} style={styles.numerone}>
            {String(giorni)}
          </Testo>
          <Testo size={theme.font.small} colore={theme.colors.accentBright}>
            {"giorni fra il primo richiamo e l'ultimo"}
          </Testo>

          {/* La storia di spacing: la protagonista della schermata. */}
          <View style={styles.linea} accessibilityLabel="Storia dei richiami">
            {storia.map((iso, i) => (
              <View key={iso + String(i)} style={styles.tappa}>
                <View style={styles.pallino} />
                <Testo size={theme.font.meta} colore={theme.colors.textOnInk}>
                  {formatDataBreve(iso)}
                </Testo>
              </View>
            ))}
          </View>

          <Testo size={theme.font.body} colore={theme.colors.textOnInk} style={styles.frase}>
            {frase}
          </Testo>
          <Testo size={theme.font.meta} colore={theme.colors.accentBright}>
            {`Quattro richiami distribuiti nel tempo — è la distribuzione, non il numero, ad averlo reso permanente. Promosso il ${formatDataBreve(promossoIl)}.`}
          </Testo>

          <Pillola label="Continua" suScuro onPress={onChiudi} style={styles.bottone} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  schermo: {
    flex: 1,
    backgroundColor: theme.colors.inkSurface,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  corpo: { alignItems: "center", gap: theme.spacing.sm, maxWidth: 420 },
  sigillo: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.accentBright,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  titolo: { textAlign: "center" },
  numerone: {
    fontFamily: theme.family.heading,
    lineHeight: 70,
    marginTop: theme.spacing.md,
  },
  linea: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: theme.spacing.lg,
    marginVertical: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.accentBright,
  },
  tappa: { alignItems: "center", gap: 5 },
  pallino: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentBright,
  },
  frase: {
    fontFamily: theme.family.eyebrow,
    textAlign: "center",
    marginTop: theme.spacing.sm,
  },
  bottone: { marginTop: theme.spacing.xl, minWidth: 200 },
});
