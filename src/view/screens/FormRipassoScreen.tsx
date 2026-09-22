/**
 * View — Ripasso form (spec section 9.2).
 * Create: title, notes, +1 hour toggle (default off), 3 attachment buttons.
 * Edit: occurrence management (complete / reschedule) and attachment access.
 *
 * Attachments can be picked before the ripasso exists: while creating, the
 * chosen files are held on screen and uploaded to Drive as soon as the row
 * has an id. Either way they are listed inline and open with one tap, without
 * a detour through the attachment detail screen.
 *
 * Everything about *when* that happens lives in useFormRipasso; this file only
 * describes what is on screen and where a tap leads.
 */
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { MarkdownTextInput, parseExpensiMark } from "@expensify/react-native-live-markdown";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { theme } from "@/view/theme/theme";
import { Button, Card, SectionTitle } from "@/view/components/ui";
import { OccorrenzaEditor } from "@/view/components/OccorrenzaEditor";
import { PulsantiAllegato } from "@/view/components/PulsantiAllegato";
import { RigaAnteprimaOccorrenza, RigaOccorrenza } from "@/view/components/occorrenze";
import {
  ListaAllegati,
  VisualizzatoreImmagine,
  type VoceAllegato,
} from "@/view/components/allegati";
import { useRipassiCtx } from "@/controller/RipassiContext";
import { useFormRipasso } from "@/controller/ripassi/useFormRipasso";
import { apriUriLocale } from "@/controller/allegati/fileDispositivo";
import { mostraErrore } from "@/controller/avvisoErrore";
import { Icona } from "@/view/theme/icone";
import { PrimoPasso } from "@/view/components/PrimoPasso";
import { ProgressoMaturazione } from "@/view/components/ProgressoMaturazione";
import { progressoMaturazione } from "@/model/ripassi/capitaleMentaleLogic";
import type { RootStackParamList } from "@/view/navigation";
import type { Occorrenza } from "@/model/types";

type NavigazioneForm = NativeStackNavigationProp<RootStackParamList, "FormRipasso">;
type RottaForm = RouteProp<RootStackParamList, "FormRipasso">;

/** Testo risultante e, quando va forzata, la posizione del cursore. */
interface EsitoLista {
  testo: string;
  /** null quando il testo non è stato riscritto e il cursore va lasciato stare. */
  cursore: number | null;
}

/**
 * Continua liste puntate/numerate quando si va a capo (stile WhatsApp):
 * dopo una riga che inizia con "- " o "1. " l'invio riporta lo stesso
 * marcatore (incrementato, per i numeri) sulla riga successiva. Se la
 * riga col marcatore è vuota, l'invio la rimuove e chiude la lista.
 *
 * Restituisce anche dove deve finire il cursore: il campo lo posiziona in
 * base al testo che ha scritto *lui*, e quindi lo lascerebbe prima del "- "
 * appena inserito — cioè si scriveva a sinistra del trattino.
 */
function continuaListaAutomatica(testoPrecedente: string, testoNuovo: string): EsitoLista {
  const invariato: EsitoLista = { testo: testoNuovo, cursore: null };
  if (testoNuovo.length !== testoPrecedente.length + 1) return invariato;

  let i = 0;
  while (i < testoPrecedente.length && testoPrecedente[i] === testoNuovo[i]) i++;
  if (testoNuovo[i] !== "\n") return invariato;

  const primaDelCursore = testoNuovo.slice(0, i);
  const inizioRiga = primaDelCursore.lastIndexOf("\n") + 1;
  const rigaCorrente = primaDelCursore.slice(inizioRiga);

  const puntata = rigaCorrente.match(/^(\s*)([-*])\s(.*)$/);
  const numerata = rigaCorrente.match(/^(\s*)(\d+)\.\s(.*)$/);
  if (!puntata && !numerata) return invariato;

  const [, indent, , contenuto] = (puntata ?? numerata) as RegExpMatchArray;

  // Invio su un marcatore vuoto: chiude la lista togliendo la riga.
  if (contenuto.trim() === "") {
    const testo = primaDelCursore.slice(0, inizioRiga) + testoNuovo.slice(i + 1);
    return { testo, cursore: inizioRiga };
  }

  const marcatore = puntata
    ? `${indent}${puntata[2]} `
    : `${indent}${parseInt(numerata![2], 10) + 1}. `;
  return {
    testo: testoNuovo.slice(0, i + 1) + marcatore + testoNuovo.slice(i + 1),
    cursore: i + 1 + marcatore.length,
  };
}

/** Stile del grassetto/corsivo live nel campo Note, coerente col tema app. */
const stileMarkdownNote = {
  syntax: { color: theme.colors.textMuted },
  link: { color: theme.colors.primary },
  h1: { fontSize: 20 },
  emoji: { fontSize: 16 },
  blockquote: {
    borderColor: theme.colors.textMuted,
    borderWidth: 3,
    marginLeft: 6,
    paddingLeft: 6,
  },
  code: {
    fontFamily: Platform.select({ ios: "Courier", default: "monospace" }),
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
  },
  pre: {
    fontFamily: Platform.select({ ios: "Courier", default: "monospace" }),
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
  },
  mentionHere: { color: theme.colors.primary },
  mentionUser: { color: theme.colors.primary },
};

export function FormRipassoScreen() {
  const nav = useNavigation<NavigazioneForm>();
  const route = useRoute<RottaForm>();
  const { completaOccorrenza, spostaOccorrenza } = useRipassiCtx();

  const form = useFormRipasso(route.params?.ripassoId);
  const { corrente, editId, isEdit, inCoda, inAttesa } = form;

  const [immagineAperta, setImmagineAperta] = useState<string | null>(null);
  /**
   * Cursore imposto al campo Note dopo un a capo che ha inserito da solo il
   * marcatore della lista. Torna undefined appena il campo lo conferma: un
   * `selection` sempre controllato combatterebbe con ogni tocco dell'utente.
   */
  const [selezioneNote, setSelezioneNote] = useState<
    { start: number; end: number } | undefined
  >(undefined);
  // Occurrence being edited in the calendar modal (null = modal closed).
  const [occInModifica, setOccInModifica] = useState<Occorrenza | null>(null);

  async function salva() {
    if (await form.salva()) nav.goBack();
  }

  /** Why the calendar will not open on a ripasso that is still on the device. */
  function avvisaInCoda() {
    Alert.alert(
      "Ripasso non ancora caricato",
      "Le date sono già impostate e i promemoria funzionano. Per spostarle serve che il ripasso sia stato caricato: succede da solo appena c'è connessione."
    );
  }

  /**
   * The two writes the calendar modal can start. Both capture the occurrence
   * id *before* awaiting: closing the modal clears `occInModifica`, and the
   * write must still know which row it was about when it lands.
   *
   * A failure here has to be said out loud. The modal closes either way, so
   * without this the date on screen would simply stay as it was, with nothing
   * to tell apart "it did not work" from "I did not press properly".
   */
  async function spostaData(nuovaData: Date, aCascata: boolean) {
    const id = occInModifica?.id;
    if (!id) return;
    try {
      await spostaOccorrenza(id, nuovaData, aCascata);
    } catch (e) {
      mostraErrore(e, "spostaOccorrenza", { occorrenzaId: id, aCascata });
    }
  }

  async function cambiaCompletata(completata: boolean) {
    const id = occInModifica?.id;
    if (!id) return;
    try {
      await completaOccorrenza(id, completata);
    } catch (e) {
      mostraErrore(e, "completaOccorrenza", { occorrenzaId: id });
    }
  }

  function confermaElimina() {
    if (!editId) return;
    Alert.alert("Eliminare il ripasso?", "Verranno rimossi occorrenze e allegati.", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Elimina",
        style: "destructive",
        onPress: async () => {
          if (await form.elimina()) nav.goBack();
        },
      },
    ]);
  }

  async function apriAllegato(voce: VoceAllegato) {
    try {
      const esito = await apriUriLocale(await voce.risolviUri(), voce.mimeType);
      if (esito.tipo === "immagine") setImmagineAperta(esito.uri);
    } catch (e) {
      mostraErrore(e, "apriAllegato");
    }
  }

  // Stored attachments first, then the ones still waiting to be uploaded.
  const voci = useMemo<VoceAllegato[]>(
    () => [
      ...(corrente?.allegati ?? []).map((a) => ({
        chiave: a.id,
        nome: a.display_name,
        mimeType: a.mime_type,
        risolviUri: () => form.risolviUri(a),
        rimovibile: false,
      })),
      ...inAttesa.map(({ chiave, file }) => ({
        chiave,
        nome: file.name,
        mimeType: file.mimeType,
        risolviUri: async () => file.uri,
      })),
    ],
    [corrente, inAttesa, form]
  );

  const progresso = corrente ? progressoMaturazione(corrente) : null;
  const isPermanente = isEdit && progresso ? progresso.livello === "permanente" : false;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {isPermanente ? (
          <View style={styles.maturitaBanner} accessibilityLabel="Memoria permanente: asset acquisito">
            <Icona nome="lucchetto" size={16} color={theme.colors.accentDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.maturitaTitolo}>Memoria Permanente · Asset Acquisito</Text>
              <Text style={styles.maturitaTesto}>
                Questo concetto è stabilmente consolidato a lungo termine.
              </Text>
            </View>
          </View>
        ) : null}

        {inCoda ? (
          <View style={styles.avviso}>
            <Text style={styles.avvisoTesto}>
              {"Salvato su questo dispositivo. Lo carico su Google Drive appena c'è connessione — puoi chiudere l'app."}
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>Titolo</Text>
        <TextInput
          placeholder="Es. Teorema di Bayes"
          placeholderTextColor={theme.colors.textMuted}
          value={form.titolo}
          onChangeText={form.setTitolo}
          style={styles.input}
        />

        {/* La domanda sta *sopra* le note, e l'ordine è il messaggio: si
            scrive prima che cosa si vorrà sapersi chiedere, poi la risposta.
            Scritta dopo, la domanda diventa un riassunto delle note; scritta
            prima, decide che cosa le note devono contenere. */}
        <Text style={styles.label}>Domanda</Text>
        <TextInput
          placeholder="Es. Perché la perdita pesa ~2,25 volte il guadagno equivalente?"
          placeholderTextColor={theme.colors.textMuted}
          value={form.domanda}
          onChangeText={form.setDomanda}
          multiline
          style={[styles.input, styles.inputDomanda]}
        />
        <Text style={styles.hint}>
          {"Facoltativa. Quando c'è, la lista mostra questa e mai la risposta: è ciò che rende la spunta un richiamo invece di un promemoria."}
        </Text>

        <Text style={styles.label}>Risposta e note</Text>
        <MarkdownTextInput
          placeholder="Testo libero… (usa *testo* per il grassetto)"
          placeholderTextColor={theme.colors.textMuted}
          value={form.note}
          onChangeText={(testo) => {
            const esito = continuaListaAutomatica(form.note, testo);
            form.setNote(esito.testo);
            if (esito.cursore !== null) {
              setSelezioneNote({ start: esito.cursore, end: esito.cursore });
            }
          }}
          selection={selezioneNote}
          onSelectionChange={() => setSelezioneNote(undefined)}
          parser={parseExpensiMark}
          markdownStyle={stileMarkdownNote}
          multiline
          style={[styles.input, styles.textarea]}
        />

        <Text style={styles.label}>Allegati</Text>
        <PulsantiAllegato onScegli={form.aggiungiAllegato} />

        {form.busy ? <Text style={styles.hint}>Caricamento su Google Drive…</Text> : null}

        {/* Il ritento ha attese che raddoppiano: senza dirlo, il pulsante che
            gira sembrerebbe girare a vuoto. */}
        {form.ritentando ? (
          <Text style={styles.hint}>La connessione fa i capricci: riprovo…</Text>
        ) : null}

        <ListaAllegati
          voci={voci}
          onApri={apriAllegato}
          onRimuovi={(voce) => form.rimuoviInAttesa(voce.chiave)}
          vuoto="Nessun allegato. Aggiungine uno con i pulsanti qui sopra."
        />

        {inAttesa.length > 0 ? (
          <Text style={styles.hint}>
            {inAttesa.length === 1
              ? "1 allegato verrà caricato al salvataggio."
              : `${inAttesa.length} allegati verranno caricati al salvataggio.`}
          </Text>
        ) : null}

        {/* Renaming, reordering and deleting all write to rows that do not
            exist yet: hidden rather than shown and silently doing nothing. */}
        {isEdit && !inCoda && corrente && corrente.allegati.length > 0 ? (
          <Pressable
            onPress={() => nav.navigate("DettaglioAllegati", { ripassoId: corrente.id })}
            style={styles.attachLink}
          >
            <Text style={styles.attachLinkText}>Rinomina, riordina o elimina ›</Text>
          </Pressable>
        ) : null}

        {/* +1 hour toggle, creation only (spec section 5) */}
        {!isEdit && (
          <Card style={styles.switchCard}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Aggiungi ripasso +1 ora</Text>
                <Text style={styles.switchSub}>{"Un ripasso extra a un'ora da adesso."}</Text>
              </View>
              <Switch
                value={form.includi1h}
                onValueChange={form.setIncludi1h}
                trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
                thumbColor={theme.colors.surface}
              />
            </View>
          </Card>
        )}

        {isEdit && progresso && progresso.livello !== "permanente" ? (
          <>
            <SectionTitle>Maturazione</SectionTitle>
            <Card style={styles.switchCard}>
              <ProgressoMaturazione progresso={progresso} />
            </Card>
          </>
        ) : null}

        <SectionTitle>Prossimi ripassi programmati</SectionTitle>
        {isEdit && corrente
          ? corrente.occorrenze.map((o) => (
              <RigaOccorrenza
                key={o.id}
                occorrenza={o}
                // Rescheduling writes to a row that does not exist yet. The
                // dates are real and the reminders are already set — the only
                // thing that has to wait is changing them.
                onPress={inCoda ? avvisaInCoda : setOccInModifica}
              />
            ))
          : form.anteprima.map((o) => (
              <RigaAnteprimaOccorrenza key={o.offset} occorrenza={o} />
            ))}

        <View style={{ height: theme.spacing.lg }} />
        <Button
          label={isEdit ? "Salva modifiche" : "Crea ripasso"}
          variant="accent"
          loading={form.saving}
          onPress={salva}
        />
        {isEdit ? (
          <Button
            label="Elimina ripasso"
            variant="danger"
            onPress={confermaElimina}
            style={{ marginTop: theme.spacing.md }}
          />
        ) : null}
      </ScrollView>

      <PrimoPasso
        prossimoRichiamo={form.primoPasso?.prossimoRichiamo ?? null}
        onChiudi={() => {
          form.chiudiPrimoPasso();
          nav.goBack();
        }}
      />

      <VisualizzatoreImmagine uri={immagineAperta} onChiudi={() => setImmagineAperta(null)} />

      <OccorrenzaEditor
        occorrenza={occInModifica}
        occorrenze={corrente?.occorrenze ?? []}
        onChiudi={() => setOccInModifica(null)}
        onSalvaData={spostaData}
        onToggleCompletata={cambiaCompletata}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  label: {
    fontSize: theme.font.body,
    fontWeight: "700",
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.font.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  inputDomanda: { minHeight: 56, textAlignVertical: "top" },
  avviso: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceToday,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderToday,
  },
  avvisoTesto: { color: theme.colors.text, fontSize: theme.font.small },
  attachLink: { marginTop: theme.spacing.sm },
  attachLinkText: { color: theme.colors.primary, fontWeight: "700", fontSize: theme.font.body },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    marginTop: theme.spacing.sm,
    fontStyle: "italic",
  },
  maturitaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.sm,
  },
  maturitaTitolo: {
    fontSize: theme.font.small,
    fontWeight: "700",
    color: theme.colors.accentDark,
  },
  maturitaTesto: {
    fontSize: theme.font.meta,
    color: theme.colors.accentDark,
    marginTop: 2,
  },
  switchCard: { marginTop: theme.spacing.lg },
  switchRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  switchTitle: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.text },
  switchSub: { fontSize: theme.font.small, color: theme.colors.textMuted },
});
