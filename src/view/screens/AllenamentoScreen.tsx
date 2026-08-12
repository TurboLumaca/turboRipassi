/**
 * View — one training, opened from Allenati or from the Home's "Oggi" list.
 *
 * A screen the old app did not have. Without it the list had nowhere to lead,
 * so mastery was a number with no explanation: this is where the threshold is
 * stated, where a tick is said to be worth ten per cent of the battery, and
 * where a session is recorded.
 */
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { theme } from "@/view/theme/theme";
import {
  Chip,
  Pillola,
  Scheda,
  SchedaScura,
  Tacche,
  Testo,
  Titolo,
  type Tono,
} from "@/view/components/organic";
import { usePercorso } from "@/controller/PercorsoContext";
import {
  SOGLIA_PADRONANZA,
  allenamentoPerId,
  padronanzaDi,
  statoAllenamento,
} from "@/model/percorso/allenamenti";
import { taccheMancanti, valoreDiUnaTacca } from "@/model/percorso/batteria";
import { batteriaVisibile } from "@/model/percorso/fasi";
import type { RootStackParamList } from "@/view/navigation";

type Navigazione = NativeStackNavigationProp<RootStackParamList, "Allenamento">;

export function AllenamentoScreen() {
  const nav = useNavigation<Navigazione>();
  const { params } = useRoute<RouteProp<RootStackParamList, "Allenamento">>();
  const { fase, giorno, padronanze, registraSessione } = usePercorso();

  const allenamento = allenamentoPerId(params.id);
  if (!allenamento) {
    // Reachable only from a stale deep link or a catalogue that changed under
    // a saved id. Saying so beats an empty screen.
    return (
      <View style={styles.assente}>
        <Testo muto>Questo allenamento non esiste più.</Testo>
        <Pillola label="Torna indietro" variante="secondaria" onPress={() => nav.goBack()} />
      </View>
    );
  }

  const padronanza = padronanzaDi(padronanze, allenamento.id);
  const stato = statoAllenamento(allenamento, giorno, padronanze);
  const bloccato = stato === "bloccato";
  const raggiunto = stato === "raggiunto";
  const tono: Tono = allenamento.fase === "pre" ? "accento" : fase === "post" ? "neutro" : "salvia";
  const chip =
    fase === "post"
      ? "Mantenimento"
      : allenamento.fase === "pre"
      ? "Prima del corso"
      : `Giorno ${allenamento.giornoSblocco}`;

  return (
    <ScrollView contentContainerStyle={styles.contenuto} showsVerticalScrollIndicator={false}>
      <SchedaScura style={styles.hero}>
        <Chip label={chip} tono={tono} />
        <Titolo size={27} colore={theme.colors.textOnInk}>
          {allenamento.nome}
        </Titolo>
        <Testo colore={theme.colors.textOnInk} style={styles.tenue}>
          {allenamento.descrizione}
        </Testo>
      </SchedaScura>

      <Scheda style={styles.blocco}>
        <View style={styles.testata}>
          <Testo size={theme.font.body} forte>
            Padronanza
          </Testo>
          <Testo size={theme.font.small} muto>
            {padronanza} tacche su {SOGLIA_PADRONANZA}
          </Testo>
        </View>
        <Tacche raggiunte={padronanza} totale={SOGLIA_PADRONANZA} tono={tono} grandi />
        <Testo size={theme.font.small} muto>
          {nota({
            bloccato,
            raggiunto,
            padronanza,
            // The battery sentence is only true where the battery exists and
            // where this training is one of the two that charge it.
            caricaLaBatteria: allenamento.fase === "pre" && batteriaVisibile(fase),
            mancantiInTutto: taccheMancanti(padronanze),
            giornoSblocco: allenamento.giornoSblocco,
          })}
        </Testo>
      </Scheda>

      <View style={styles.riquadri}>
        <Scheda style={styles.riquadro}>
          <Titolo size={22}>{SOGLIA_PADRONANZA - padronanza}</Titolo>
          <Testo size={theme.font.meta} muto>
            Tacche che mancano
          </Testo>
        </Scheda>
        <Scheda style={styles.riquadro}>
          <Titolo size={22}>{allenamento.famiglia.split(" ")[0]}</Titolo>
          <Testo size={theme.font.meta} muto>
            {allenamento.famiglia}
          </Testo>
        </Scheda>
      </View>

      {/* One button, and it means one thing: a session that improved something.
          A tick is mastery reached, not time spent — training a lot without
          getting better must not move the battery. */}
      <Pillola
        label={raggiunto ? "Soglia raggiunta" : bloccato ? `Si sblocca al Giorno ${allenamento.giornoSblocco}` : "Registra una sessione riuscita"}
        disabled={raggiunto || bloccato}
        onPress={() => registraSessione(allenamento.id)}
      />
    </ScrollView>
  );
}

/** The sentence under the pips: what the state actually means here. */
function nota({
  bloccato,
  raggiunto,
  padronanza,
  caricaLaBatteria,
  mancantiInTutto,
  giornoSblocco,
}: {
  bloccato: boolean;
  raggiunto: boolean;
  padronanza: number;
  caricaLaBatteria: boolean;
  mancantiInTutto: number;
  giornoSblocco?: number;
}): string {
  if (bloccato) {
    return `Questo allenamento si apre al Giorno ${giornoSblocco}, quando la lezione lo introduce.`;
  }
  if (raggiunto) {
    return "Soglia raggiunta. Continua con sessioni brevi e regolari per mantenerla.";
  }
  if (caricaLaBatteria) {
    const mancanti = SOGLIA_PADRONANZA - padronanza;
    return `Ogni tacca vale il ${valoreDiUnaTacca()}% di batteria. Ti mancano ${mancanti} tacche qui, ${mancantiInTutto} in tutto per essere pronto.`;
  }
  return "La padronanza si mantiene con sessioni brevi e regolari.";
}

const styles = StyleSheet.create({
  contenuto: { gap: theme.spacing.md, padding: theme.spacing.lg },
  assente: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing.lg },
  hero: { gap: theme.spacing.sm },
  tenue: { opacity: 0.85 },
  blocco: { gap: theme.spacing.md },
  testata: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  riquadri: { flexDirection: "row", gap: theme.spacing.sm },
  riquadro: { flex: 1, gap: 3 },
});
