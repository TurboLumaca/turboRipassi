/**
 * View — the four screens the drawer opens under "Il tuo percorso".
 *
 * They live in one file because they are one idea drawn four times: a list of
 * cards on the app's light ground, the same header, the same spacing step.
 * Splitting them into four files of forty lines would suggest they can drift
 * apart, and the whole point of the redesign is that they cannot.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { theme } from "@/view/theme/theme";
import {
  Barra,
  Chip,
  Kicker,
  Pillola,
  Scheda,
  SchedaScura,
  Testo,
  Titolo,
  Vuoto,
} from "@/view/components/organic";
import { usePercorso } from "@/controller/PercorsoContext";
import {
  APPUNTAMENTI,
  CORSI,
  ETICHETTE_APPUNTAMENTO,
  OBIETTIVI,
  PROGRAMMI,
  appuntamentiFuturi,
  giornoEMese,
  percentualeObiettivo,
} from "@/model/percorso/agenda";

// ── Programma di studio ──────────────────────────────────────────────────

/**
 * The one screen of the old app on a dark ground, which made it look like a
 * different product. Back on the light ground, with the options as selectable
 * cards carrying a title, a duration and a line of description — the radio
 * buttons on the right of a bare row gave none of that.
 */
export function ProgrammaScreen() {
  const nav = useNavigation();
  const { programma, scegliProgramma } = usePercorso();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.contenuto} showsVerticalScrollIndicator={false}>
        <Testo muto>
          Scegli il programma su cui vuoi lavorare. Puoi cambiarlo in qualsiasi momento.
        </Testo>

        {PROGRAMMI.map((p) => {
          const scelto = p.id === programma;
          return (
            <Pressable
              key={p.id}
              onPress={() => scegliProgramma(p.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: scelto }}
              style={[styles.programma, scelto && styles.programmaScelto]}
            >
              <View style={[styles.pallino, scelto && styles.pallinoScelto]} />
              <View style={styles.programmaTesti}>
                <Testo size={15.5} forte>
                  {p.titolo}
                </Testo>
                <Testo size={theme.font.small} muto>
                  {p.descrizione}
                </Testo>
                <Testo size={theme.font.meta} muto style={styles.metaProgramma}>
                  {p.meta}
                </Testo>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Fixed at the bottom and disabled until something is chosen: the old
          Continua sat at the end of the scroll and was always tappable. */}
      <View style={styles.piede}>
        {/* La scelta è già stata salvata al tocco sulla card: Continua conferma
            e riporta indietro, invece di essere un secondo modo di scegliere. */}
        <Pillola label="Continua" disabled={programma === null} onPress={() => nav.goBack()} />
      </View>
    </View>
  );
}

// ── Appuntamenti ─────────────────────────────────────────────────────────

export function AppuntamentiScreen() {
  const futuri = appuntamentiFuturi();
  const elenco = futuri.length > 0 ? futuri : APPUNTAMENTI;

  return (
    <ScrollView contentContainerStyle={styles.contenuto} showsVerticalScrollIndicator={false}>
      {elenco.length === 0 ? (
        <Vuoto>Non ci sono appuntamenti in programma.</Vuoto>
      ) : (
        elenco.map((a) => {
          const { giorno, mese } = giornoEMese(a.giorno);
          return (
            <Scheda key={a.id} style={styles.appuntamento}>
              <View style={styles.dataBlocco}>
                <Titolo size={23}>{giorno}</Titolo>
                <Testo size={theme.font.meta} muto>
                  {mese}
                </Testo>
              </View>
              <View style={styles.separatore} />
              <View style={styles.appuntamentoTesti}>
                <Testo size={theme.font.body} forte>
                  {a.titolo}
                </Testo>
                <Testo size={theme.font.small} muto>
                  {a.quando}
                </Testo>
                <Chip
                  label={ETICHETTE_APPUNTAMENTO[a.stato]}
                  tono={a.stato === "confermato" ? "salvia" : "neutro"}
                  style={styles.chip}
                />
              </View>
            </Scheda>
          );
        })
      )}
    </ScrollView>
  );
}

// ── Corsi ────────────────────────────────────────────────────────────────

export function CorsiScreen() {
  return (
    <ScrollView contentContainerStyle={styles.contenuto} showsVerticalScrollIndicator={false}>
      {CORSI.map((c) =>
        c.stato === "in-corso" ? (
          <SchedaScura key={c.id} style={styles.corso}>
            <Kicker colore={theme.colors.accentBright}>In corso</Kicker>
            <Titolo size={21} colore={theme.colors.textOnInk}>
              {c.titolo}
            </Titolo>
            <Testo colore={theme.colors.textOnInk} style={styles.tenue}>
              {c.descrizione}
            </Testo>
            <Testo size={theme.font.meta} colore={theme.colors.textOnInk} style={styles.tenue}>
              {c.meta}
            </Testo>
          </SchedaScura>
        ) : (
          <Scheda key={c.id} style={styles.corso}>
            <Kicker colore={theme.colors.accentInk}>Disponibile</Kicker>
            <Titolo size={21}>{c.titolo}</Titolo>
            <Testo muto>{c.descrizione}</Testo>
            <Testo size={theme.font.meta} muto>
              {c.meta}
            </Testo>
          </Scheda>
        )
      )}
    </ScrollView>
  );
}

// ── Obiettivi ────────────────────────────────────────────────────────────

/**
 * Personal targets, and nothing else. The Classifica was removed as a project
 * constraint — a competition between students does not serve the method and
 * penalises exactly the ones who are furthest behind — and this is the screen
 * where its points and positions would otherwise have collected.
 */
export function ObiettiviScreen() {
  return (
    <ScrollView contentContainerStyle={styles.contenuto} showsVerticalScrollIndicator={false}>
      <Testo muto>Traguardi tuoi, non confronti con altri corsisti.</Testo>
      {OBIETTIVI.map((o, i) => (
        <Scheda key={o.id} style={styles.obiettivo}>
          <View style={styles.obiettivoTestata}>
            <View style={styles.obiettivoTitolo}>
              <Testo size={theme.font.body} forte>
                {o.titolo}
              </Testo>
            </View>
            <Testo size={theme.font.small} muto>
              {o.fatti} / {o.totale}
            </Testo>
          </View>
          <Barra
            percentuale={percentualeObiettivo(o)}
            colore={
              [theme.colors.accent, theme.colors.sage, theme.ramp.neutral[700]][i % 3]
            }
          />
          <Testo size={theme.font.meta} muto>
            {o.nota}
          </Testo>
        </Scheda>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  contenuto: { gap: theme.spacing.md, padding: theme.spacing.lg },
  programma: {
    flexDirection: "row",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: "transparent",
  },
  programmaScelto: {
    backgroundColor: theme.ramp.accent[100],
    borderColor: theme.colors.accent,
  },
  pallino: {
    width: 22,
    height: 22,
    marginTop: 2,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.borderStrong,
  },
  pallinoScelto: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
    // The inner ring keeps the dot readable against the tinted card.
    borderWidth: 4,
  },
  programmaTesti: { flex: 1, gap: 4 },
  metaProgramma: { marginTop: 3 },
  piede: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  appuntamento: { flexDirection: "row", gap: theme.spacing.md },
  dataBlocco: { width: 52, alignItems: "center" },
  separatore: { width: 1, backgroundColor: theme.colors.border },
  appuntamentoTesti: { flex: 1, gap: 2 },
  chip: { marginTop: theme.spacing.sm },
  corso: { gap: theme.spacing.sm, borderRadius: theme.radius.xl },
  tenue: { opacity: 0.82 },
  obiettivo: { gap: theme.spacing.sm },
  obiettivoTestata: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: theme.spacing.sm,
  },
  obiettivoTitolo: { flex: 1 },
});
