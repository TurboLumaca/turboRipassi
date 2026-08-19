/**
 * View — Home.
 *
 * The old Home answered "who is your tutor": it opened on a stock photograph
 * and a face, and the first useful line sat below the fold. This one answers
 * "where are you and what do you do now", which is the question of every
 * opening after the first.
 *
 * It is the only screen that rewrites itself per phase, and deliberately so —
 * Allenati, TurboRipassi and Contenuti keep their structure across the whole
 * journey, so the student learns them once. Here the first card is the state of
 * the journey and everything below it follows from that.
 */
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { theme } from "@/view/theme/theme";
import { ICONA_ALLENAMENTO, Icona } from "@/view/theme/icone";
import {
  Batteria,
  Chip,
  Iniziali,
  Kicker,
  Pillola,
  RigaNavigabile,
  Scheda,
  SchedaScura,
  Testo,
  Titolo,
  type Tono,
} from "@/view/components/organic";
import { ALTEZZA_TAB_BAR } from "@/view/components/TabBar";
import { usePercorso } from "@/controller/PercorsoContext";
import { useRipassiCtx } from "@/controller/RipassiContext";
import { DURATA_CORSO } from "@/model/percorso/fasi";
import {
  SESSIONI_MANTENIMENTO,
  SOGLIA_PADRONANZA,
  allenamentoPerId,
  padronanzaDi,
} from "@/model/percorso/allenamenti";
import {
  ETICHETTE_APPUNTAMENTO,
  giornoEMese,
  prossimoAppuntamento,
} from "@/model/percorso/agenda";
import { primoDaVedere } from "@/model/contenuti/contenuti";
import { raggruppaPerScadenza } from "@/model/ripassi/ripassiLogic";
import { applicaSmoothingARipassi } from "@/model/ripassi/reschedulingLogic";
import type { Tab } from "@/view/components/TabBar";
import type { RootStackParamList } from "@/view/navigation";

type Navigazione = NativeStackNavigationProp<RootStackParamList, "Principale">;

/** What a guest is shown but cannot open. Real sections, named, not teased. */
const BLOCCATE = [
  { titolo: "Allenati — 18 allenamenti guidati", nota: "Lettura veloce, memoria, metodo" },
  { titolo: "Contenuti — lezioni e letture", nota: "Video delle giornate e materiali da leggere" },
  { titolo: "Flashcard — 12 lingue", nota: "Vocaboli a ripetizione dilazionata" },
];

export function HomeScreen({ onVaiA }: { onVaiA: (t: Tab) => void }) {
  const nav = useNavigation<Navigazione>();
  const { fase, giorno, giorniAllInizio, settimaneDalCorso, batteria, padronanze, iscrizione } =
    usePercorso();
  const { ripassi, pausa, riprendiPausa } = useRipassiCtx();

  /**
   * How many ripassi are actually due. Read from the real list with graceful
   * smoothing applied to overdue items.
   */
  const inScadenza = useMemo(() => {
    const smoothed = applicaSmoothingARipassi(ripassi);
    const gruppi = raggruppaPerScadenza(smoothed);
    return gruppi
      .filter((g) => g.gruppo === "ritardo" || g.gruppo === "oggi")
      .reduce((n, g) => n + g.voci.length, 0);
  }, [ripassi]);

  const ospite = fase === "ospite";
  const inPausa = !ospite && Boolean(pausa?.attiva);
  const appuntamento = useMemo(() => prossimoAppuntamento(), []);

  return (
    <ScrollView contentContainerStyle={styles.contenuto} showsVerticalScrollIndicator={false}>
      {inPausa ? (
        <Scheda style={styles.cardPausa}>
          <View style={styles.testataCard}>
            <Kicker colore={theme.ramp.sage[400]}>Modalità Riposo</Kicker>
          </View>
          <Titolo size={20}>I tuoi progressi sono al sicuro</Titolo>
          <Testo>
            Sei in modalità riposo. Le scadenze dei ripassi sono congelate e i tuoi progressi sono
            protetti.
          </Testo>
          <Pillola
            label="Riprendi prima del previsto"
            variante="secondaria"
            onPress={() => void riprendiPausa?.()}
            style={styles.bottonePausa}
          />
        </Scheda>
      ) : null}

      {ospite ? (
        <Ospite onVaiAiRipassi={() => onVaiA("ripassa")} />
      ) : fase === "pre" ? (
        <SchedaScura style={styles.card}>
          <View style={styles.testataCard}>
            <Kicker colore={theme.colors.accentBright}>Prima del corso</Kicker>
            <Testo size={theme.font.meta} colore={theme.colors.textOnInk} style={styles.tenue}>
              {giorniAllInizio > 0 ? `Inizio fra ${giorniAllInizio} giorni` : "Si comincia domani"}
            </Testo>
          </View>
          <Batteria percentuale={batteria} />
          <Testo colore={theme.colors.textOnInk} style={styles.corpoScuro}>
            La batteria si carica con la padronanza, non con le ore: porta Conversione fonetica e
            Schedario mentale a {SOGLIA_PADRONANZA} tacche prima del primo giorno.
          </Testo>
          <Pillola label="Continua ad allenarti" onPress={() => onVaiA("allenati")} />
        </SchedaScura>
      ) : fase === "durante" ? (
        <SchedaScura style={styles.card}>
          <View style={styles.testataCard}>
            <Kicker colore={theme.ramp.sage[300]}>Il tuo corso</Kicker>
            <Testo size={theme.font.meta} colore={theme.colors.textOnInk} style={styles.tenue}>
              {iscrizione.sede ? `Aula ${iscrizione.sede}` : "In aula"}
            </Testo>
          </View>
          <Titolo size={27} colore={theme.colors.textOnInk}>
            Giorno {giorno} di {DURATA_CORSO}
          </Titolo>
          {/* Twenty-one marks, as many filled as days done. The count is the
              information; a percentage would hide which day it is. */}
          <View style={styles.giorni}>
            {Array.from({ length: DURATA_CORSO }, (_, i) => (
              <View
                key={i}
                style={[styles.giorno, i < giorno ? styles.giornoFatto : styles.giornoDaFare]}
              />
            ))}
          </View>
          <Testo colore={theme.colors.textOnInk} style={styles.corpoScuro}>
            Gli allenamenti della giornata si sbloccano man mano che la lezione li introduce.
          </Testo>
        </SchedaScura>
      ) : (
        <SchedaScura style={styles.card}>
          <View style={styles.testataCard}>
            <Kicker colore={theme.ramp.neutral[400]}>Mantenimento</Kicker>
            <Testo size={theme.font.meta} colore={theme.colors.textOnInk} style={styles.tenue}>
              Settimana {settimaneDalCorso} dal corso
            </Testo>
          </View>
          <Titolo size={27} colore={theme.colors.textOnInk}>
            {SESSIONI_MANTENIMENTO} sessioni{"\n"}questa settimana
          </Titolo>
          <Testo colore={theme.colors.textOnInk} style={styles.corpoScuro}>
            Dieci minuti bastano per tenere il ritmo. Il piano si rinnova ogni lunedì.
          </Testo>
          <Pillola label="Apri il piano della settimana" onPress={() => onVaiA("allenati")} />
        </SchedaScura>
      )}

      {!ospite ? (
        <View style={styles.sezione}>
          <View style={styles.testataSezione}>
            <Kicker>Oggi</Kicker>
            <Pillola
              label="Vedi tutti"
              variante="fantasma"
              onPress={() => onVaiA("allenati")}
              style={styles.link}
            />
          </View>
          {vociDiOggi(fase, giorno, padronanze).map((v) => (
            <RigaNavigabile
              key={v.chiave}
              icona={v.icona}
              tono={v.tono}
              titolo={v.titolo}
              nota={v.nota}
              onPress={() => nav.navigate("Allenamento", { id: v.idAllenamento })}
            />
          ))}
          {!inPausa && inScadenza > 0 ? (
            <RigaNavigabile
              icona="ripassa"
              tono="salvia"
              titolo={inScadenza === 1 ? "1 ripasso in scadenza" : `${inScadenza} ripassi in scadenza`}
              nota="Focus di oggi"
              onPress={() => onVaiA("ripassa")}
            />
          ) : null}
          {fase !== "pre" && primoDaVedere("video") ? (
            <RigaNavigabile
              icona="video"
              tono="neutro"
              titolo={primoDaVedere("video")!.titolo}
              nota={primoDaVedere("video")!.meta}
              onPress={() => onVaiA("contenuti")}
            />
          ) : null}
        </View>
      ) : null}

      {!ospite && fase !== "post" && appuntamento ? (
        <View style={styles.sezione}>
          <Kicker>Prossimo appuntamento</Kicker>
          <Scheda
            onPress={() => nav.navigate("Appuntamenti")}
            accessibilityLabel={`Appuntamento: ${appuntamento.titolo}`}
            style={styles.appuntamento}
          >
            <View style={styles.dataBlocco}>
              <Titolo size={24}>{giornoEMese(appuntamento.giorno).giorno}</Titolo>
              <Testo size={theme.font.meta} muto>
                {giornoEMese(appuntamento.giorno).mese}
              </Testo>
            </View>
            <View style={styles.separatore} />
            <View style={styles.appuntamentoTesti}>
              <Testo size={theme.font.body} forte>
                {appuntamento.titolo}
              </Testo>
              <Testo size={theme.font.small} muto>
                {appuntamento.quando}
              </Testo>
              {/* "Da Definire" used to be printed as the content of the card.
                  It is a state, so it is drawn as one. */}
              <Chip label={ETICHETTE_APPUNTAMENTO[appuntamento.stato]} style={styles.chipStato} />
            </View>
          </Scheda>
        </View>
      ) : null}

      {!ospite ? (
        <View style={styles.sezione}>
          <Kicker>Il tuo tutor</Kicker>
          <Scheda style={styles.tutor}>
            <View style={styles.tutorRiga}>
              <Iniziali
                testo={iniziali(iscrizione.tutor ?? "Il tuo tutor")}
                sfondo={theme.colors.sage}
              />
              <View style={styles.tutorTesti}>
                <Titolo size={theme.font.title}>{iscrizione.tutor ?? "Tutor da assegnare"}</Titolo>
                <Testo size={theme.font.small} muto>
                  {iscrizione.sede ? `Tutor · sede di ${iscrizione.sede}` : "Tutor del tuo corso"}
                </Testo>
              </View>
            </View>
            {/* The "Chiamami" button is gone: the tutor keeps a face and a name,
                which is what it was really there for. */}
            <View style={styles.tutorAzioni}>
              <Pillola
                label="Incontra il tutor"
                variante="scura"
                onPress={() => nav.navigate("Appuntamenti")}
                style={styles.meta}
              />
              <Pillola
                label="Portale web"
                variante="secondaria"
                onPress={() => nav.navigate("Corsi")}
                style={styles.meta}
              />
            </View>
          </Scheda>
        </View>
      ) : null}
    </ScrollView>
  );
}

/** The lead-gen Home: the method, the free tool, and what the course adds. */
function Ospite({ onVaiAiRipassi }: { onVaiAiRipassi: () => void }) {
  return (
    <>
      {/* Authority before the sale: what this is and who runs it, not a form. */}
      <SchedaScura style={styles.card}>
        <Kicker colore={theme.colors.accentBright}>Metodo di studio</Kicker>
        <Titolo size={29} colore={theme.colors.textOnInk}>
          Impara a studiare{"\n"}in 21 giorni
        </Titolo>
        <Testo colore={theme.colors.textOnInk} style={styles.corpoScuro}>
          Lettura veloce, memoria, metodo. Dal 1997 con oltre 60.000 corsisti in Italia.
        </Testo>
        <View style={styles.tutorAzioni}>
          <Pillola label="Scopri il corso" onPress={onVaiAiRipassi} style={styles.meta} />
          <Pillola
            label="Parla con noi"
            variante="secondaria"
            suScuro
            onPress={onVaiAiRipassi}
            style={styles.meta}
          />
        </View>
      </SchedaScura>

      {/* Ripassa is completely usable without buying anything: it is the one
          function that makes sense on its own, and it demonstrates the method
          instead of describing it. */}
      <Scheda style={styles.card}>
        <Chip label="Libero, senza corso" tono="salvia" />
        <Titolo size={20}>Prova subito i ripassi</Titolo>
        <Testo>
          Scrivi un argomento: l&apos;app calcola quando ripassarlo perché resti in memoria. È il
          cuore del metodo, ed è tuo da adesso.
        </Testo>
        <Pillola label="Aggiungi il primo ripasso" onPress={onVaiAiRipassi} />
      </Scheda>

      <View style={styles.sezione}>
        <Kicker>Incluso nel corso</Kicker>
        {BLOCCATE.map((b) => (
          <View key={b.titolo} style={styles.bloccata}>
            <Icona nome="lucchetto" size={18} color={theme.colors.textMuted} />
            <View style={styles.bloccataTesti}>
              <Testo size={theme.font.small} forte colore={theme.ramp.neutral[800]}>
                {b.titolo}
              </Testo>
              <Testo size={theme.font.meta} muto>
                {b.nota}
              </Testo>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

/** Initials of a full name, for the avatar. */
function iniziali(nome: string): string {
  const parti = nome.trim().split(/\s+/);
  return (parti[0]?.[0] ?? "?").toUpperCase() + (parti[1]?.[0] ?? "").toUpperCase();
}

/**
 * The trainings the "Oggi" list offers, by phase.
 *
 * Before the course: the two that charge the battery, with how far they are.
 * During: the ones the lessons have already opened, newest first — that is the
 * one the student was told about this morning. After: the maintenance plan.
 */
function vociDiOggi(
  fase: string,
  giorno: number,
  padronanze: Readonly<Record<string, number>>
) {
  const richiesti = fase === "pre" ? ["fonetica", "schedario"] : [];
  const daLezione =
    fase === "durante"
      ? ["griglia", "date", "parole", "copri", "rombo", "puntini"].filter((id) => {
          const a = allenamentoPerId(id);
          return a?.giornoSblocco != null && a.giornoSblocco <= giorno;
        })
      : [];
  const mantenimento = fase === "post" ? ["parole", "schedario"] : [];

  const ids = [...richiesti, ...daLezione.slice(0, 2), ...mantenimento];

  return ids.flatMap((id) => {
    const a = allenamentoPerId(id);
    if (!a) return [];
    const p = padronanzaDi(padronanze, id);
    return [
      {
        chiave: id,
        idAllenamento: id,
        // The same icon this training carries in Allenati and in its detail:
        // recognising it here and there is the whole point of one table.
        icona: ICONA_ALLENAMENTO[id] ?? "allenati",
        tono: (a.fase === "pre" ? "accento" : "salvia") as Tono,
        titolo: a.nome,
        nota:
          fase === "pre"
            ? `${p}/${SOGLIA_PADRONANZA} tacche · ${a.famiglia}`
            : `${a.famiglia} · ${p}/${SOGLIA_PADRONANZA} tacche`,
      },
    ];
  });
}

const styles = StyleSheet.create({
  contenuto: { gap: theme.spacing.md, paddingBottom: ALTEZZA_TAB_BAR + theme.spacing.xxl },
  card: { gap: theme.spacing.sm },
  cardPausa: { gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceAlt },
  bottonePausa: { marginTop: theme.spacing.xs },
  testataCard: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  tenue: { opacity: 0.7 },
  corpoScuro: { opacity: 0.84 },
  giorni: { flexDirection: "row", gap: 4 },
  giorno: { flex: 1, height: 7, borderRadius: theme.radius.pill },
  giornoFatto: { backgroundColor: theme.colors.textOnInk },
  giornoDaFare: { backgroundColor: "rgba(255,255,255,0.28)" },
  sezione: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  testataSezione: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  link: { minHeight: 0, paddingHorizontal: 0 },
  appuntamento: { flexDirection: "row", gap: theme.spacing.md },
  dataBlocco: { width: 52, alignItems: "center" },
  separatore: { width: 1, backgroundColor: theme.colors.border },
  appuntamentoTesti: { flex: 1, gap: 2 },
  chipStato: { marginTop: theme.spacing.sm },
  tutor: { gap: theme.spacing.md },
  tutorRiga: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  tutorTesti: { flex: 1, gap: 1 },
  tutorAzioni: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  meta: { flex: 1 },
  bloccata: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.ramp.neutral[200],
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.borderStrong,
  },
  bloccataTesti: { flex: 1, gap: 1 },
});
