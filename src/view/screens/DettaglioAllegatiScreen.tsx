/**
 * View — Dettaglio allegati (sezione 9.3): visualizza, rinomina, riordina, elimina.
 * L'apertura di un allegato usa la cache locale se presente, altrimenti un URL firmato.
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
import * as WebBrowser from "expo-web-browser";
import { theme } from "@/theme/theme";
import { Button } from "@/view/components/ui";
import { useRipassiCtx } from "@/controller/RipassiContext";
import { useAllegati } from "@/controller/useAllegati";
import { getSignedUrl } from "@/model/allegatiRepo";
import type { RootStackParamList } from "@/view/navigation";
import type { Allegato } from "@/model/types";

type Rt = RouteProp<RootStackParamList, "DettaglioAllegati">;

export function DettaglioAllegatiScreen() {
  const route = useRoute<Rt>();
  const ripassoId = route.params.ripassoId;
  const { ripassi, reload, cache } = useRipassiCtx();
  const corrente = useMemo(() => ripassi.find((r) => r.id === ripassoId) ?? null, [ripassi, ripassoId]);
  const allegati = corrente?.allegati ?? [];

  const { busy, scattaFoto, scegliDallaGalleria, scegliFile, rinomina, riordina, elimina } = useAllegati(
    ripassoId,
    reload
  );

  const [renaming, setRenaming] = useState<Allegato | null>(null);
  const [nomeTemp, setNomeTemp] = useState("");

  async function apri(a: Allegato) {
    try {
      const locale = await cache.getLocalUri(a.id);
      const url = locale ?? (await getSignedUrl(a.storage_path));
      await WebBrowser.openBrowserAsync(url);
    } catch (e: any) {
      Alert.alert("Errore", e?.message ?? "Impossibile aprire l'allegato.");
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
              <Pressable style={styles.itemMain} onPress={() => apri(a)}>
                {isImmagine(a) ? (
                  <ThumbImage path={a.storage_path} localGetter={() => cache.getLocalUri(a.id)} />
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

      {/* Modale rinomina (cross-platform, Alert.prompt è solo iOS) */}
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

/** Miniatura immagine: usa l'uri locale se in cache, altrimenti URL firmato. */
function ThumbImage({ path, localGetter }: { path: string; localGetter: () => Promise<string | null> }) {
  const [uri, setUri] = useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const locale = await localGetter();
        const u = locale ?? (await getSignedUrl(path, 3600));
        if (alive) setUri(u);
      } catch {
        /* ignora: mostra il fallback */
      }
    })();
    return () => {
      alive = false;
    };
  }, [path]);

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
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: theme.spacing.xl },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, gap: theme.spacing.md },
  modalTitle: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.primary },
  modalInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: theme.font.body, color: theme.colors.text,
  },
  modalActions: { flexDirection: "row", gap: theme.spacing.md },
});
