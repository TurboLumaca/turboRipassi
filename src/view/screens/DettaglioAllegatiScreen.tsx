/**
 * View — Attachment detail (spec section 9.3): view, rename, reorder, delete.
 * Opening goes through the Controller (useAllegati.apri): images are shown
 * in-app in a full-screen viewer, PDF/other in the system viewer.
 */
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { theme } from "@/theme/theme";
import { Button } from "@/view/components/ui";
import { useRipassiCtx } from "@/controller/RipassiContext";
import { useAllegati } from "@/controller/useAllegati";
import { traduciErrore } from "@/model/errorMessages";
import type { RootStackParamList } from "@/view/navigation";
import type { Allegato } from "@/model/types";

type Rt = RouteProp<RootStackParamList, "DettaglioAllegati">;

export function DettaglioAllegatiScreen() {
  const route = useRoute<Rt>();
  const ripassoId = route.params.ripassoId;
  const { ripassi, reload } = useRipassiCtx();
  const corrente = useMemo(() => ripassi.find((r) => r.id === ripassoId) ?? null, [ripassi, ripassoId]);
  const allegati = corrente?.allegati ?? [];

  const {
    busy,
    scattaFoto,
    scegliDallaGalleria,
    scegliFile,
    rinomina,
    riordina,
    elimina,
    apri,
    risolviUri,
  } = useAllegati(ripassoId, reload);

  const [renaming, setRenaming] = useState<Allegato | null>(null);
  const [nomeTemp, setNomeTemp] = useState("");
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  async function apriAllegato(a: Allegato) {
    try {
      const esito = await apri(a);
      if (esito.tipo === "immagine") setViewerUri(esito.uri);
    } catch (e) {
      const { titolo, messaggio } = traduciErrore(e);
      Alert.alert(titolo, messaggio);
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

  function isImmagine(a: Allegato): boolean {
    return (a.mime_type ?? "").startsWith("image/");
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.addRow}>
          <Button label="📷 Foto" onPress={() => scattaFoto(allegati.length)} style={styles.addBtn} />
          <Button label="🖼️ Galleria" onPress={() => scegliDallaGalleria(allegati.length)} style={styles.addBtn} />
          <Button label="📄 File" onPress={() => scegliFile(allegati.length)} style={styles.addBtn} />
        </View>
        {busy ? <Text style={styles.busy}>Caricamento in corso…</Text> : null}

        {allegati.length === 0 ? (
          <Text style={styles.empty}>Nessun allegato. Aggiungine uno con i pulsanti qui sopra.</Text>
        ) : (
          allegati.map((a, index) => (
            <View key={a.id} style={styles.item}>
              <Pressable style={styles.itemMain} onPress={() => apriAllegato(a)}>
                {isImmagine(a) ? (
                  <ThumbImage resolve={() => risolviUri(a)} />
                ) : (
                  <View style={styles.thumbFallback}>
                    <Text style={styles.thumbIcon}>📄</Text>
                  </View>
                )}
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

      {/* Full-screen image viewer (handles both local file:// and https) */}
      <Modal visible={viewerUri !== null} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <View style={styles.viewerBg}>
          {viewerUri ? <Image source={{ uri: viewerUri }} style={styles.viewerImg} resizeMode="contain" /> : null}
          <Pressable style={styles.viewerClose} onPress={() => setViewerUri(null)} hitSlop={12}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </Pressable>
        </View>
      </Modal>

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

/** Image thumbnail: uri resolved by the Controller (local cache or temp download). */
function ThumbImage({ resolve }: { resolve: () => Promise<string> }) {
  const [uri, setUri] = useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await resolve();
        if (alive) setUri(u);
      } catch {
        /* ignore: show the fallback */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!uri) return <View style={styles.thumbFallback}><Text style={styles.thumbIcon}>🖼️</Text></View>;
  return <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg },
  addRow: { flexDirection: "row", gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  addBtn: { flex: 1, paddingHorizontal: theme.spacing.sm },
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
  thumb: { width: 48, height: 48, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceAlt },
  thumbFallback: {
    width: 48, height: 48, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center",
  },
  thumbIcon: { fontSize: 22 },
  itemName: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.text },
  itemMeta: { fontSize: theme.font.small, color: theme.colors.textMuted },
  actions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingHorizontal: theme.spacing.xs },
  action: { fontSize: 16, color: theme.colors.primary },
  del: { color: theme.colors.danger },
  viewerBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  viewerImg: { width: "100%", height: "100%" },
  viewerClose: {
    position: "absolute", top: 48, right: 24,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
  viewerCloseText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: theme.spacing.xl },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, gap: theme.spacing.md },
  modalTitle: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.primary },
  modalInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.font.body, color: theme.colors.text,
  },
  modalActions: { flexDirection: "row", gap: theme.spacing.md },
});
