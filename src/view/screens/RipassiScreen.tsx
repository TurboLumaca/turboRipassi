/**
 * View — TurboRipassi.
 *
 * The most useful screen of the app used to be the poorest: a flat list of
 * titles with a date and an hour, no grouping, an explanation panel wedged open
 * above it and an "add" circle sitting in the middle of the page that scrolled
 * away with the content.
 *
 * Two things changed and nothing else did. The deadline became the structure
 * of the list (In ritardo / Oggi / Questa settimana / Più avanti), because a
 * ripasso is only worth anything on the right day. "Come funziona?" collapsed.
 *
 * "Aggiungi ripasso" stays where it has always been — at the top, above the
 * list, scrolling with it. It is the first thing on the screen because it is
 * the first thing a new user has to do, and moving it to a floating pill would
 * have made the app's main action something you find rather than something you
 * are handed.
 *
 * Everything underneath — Supabase, the offline queue, the cache, the retries —
 * is the same code it was.
 */
import React, { useMemo, useState, useDeferredValue } from "react";
import { useMicroSessione } from "@/controller/ripassi/useMicroSessione";
import { MicroSessioneModal } from "@/view/components/MicroSessioneModal";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { theme } from "@/view/theme/theme";
import {
  CampoRicerca,
  Kicker,
  Pillola,
  Segmentato,
  Tendina,
  Testo,
  Vuoto,
  Scheda,
  Titolo,
} from "@/view/components/organic";
import { Casella } from "@/view/components/ui";
import { RigaVoce } from "@/view/components/vociRipasso";
import {
  AvvisoDaCaricare,
  AvvisoNonDisponibili,
} from "@/view/components/AvvisiSincronizzazione";
import { useRipassiCtx } from "@/controller/RipassiContext";
import { useConnettivita } from "@/controller/useConnettivita";
import { mostraErrore } from "@/controller/avvisoErrore";
import { quandoSalvato } from "@/view/lib/format";
import {
  corrispondeRicerca,
  raggruppaPerScadenza,
  soloDaCompletare,
  suddividiVoci,
  type GruppoRipassi,
  type VoceRipasso,
} from "@/model/ripassi/ripassiLogic";
import { applicaSmoothingARipassi } from "@/model/ripassi/reschedulingLogic";
import type { RootStackParamList } from "@/view/navigation";

type Navigazione = NativeStackNavigationProp<RootStackParamList, "Ripassi">;

/**
 * Which of the two lists is on screen. Not `Scheda`: that name belongs to the
 * card component this screen draws with, and having both meant the type and
 * the component shadowed each other.
 */
type SchedaLista = "ripassi" | "storico";

/**
 * A block of search results: the four deadline buckets plus the one the tabs
 * would otherwise keep out of reach.
 */
type GruppoRisultati =
  | GruppoRipassi
  | { gruppo: "storico"; etichetta: string; voci: VoceRipasso[] };

/** Why the app is worth the trouble — the first thing a new user reads. */
const COME_FUNZIONA =
  "Quante ore hai già investito per imparare cose che poi hai dimenticato? " +
  "TurboRipassi riporta a galla ciò che studi nei momenti in cui stai per " +
  "perderlo: dopo un'ora, un giorno, una settimana, un mese e sei mesi. " +
  "Non devi ricordarti di ripassare né tenere il conto: ogni ripasso si " +
  "programma da solo e ti aspetta in lista, con la sua data e la sua ora. " +
  "Segni quello che hai fatto con un tocco sul tondino, e quelli dei giorni " +
  "passati si spostano nello storico, dove puoi ritrovare in un attimo ciò " +
  "che avevi saltato. Alle note puoi allegare foto, PDF e appunti, " +
  "disponibili anche senza connessione. Il risultato è che le nozioni che ti " +
  "interessano restano tue, invece di svanire poco dopo l'esame.";

export function RipassiScreen() {
  const nav = useNavigation<Navigazione>();
  const {
    ripassi,
    loading,
    salvatoIl,
    ritentando,
    error,
    reload,
    cache,
    coda,
    daCaricare,
    idsInCoda,
    completaOccorrenza,
  } = useRipassiCtx();
  const { online } = useConnettivita();
  const [query, setQuery] = useState("");
  const [scheda, setScheda] = useState<SchedaLista>("ripassi");
  const [comeFunziona, setComeFunziona] = useState(false);
  // Storico filter. Kept out of the tab state so switching back and forth does
  // not silently reset what the user asked to see.
  const [soloDaFare, setSoloDaFare] = useState(false);
  const [mostraTuttiArretrati, setMostraTuttiArretrati] = useState(false);
  // Pull-to-refresh spinner. Presentation state, so it lives here: the
  // Controller's `loading` means "the list has never arrived", which is a
  // different question and stops being true after the first load.
  const [aggiornando, setAggiornando] = useState(false);
  const microSessione = useMicroSessione();

  async function aggiorna() {
    setAggiornando(true);
    try {
      await reload();
    } finally {
      setAggiornando(false);
    }
  }

  /**
   * The circle. The write is optimistic in appearance only: the Controller
   * reloads the list when it lands, so a failure leaves the circle as it was
   * and says why.
   */
  async function completa(v: VoceRipasso) {
    // The occurrence exists only on this device: there is no row to tick off,
    // and letting the write go would fail with a foreign key error the user
    // could make nothing of. Refusing with a reason is the honest version, and
    // the wait is short — the queue drains on its own.
    if (idsInCoda.has(v.ripasso.id)) {
      Alert.alert(
        "Ripasso non ancora caricato",
        "Questo ripasso è ancora solo su questo dispositivo. Potrai segnarlo come fatto appena sarà stato caricato."
      );
      return;
    }
    try {
      await completaOccorrenza(v.occorrenza.id, !v.occorrenza.is_completed);
    } catch (e) {
      mostraErrore(e, "completaOccorrenza", { occorrenzaId: v.occorrenza.id });
    }
  }

  /** Ripassi of the window the user cannot open without a connection. */
  const idsNonDisponibili = useMemo(
    () => new Set(cache.nonDisponibili.map((v) => v.id)),
    [cache.nonDisponibili]
  );

  const deferredQuery = useDeferredValue(query);

  const ripassiSmoothed = useMemo(
    () => (mostraTuttiArretrati ? ripassi : applicaSmoothingARipassi(ripassi)),
    [ripassi, mostraTuttiArretrati]
  );

  const listaDaMostrare = useMemo(
    () => ripassiSmoothed.filter((r) => corrispondeRicerca(r, deferredQuery)),
    [ripassiSmoothed, deferredQuery]
  );

  // We still need a purely filtered list (unsmoothed) for the history tab
  const filtratiNonSmoothed = useMemo(
    () => ripassi.filter((r) => corrispondeRicerca(r, deferredQuery)),
    [ripassi, deferredQuery]
  );

  const haArretratiSpalmati = useMemo(() => {
    const tutte = filtratiNonSmoothed.flatMap((r) => r.occorrenze);
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const arretrate = tutte.filter(
      (o) => !o.is_completed && new Date(o.scheduled_at).getTime() < oggi.getTime()
    );
    return arretrate.length > 10;
  }, [filtratiNonSmoothed]);

  // Grouping and ordering live in the Model (ripassiLogic), tested there.
  const gruppi = useMemo(() => raggruppaPerScadenza(listaDaMostrare), [listaDaMostrare]);

  const ricercaAttiva = deferredQuery.trim() !== "";

  /**
   * What the search field answers with.
   *
   * Searching used to be a filter applied to whichever of the two tabs was on
   * screen, which made it a poor way to find anything: a ripasso due next month
   * was invisible from the Storico tab, and one already done was invisible from
   * the other. A query is a question about the whole archive, so while one is
   * typed the tabs step aside and every match is listed — in ritardo, oggi,
   * questa settimana, più avanti, and finally what is already in the storico.
   *
   * Built from the unsmoothed list on purpose: the "zero ansia" spreading of
   * overdue items is there to calm the daily list, and it must not move a row
   * out from under someone who is looking for it by name.
   */
  const risultatiRicerca = useMemo((): GruppoRisultati[] => {
    if (!ricercaAttiva) return [];
    const perScadenza: GruppoRisultati[] = raggruppaPerScadenza(filtratiNonSmoothed);
    const { storico: passati } = suddividiVoci(filtratiNonSmoothed);
    return passati.length > 0
      ? [...perScadenza, { gruppo: "storico", etichetta: "Nello storico", voci: passati }]
      : perScadenza;
  }, [ricercaAttiva, filtratiNonSmoothed]);

  const totaleRisultati = useMemo(
    () => risultatiRicerca.reduce((n, g) => n + g.voci.length, 0),
    [risultatiRicerca]
  );
  /**
   * How many concepts the quick session would pick up. Counted on the whole
   * list, not on the filtered one: `avvia` selects from every ripasso, so a
   * count that shrank while a query was being typed would promise a session
   * different from the one that starts.
   */
  const inScadenza = useMemo(() => {
    return raggruppaPerScadenza(ripassiSmoothed)
      .filter((g) => g.gruppo === "ritardo" || g.gruppo === "oggi")
      .reduce((n, g) => n + g.voci.length, 0);
  }, [ripassiSmoothed]);
  const storico = useMemo(() => {
    const { storico: passati } = suddividiVoci(filtratiNonSmoothed);
    return soloDaFare ? soloDaCompletare(passati) : passati;
  }, [filtratiNonSmoothed, soloDaFare]);

  const proprieta = (v: VoceRipasso, inRitardo: boolean) => ({
    voce: v,
    inCoda: idsInCoda.has(v.ripasso.id),
    nonDisponibile: idsNonDisponibili.has(v.ripasso.id),
    inRitardo,
    onApri: (x: VoceRipasso) => nav.navigate("FormRipasso", { ripassoId: x.ripasso.id }),
    onCompleta: completa,
  });

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.contenuto}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={aggiornando || loading}
            onRefresh={aggiorna}
            tintColor={theme.colors.accent}
          />
        }
      >
        <CampoRicerca valore={query} onCambia={setQuery} placeholder="Cerca fra i ripassi" />

        <Tendina
          titolo="Come funziona?"
          aperto={comeFunziona}
          onPremi={() => setComeFunziona((v) => !v)}
        >
          <Testo>{COME_FUNZIONA}</Testo>
        </Tendina>

        <Pillola
          label="Aggiungi ripasso"
          icona="piu"
          onPress={() => nav.navigate("FormRipasso")}
        />


        <Scheda style={styles.cardMicroSessione}>
          <View style={styles.testataCard}>
            <Kicker colore={theme.colors.accent}>Pausa rapida · 60s</Kicker>
          </View>
          <Titolo size={20}>
            {inScadenza > 0
              ? `${Math.min(inScadenza, 2)} concetti pronti per te`
              : "Tutto in ordine per oggi"}
          </Titolo>
          <Testo muto>
            {inScadenza > 0
              ? "Bastano 60 secondi per consolidare i punti critici di oggi."
              : "Nessuna scadenza urgente. Vuoi ripassare 1 concetto a caso?"}
          </Testo>
          <Pillola
            label={inScadenza > 0 ? "Avvia (1 min)" : "Avvia ripasso libero"}
            onPress={() => microSessione.avvia(inScadenza > 0 ? 2 : 1)}
            icona="fulmine"
            style={styles.bottoneMicroSessione}
          />
        </Scheda>


        {/* Two ways to be looking at the saved list: the device says there is no
            connection, or it thinks there is one and the server still hasn't
            answered. The second is the one that used to look like a bug. */}
        {!online || salvatoIl ? (
          <View style={styles.avviso}>
            <Testo size={theme.font.small} muto>
              {online
                ? `Non riesco a raggiungere il server: vedi i ripassi salvati ${quandoSalvato(salvatoIl)}.`
                : `Sei offline — vedi i ripassi salvati ${quandoSalvato(salvatoIl)}. Le modifiche richiedono la connessione.`}
            </Testo>
          </View>
        ) : null}

        {/* Saved here and nowhere else: the first thing to say, because it is the
            only state in which losing the phone loses the ripasso. */}
        <AvvisoDaCaricare
          voci={daCaricare}
          sincronizzando={coda.sincronizzando}
          bloccoDrive={coda.bloccoDrive}
          onCaricaOra={() => void coda.sincronizzaOra()}
        />

        {/* Offline reading is a promise the app makes silently; when part of it
            could not be kept, saying so now — and saying which ripassi — beats
            finding out on a train. */}
        <AvvisoNonDisponibili voci={cache.nonDisponibili} />

        {/* Un ritento dura secondi, con attese che raddoppiano: senza questa
            riga l'app sembra ferma e l'unica reazione sensata sarebbe toccare
            di nuovo, cioè la cosa che non aiuta. */}
        {ritentando ? (
          <View style={styles.ritento}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Testo size={theme.font.small} muto>
              La connessione fa i capricci: riprovo…
            </Testo>
          </View>
        ) : null}

        {error ? (
          <Testo size={theme.font.small} colore={theme.colors.danger}>
            {error}
          </Testo>
        ) : null}

        {/* While a query is typed the tabs would only narrow the answer, so
            they step aside and the results speak for the whole archive. */}
        {!ricercaAttiva ? (
          <Segmentato<SchedaLista>
            valore={scheda}
            onCambia={setScheda}
            opzioni={[
              { valore: "ripassi", label: "Da ripassare" },
              { valore: "storico", label: "Storico" },
            ]}
          />
        ) : null}

        {ricercaAttiva ? (
          totaleRisultati === 0 ? (
            <Vuoto>Nessun ripasso trovato per «{deferredQuery.trim()}»</Vuoto>
          ) : (
            <>
              <Testo size={theme.font.meta} muto>
                {totaleRisultati === 1
                  ? "1 risultato in tutti i ripassi"
                  : `${totaleRisultati} risultati in tutti i ripassi`}
              </Testo>
              {risultatiRicerca.map((g) => (
                <View key={g.gruppo} style={styles.gruppo}>
                  <View style={styles.testataGruppo}>
                    <Kicker
                      colore={
                        g.gruppo === "ritardo"
                          ? theme.colors.accentInk
                          : theme.colors.textMuted
                      }
                    >
                      {g.etichetta}
                    </Kicker>
                    <Testo size={theme.font.meta} muto>
                      {g.voci.length === 1 ? "1 voce" : `${g.voci.length} voci`}
                    </Testo>
                  </View>
                  {g.voci.map((v) => (
                    <RigaVoce
                      key={v.occorrenza.id}
                      {...proprieta(v, g.gruppo === "ritardo")}
                    />
                  ))}
                </View>
              ))}
            </>
          )
        ) : scheda === "ripassi" ? (
          gruppi.length === 0 ? (
            <Vuoto>Nessun ripasso da fare</Vuoto>
          ) : (
            gruppi.map((g) => (
              <View key={g.gruppo} style={styles.gruppo}>
                <View style={styles.testataGruppo}>
                  <Kicker
                    colore={
                      g.gruppo === "ritardo" ? theme.colors.accentInk : theme.colors.textMuted
                    }
                  >
                    {g.etichetta}
                  </Kicker>
                  <Testo size={theme.font.meta} muto>
                    {g.voci.length === 1 ? "1 voce" : `${g.voci.length} voci`}
                  </Testo>
                </View>
                {g.voci.map((v) => (
                  <RigaVoce
                    key={v.occorrenza.id}
                    {...proprieta(v, g.gruppo === "ritardo")}
                  />
                ))}
              </View>
            )).concat(
              haArretratiSpalmati ? [
                !mostraTuttiArretrati ? (
                  <Pillola
                    key="toggle-arretrati"
                    label="Mostra tutti gli arretrati"
                    variante="fantasma"
                    onPress={() => setMostraTuttiArretrati(true)}
                    style={styles.mostraTutti}
                  />
                ) : (
                  <Pillola
                    key="toggle-arretrati"
                    label="Riorganizza arretrati (Zero ansia)"
                    variante="fantasma"
                    onPress={() => setMostraTuttiArretrati(false)}
                    style={styles.mostraTutti}
                  />
                ),
              ] : []
            )
          )
        ) : (
          <View style={styles.gruppo}>
            <Casella
              label="Solo da completare"
              valore={soloDaFare}
              onCambia={() => setSoloDaFare((v) => !v)}
            />
            {storico.length === 0 ? (
              <Vuoto>
                {soloDaFare ? "Nessun ripasso da recuperare" : "Lo storico è vuoto"}
              </Vuoto>
            ) : (
              storico.map((v) => (
                <RigaVoce key={v.occorrenza.id} {...proprieta(v, false)} />
              ))
            )}
          </View>
        )}
      </ScrollView>
      <MicroSessioneModal sessione={microSessione} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  contenuto: {
    gap: theme.spacing.md,
    // The screen's gutter. Without it every heading, checkbox and card sat
    // flush against the bezel: the shell that used to supply this padding went
    // away with the course app, and nothing replaced it here.
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  cardMicroSessione: { gap: theme.spacing.xs, backgroundColor: theme.colors.surface, marginTop: 20, marginBottom: 10 },
  bottoneMicroSessione: { marginTop: theme.spacing.xs },
  testataCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avviso: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
  },
  ritento: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  gruppo: { gap: theme.spacing.sm },
  mostraTutti: { alignSelf: "center", marginTop: theme.spacing.sm },
  testataGruppo: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: theme.spacing.xs,
  },
});
