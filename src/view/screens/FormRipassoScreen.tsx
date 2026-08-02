/**
 * View — Ripasso form (spec section 9.2).
 * Create: title, notes, +1 hour toggle (default off), 3 attachment buttons.
 * Edit: occurrence management (complete / reschedule) and attachment access.
 *
 * Attachments can be picked before the ripasso exists: while creating, the
 * chosen files are held on screen and uploaded to Drive as soon as the row
 * has an id. Either way they are listed inline and open with one tap, without
 * a detour through the attachment detail screen.
 */
import React, { useMemo, useRef, useState } from "react";
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
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { theme } from "@/theme/theme";
import { Badge, Button, Card, SectionTitle } from "@/view/components/ui";
import { OccorrenzaEditor } from "@/view/components/OccorrenzaEditor";
import {
  ListaAllegati,
  VisualizzatoreImmagine,
  type VoceAllegato,
} from "@/view/components/allegati";
import { useRipassiCtx } from "@/controller/RipassiContext";
import {
  apriUriLocale,
  scegliDaFotocamera,
  scegliDaGalleria,
  scegliDocumento,
  useAllegati,
  type FilePicked,
} from "@/controller/useAllegati";
import { formatData, isPassato } from "@/view/format";
import { calcolaOccorrenze, ETICHETTE_OFFSET } from "@/model/occorrenzeDates";
import { traduciErrore } from "@/model/errorMessages";
import type { RootStackParamList } from "@/view/navigation";
import type { Occorrenza } from "@/model/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "FormRipasso">;
type Rt = RouteProp<RootStackParamList, "FormRipasso">;

export function FormRipassoScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rt>();
  // A ripasso created during this visit keeps the screen usable instead of
  // creating a second one: after the first save the form behaves as an edit.
  const [idCreato, setIdCreato] = useState<string | null>(null);
  const editId = route.params?.ripassoId ?? idCreato;
  const isEdit = editId !== null;

  const { ripassi, reload, crea, modifica, elimina, completaOccorrenza, spostaOccorrenza } =
    useRipassiCtx();
  const corrente = useMemo(() => ripassi.find((r) => r.id === editId) ?? null, [ripassi, editId]);
  const { busy, caricaSuRipasso, risolviUri } = useAllegati(editId, reload);

  const [titolo, setTitolo] = useState(corrente?.titolo ?? "");
  const [note, setNote] = useState(corrente?.note ?? "");
  const [includi1h, setIncludi1h] = useState(false);
  const [saving, setSaving] = useState(false);
  // Files picked before the ripasso exists: uploaded on save. Anything that
  // fails to upload stays here so the user can retry instead of losing it.
  // Each carries its own key: two photos can share a name, and a key derived
  // from the position would follow the wrong file once one is removed.
  const [inAttesa, setInAttesa] = useState<{ chiave: string; file: FilePicked }[]>([]);
  const contatoreAttesa = useRef(0);
  const [immagineAperta, setImmagineAperta] = useState<string | null>(null);
  // Occurrence being edited in the calendar modal (null = modal closed).
  const [occInModifica, setOccInModifica] = useState<Occorrenza | null>(null);

  // Preview of the occurrences that will be generated (creation only).
  const anteprima = useMemo(() => calcolaOccorrenze(new Date(), includi1h), [includi1h]);

  async function salva() {
    if (titolo.trim() === "") {
      Alert.alert("Titolo mancante", "Inserisci un titolo per il ripasso.");
      return;
    }
    setSaving(true);
    const daCaricare = inAttesa;
    const primoIndice = corrente?.allegati.length ?? 0;
    try {
      let id = editId;
      if (id) {
        await modifica(id, { titolo: titolo.trim(), note: note.trim() || null });
      } else {
        id = (await crea({ titolo: titolo.trim(), note: note.trim() || null, includi1h })).id;
        setIdCreato(id);
      }

      if (daCaricare.length > 0) {
        const falliti = await caricaSuRipasso(
          id,
          daCaricare.map((v) => v.file),
          primoIndice
        );
        // The uploader hands back the very objects it was given, so identity
        // is enough to keep each failure paired with its key.
        setInAttesa(daCaricare.filter((v) => falliti.includes(v.file)));
        if (falliti.length > 0) {
          // The ripasso itself is saved: staying here keeps the failed files
          // in hand so another tap on Salva retries just those.
          Alert.alert(
            "Allegati non caricati",
            falliti.length === 1
              ? "Il ripasso è salvato, ma un allegato non è arrivato su Google Drive. Tocca di nuovo Salva per riprovare."
              : `Il ripasso è salvato, ma ${falliti.length} allegati non sono arrivati su Google Drive. Tocca di nuovo Salva per riprovare.`
          );
          return;
        }
      }
      nav.goBack();
    } catch (e) {
      const { titolo, messaggio } = traduciErrore(e);
      Alert.alert(titolo, messaggio);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Picking an attachment: uploaded immediately when the ripasso already
   * exists, held on screen otherwise (it has no id to belong to yet).
   */
  async function aggiungiAllegato(scegli: () => Promise<FilePicked | null>) {
    const file = await scegli();
    if (!file) return;
    if (editId) {
      await caricaSuRipasso(editId, [file], corrente?.allegati.length ?? 0);
    } else {
      const chiave = `attesa-${contatoreAttesa.current++}`;
      setInAttesa((precedenti) => [...precedenti, { chiave, file }]);
    }
  }

  async function apriAllegato(voce: VoceAllegato) {
    try {
      const esito = await apriUriLocale(await voce.risolviUri(), voce.mimeType);
      if (esito.tipo === "immagine") setImmagineAperta(esito.uri);
    } catch (e) {
      const { titolo, messaggio } = traduciErrore(e);
      Alert.alert(titolo, messaggio);
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
          try {
            await elimina(editId);
            nav.goBack();
          } catch (e) {
            // Without this the rejection was unhandled and the screen stayed
            // open with no explanation.
            const { titolo, messaggio } = traduciErrore(e);
            Alert.alert(titolo, messaggio);
          }
        },
      },
    ]);
  }

  function modificaOccorrenza(o: Occorrenza) {
    // Opens the calendar modal: free day picking + completed toggle.
    setOccInModifica(o);
  }

  function apriAllegati() {
    if (!editId) return;
    nav.navigate("DettaglioAllegati", { ripassoId: editId });
  }

  // Stored attachments first, then the ones still waiting to be uploaded.
  const voci = useMemo<VoceAllegato[]>(
    () => [
      ...(corrente?.allegati ?? []).map((a) => ({
        chiave: a.id,
        nome: a.display_name,
        mimeType: a.mime_type,
        risolviUri: () => risolviUri(a),
        rimovibile: false,
      })),
      ...inAttesa.map(({ chiave, file }) => ({
        chiave,
        nome: file.name,
        mimeType: file.mimeType,
        risolviUri: async () => file.uri,
      })),
    ],
    [corrente, inAttesa, risolviUri]
  );

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Titolo</Text>
        <TextInput
          placeholder="Es. Teorema di Bayes"
          placeholderTextColor={theme.colors.textMuted}
          value={titolo}
          onChangeText={setTitolo}
          style={styles.input}
        />

        <Text style={styles.label}>Note</Text>
        <TextInput
          placeholder="Testo libero…"
          placeholderTextColor={theme.colors.textMuted}
          value={note}
          onChangeText={setNote}
          multiline
          style={[styles.input, styles.textarea]}
        />

        {/* Attachments */}
        <Text style={styles.label}>Allegati</Text>
        <View style={styles.attachRow}>
          <AttachButton icon="📷" label="Foto" onPress={() => aggiungiAllegato(scegliDaFotocamera)} />
          <AttachButton icon="🖼️" label="Galleria" onPress={() => aggiungiAllegato(scegliDaGalleria)} />
          <AttachButton icon="📄" label="File / PDF" onPress={() => aggiungiAllegato(scegliDocumento)} />
        </View>

        {busy ? <Text style={styles.hint}>Caricamento su Google Drive…</Text> : null}

        <ListaAllegati
          voci={voci}
          onApri={apriAllegato}
          onRimuovi={(voce) =>
            setInAttesa((precedenti) => precedenti.filter((v) => v.chiave !== voce.chiave))
          }
          vuoto="Nessun allegato. Aggiungine uno con i pulsanti qui sopra."
        />

        {inAttesa.length > 0 ? (
          <Text style={styles.hint}>
            {inAttesa.length === 1
              ? "1 allegato verrà caricato al salvataggio."
              : `${inAttesa.length} allegati verranno caricati al salvataggio.`}
          </Text>
        ) : null}

        {isEdit && corrente && corrente.allegati.length > 0 ? (
          <Pressable onPress={apriAllegati} style={styles.attachLink}>
            <Text style={styles.attachLinkText}>Rinomina, riordina o elimina ›</Text>
          </Pressable>
        ) : null}

        {/* +1 hour toggle, creation only (spec section 5) */}
        {!isEdit && (
          <Card style={styles.switchCard}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Aggiungi ripasso +1 ora</Text>
                <Text style={styles.switchSub}>Un ripasso extra a un'ora da adesso.</Text>
              </View>
              <Switch
                value={includi1h}
                onValueChange={setIncludi1h}
                trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
                thumbColor={theme.colors.surface}
              />
            </View>
          </Card>
        )}

        {/* Upcoming scheduled reviews */}
        <SectionTitle>Prossimi ripassi programmati</SectionTitle>
        {isEdit && corrente ? (
          corrente.occorrenze.map((o) => (
            <Pressable key={o.id} style={styles.occRow} onPress={() => modificaOccorrenza(o)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.occDate, o.is_completed && styles.occDone]}>
                  {formatData(o.scheduled_at)}
                </Text>
                <View style={styles.occTags}>
                  {o.is_manual_1h ? <Badge label="+1 ora" tone="accent" /> : null}
                  {o.is_completed ? (
                    <Badge label="Completato" tone="muted" />
                  ) : isPassato(o.scheduled_at) ? (
                    <Badge label="Scaduto" tone="muted" />
                  ) : null}
                </View>
              </View>
              <Text style={styles.editIcon}>✎</Text>
            </Pressable>
          ))
        ) : (
          anteprima.map((o) => (
            <View key={o.offset} style={styles.occRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.occDate}>{formatData(o.scheduled_at)}</Text>
                <View style={styles.occTags}>
                  <Badge label={ETICHETTE_OFFSET[o.offset]} tone={o.is_manual_1h ? "accent" : "primary"} />
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: theme.spacing.lg }} />
        <Button
          label={isEdit ? "Salva modifiche" : "Crea ripasso"}
          variant="accent"
          loading={saving}
          onPress={salva}
        />
        {isEdit ? (
          <Button label="Elimina ripasso" variant="danger" onPress={confermaElimina} style={{ marginTop: theme.spacing.md }} />
        ) : null}
      </ScrollView>

      <VisualizzatoreImmagine uri={immagineAperta} onChiudi={() => setImmagineAperta(null)} />

      <OccorrenzaEditor
        occorrenza={occInModifica}
        onChiudi={() => setOccInModifica(null)}
        onSalvaData={(nuovaData) => {
          if (occInModifica) spostaOccorrenza(occInModifica.id, nuovaData);
        }}
        onToggleCompletata={(completata) => {
          if (occInModifica) completaOccorrenza(occInModifica.id, completata);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function AttachButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.attachBtn} onPress={onPress}>
      <Text style={styles.attachIcon}>{icon}</Text>
      <Text style={styles.attachLabel}>{label}</Text>
    </Pressable>
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
  attachRow: { flexDirection: "row", gap: theme.spacing.sm },
  attachBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  attachIcon: { fontSize: 22 },
  attachLabel: { fontSize: theme.font.small, color: theme.colors.text, fontWeight: "600" },
  attachLink: { marginTop: theme.spacing.sm },
  attachLinkText: { color: theme.colors.primary, fontWeight: "700", fontSize: theme.font.body },
  hint: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: theme.spacing.sm, fontStyle: "italic" },
  switchCard: { marginTop: theme.spacing.lg },
  switchRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  switchTitle: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.text },
  switchSub: { fontSize: theme.font.small, color: theme.colors.textMuted },
  occRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  occDate: { fontSize: theme.font.body, color: theme.colors.text, fontWeight: "600" },
  occDone: { textDecorationLine: "line-through", color: theme.colors.completed },
  occTags: { flexDirection: "row", gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  editIcon: { fontSize: 20, color: theme.colors.primary, paddingHorizontal: theme.spacing.sm },
});
