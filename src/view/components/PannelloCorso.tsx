/**
 * View — where the enrolment lives, inside the profile.
 *
 * The phase of the journey is derived from one date: the first day of the
 * course. On the finished product that date arrives from the server with the
 * enrolment, and there is no server for it yet — so it is entered here.
 *
 * That is not only a stand-in. The student knows their start date before the
 * app does, and letting them say it is what turns the guest state into the
 * pre-course state, which is the whole difference between an app that shows a
 * sales pitch and one that shows a battery.
 */
import React, { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Chip, Pillola, Segmentato, Testo } from "@/view/components/organic";
import { usePercorso } from "@/controller/PercorsoContext";
import { DURATA_CORSO, type Fase } from "@/model/percorso/fasi";

/** Accepts YYYY-MM-DD and nothing else, which is what the Model parses. */
const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

/** Local YYYY-MM-DD, `giorni` days from today (negative = in the past). What
 *  the anteprima buttons below write, since the Model parses local dates. */
function dataRelativa(giorni: number): string {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * One offset per phase, tuned so the preview lands mid-phase rather than on
 * its boundary: `durante` opens on giorno 7 di 21, `post` a few weeks into
 * mantenimento. `ospite` has no date — it is the absence of one.
 */
const OFFSET_ANTEPRIMA: Record<Exclude<Fase, "ospite">, number> = {
  pre: 5,
  durante: -6,
  post: -58,
};

const OPZIONI_ANTEPRIMA: { valore: Fase; label: string }[] = [
  { valore: "ospite", label: "Non iscritto" },
  { valore: "pre", label: "Prima" },
  { valore: "durante", label: "Durante" },
  { valore: "post", label: "Dopo" },
];

/** What each phase is called where the user can read it. */
const ETICHETTE: Record<string, string> = {
  ospite: "Non ancora iscritto",
  pre: "Prima del corso",
  durante: "Durante il corso",
  post: "Dopo il corso",
};

export function PannelloCorso() {
  const { fase, giorno, giorniAllInizio, iscrizione, impostaIscrizione } = usePercorso();
  const [inizio, setInizio] = useState(iscrizione.inizio ?? "");
  const [sede, setSede] = useState(iscrizione.sede ?? "");
  const [tutor, setTutor] = useState(iscrizione.tutor ?? "");

  function salva() {
    if (!FORMATO.test(inizio.trim())) {
      Alert.alert(
        "Data non valida",
        "Scrivi il primo giorno di corso come anno-mese-giorno, per esempio 2026-09-12."
      );
      return;
    }
    impostaIscrizione({
      inizio: inizio.trim(),
      sede: sede.trim() || undefined,
      tutor: tutor.trim() || undefined,
    });
  }

  /**
   * Clearing the enrolment puts the app back in guest mode. It is offered
   * because it is the only way to see what a prospective student sees, and it
   * destroys nothing: the ripassi belong to the account, not to the course.
   */
  function annulla() {
    setInizio("");
    impostaIscrizione({ inizio: null });
  }

  /**
   * Dev-only: jump straight to any of the four client states without typing a
   * date. Not a fifth state of its own — it writes the same `iscrizione` the
   * form above does, just computed instead of typed, so `fase` follows the
   * one rule the Model already has.
   */
  function anteprimaFase(fase: Fase) {
    if (fase === "ospite") {
      annulla();
      return;
    }
    const nuovoInizio = dataRelativa(OFFSET_ANTEPRIMA[fase]);
    setInizio(nuovoInizio);
    setSede(sede || "Rimini");
    setTutor(tutor || "Antonio Colucci");
    impostaIscrizione({
      inizio: nuovoInizio,
      sede: sede.trim() || "Rimini",
      tutor: tutor.trim() || "Antonio Colucci",
    });
  }

  return (
    <View style={styles.root}>
      <View style={styles.statoRiga}>
        <Chip
          label={ETICHETTE[fase] ?? fase}
          tono={fase === "pre" ? "accento" : fase === "durante" ? "salvia" : "neutro"}
        />
        <Testo size={theme.font.small} muto>
          {fase === "durante"
            ? `Giorno ${giorno} di ${DURATA_CORSO}`
            : fase === "pre"
            ? giorniAllInizio > 0
              ? `Fra ${giorniAllInizio} giorni`
              : "Si comincia domani"
            : fase === "post"
            ? "Corso completato"
            : "Solo i ripassi sono attivi"}
        </Testo>
      </View>

      <Campo
        etichetta="Primo giorno di corso"
        valore={inizio}
        onCambia={setInizio}
        placeholder="2026-09-12"
      />
      <Campo etichetta="Sede" valore={sede} onCambia={setSede} placeholder="Rimini" />
      <Campo
        etichetta="Tutor"
        valore={tutor}
        onCambia={setTutor}
        placeholder="Nome e cognome"
      />

      <View style={styles.azioni}>
        <Pillola label="Salva" onPress={salva} style={styles.meta} />
        <Pillola
          label="Non sono iscritto"
          variante="secondaria"
          onPress={annulla}
          style={styles.meta}
        />
      </View>

      {/* Solo per chi sviluppa: un modo rapido di vedere il client nei
          quattro stati, senza scrivere una data a mano. Non tocca nulla che
          il form sopra non tocchi già — sparisce da sola in una build di
          produzione, dove `__DEV__` è false. */}
      {__DEV__ ? (
        <View style={styles.anteprima}>
          <Testo size={theme.font.meta} muto>
            Anteprima stati · solo sviluppo
          </Testo>
          <Segmentato opzioni={OPZIONI_ANTEPRIMA} valore={fase} onCambia={anteprimaFase} />
        </View>
      ) : null}
    </View>
  );
}

function Campo({
  etichetta,
  valore,
  onCambia,
  placeholder,
}: {
  etichetta: string;
  valore: string;
  onCambia: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.campo}>
      <Testo size={theme.font.meta} muto>
        {etichetta}
      </Testo>
      <TextInput
        value={valore}
        onChangeText={onCambia}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={etichetta}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: theme.spacing.md },
  statoRiga: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  campo: { gap: 4 },
  input: {
    height: 44,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.background,
    fontFamily: theme.family.body,
    fontSize: theme.font.body,
    color: theme.colors.text,
  },
  azioni: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  meta: { flex: 1 },
  anteprima: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});
