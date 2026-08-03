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
import type { RootStackParamList } from "@/view/navigation";
import type { Occorrenza } from "@/model/types";

type NavigazioneForm = NativeStackNavigationProp<RootStackParamList, "FormRipasso">;
type RottaForm = RouteProp<RootStackParamList, "FormRipasso">;

export function FormRipassoScreen() {
  const nav = useNavigation<NavigazioneForm>();
  const route = useRoute<RottaForm>();
  const { completaOccorrenza, spostaOccorrenza } = useRipassiCtx();

  const form = useFormRipasso(route.params?.ripassoId);
  const { corrente, editId, isEdit, inAttesa } = form;

  const [immagineAperta, setImmagineAperta] = useState<string | null>(null);
  // Occurrence being edited in the calendar modal (null = modal closed).
  const [occInModifica, setOccInModifica] = useState<Occorrenza | null>(null);

  async function salva() {
    if (await form.salva()) nav.goBack();
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

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Titolo</Text>
        <TextInput
          placeholder="Es. Teorema di Bayes"
          placeholderTextColor={theme.colors.textMuted}
          value={form.titolo}
          onChangeText={form.setTitolo}
          style={styles.input}
        />

        <Text style={styles.label}>Note</Text>
        <TextInput
          placeholder="Testo libero…"
          placeholderTextColor={theme.colors.textMuted}
          value={form.note}
          onChangeText={form.setNote}
          multiline
          style={[styles.input, styles.textarea]}
        />

        <Text style={styles.label}>Allegati</Text>
        <PulsantiAllegato onScegli={form.aggiungiAllegato} />

        {form.busy ? <Text style={styles.hint}>Caricamento su Google Drive…</Text> : null}

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

        {isEdit && corrente && corrente.allegati.length > 0 ? (
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
                <Text style={styles.switchSub}>Un ripasso extra a un'ora da adesso.</Text>
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

        <SectionTitle>Prossimi ripassi programmati</SectionTitle>
        {isEdit && corrente
          ? corrente.occorrenze.map((o) => (
              <RigaOccorrenza key={o.id} occorrenza={o} onPress={setOccInModifica} />
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
  attachLink: { marginTop: theme.spacing.sm },
  attachLinkText: { color: theme.colors.primary, fontWeight: "700", fontSize: theme.font.body },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    marginTop: theme.spacing.sm,
    fontStyle: "italic",
  },
  switchCard: { marginTop: theme.spacing.lg },
  switchRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  switchTitle: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.text },
  switchSub: { fontSize: theme.font.small, color: theme.colors.textMuted },
});
