/**
 * View — Attachment detail (spec section 9.3): view, rename, reorder, delete.
 * Opening goes through the Controller (useAllegati.apri): images are shown
 * in-app in a full-screen viewer, PDF/other in the system viewer.
 */
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { theme } from "@/view/theme/theme";
import { Button } from "@/view/components/ui";
import { Miniatura, VisualizzatoreImmagine } from "@/view/components/allegati";
import { PulsantiAllegato } from "@/view/components/PulsantiAllegato";
import { useRipassiCtx } from "@/controller/RipassiContext";
import { useAllegati } from "@/controller/allegati/useAllegati";
import { mostraErrore } from "@/controller/avvisoErrore";
import type { RootStackParamList } from "@/view/navigation";
import type { Allegato } from "@/model/types";

type RottaAllegati = RouteProp<RootStackParamList, "DettaglioAllegati">;

export function DettaglioAllegatiScreen() {
  const route = useRoute<RottaAllegati>();
  const ripassoId = route.params.ripassoId;
  const { ripassi, reload } = useRipassiCtx();
  const corrente = useMemo(() => ripassi.find((r) => r.id === ripassoId) ?? null, [ripassi, ripassoId]);
  const allegati = corrente?.allegati ?? [];

  const { busy, aggiungi, rinomina, riordina, elimina, apri, risolviUri } = useAllegati(
    ripassoId,
    reload
  );

  const [renaming, setRenaming] = useState<Allegato | null>(null);
  const [nomeTemp, setNomeTemp] = useState("");
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  async function apriAllegato(a: Allegato) {
    try {
      const esito = await apri(a);
      if (esito.tipo === "immagine") setViewerUri(esito.uri);
    } catch (e) {
      mostraErrore(e, "apriAllegato");
    }
  }

  async function muovi(index: number, delta: number) {
    const next = [...allegati];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await riordina(next.map((a) => a.id));
  }

  function confermaElimina(a: Allegato) {
    Alert.alert("Eliminare l'allegato?", a.display_name, [
      { text: "Annulla", style: "cancel" },
      { text: "Elimina", style: "destructive", onPress: () => elimina(a) },
    ]);
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.addRow}>
          <PulsantiAllegato onScegli={(scegli) => aggiungi(scegli, allegati.length)} />
        </View>
        {busy ? <Text style={styles.busy}>Caricamento in corso…</Text> : null}

        {allegati.length === 0 ? (
          <Text style={styles.empty}>Nessun allegato. Aggiungine uno con i pulsanti qui sopra.</Text>
        ) : (
          allegati.map((a, index) => (
            <View key={a.id} style={styles.item}>
              <Pressable style={styles.itemMain} onPress={() => apriAllegato(a)}>
                <Miniatura mimeType={a.mime_type} risolviUri={() => risolviUri(a)} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{a.display_name}</Text>
                  <Text style={styles.itemMeta}>{a.mime_type ?? "file"}</Text>
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Pressable onPress={() => muovi(index, -1)} hitSlop={8}><Text style={styles.action}>▲</Text></Pressable>
                <Pressable onPress={() => muovi(index, 1)} hitSlop={8}><Text style={styles.action}>▼</Text></Pressable>
                <Pressable onPress={() => { setRenaming(a); setNomeTemp(a.display_name); }} hitSlop={8}><Text style={styles.action}>✎</Text></Pressable>
                <Pressable onPress={() => confermaElimina(a)} hitSlop={8}><Text style={[styles.action, styles.del]}>🗑</Text></Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <VisualizzatoreImmagine uri={viewerUri} onChiudi={() => setViewerUri(null)} />

      {/* Rename modal (cross-platform; Alert.prompt is iOS-only) */}
      <Modal visible={renaming !== null} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rinomina allegato</Text>
            <TextInput value={nomeTemp} onChangeText={setNomeTemp} style={styles.modalInput} autoFocus />
            <View style={styles.modalActions}>
              <Button label="Annulla" variant="ghost" onPress={() => setRenaming(null)} style={{ flex: 1 }} />
              <Button
                label="Salva"
                variant="accent"
                style={{ flex: 1 }}
                onPress={async () => {
                  if (renaming && nomeTemp.trim()) await rinomina(renaming.id, nomeTemp.trim());
                  setRenaming(null);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg },
  addRow: { marginBottom: theme.spacing.lg },
  busy: { color: theme.colors.textMuted, marginBottom: theme.spacing.md },
  empty: { color: theme.colors.textMuted, fontStyle: "italic", textAlign: "center", marginTop: theme.spacing.xl },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  itemMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  itemName: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.text },
  itemMeta: { fontSize: theme.font.small, color: theme.colors.textMuted },
  actions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingHorizontal: theme.spacing.xs },
  action: { fontSize: 16, color: theme.colors.primary },
  del: { color: theme.colors.danger },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: theme.spacing.xl },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, gap: theme.spacing.md },
  modalTitle: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.primary },
  modalInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.font.body, color: theme.colors.text,
  },
  modalActions: { flexDirection: "row", gap: theme.spacing.md },
});
