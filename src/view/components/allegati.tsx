/**
 * View — shared attachment pieces: thumbnail, compact list and full-screen
 * image viewer. Used by the ripasso form (open an attachment without leaving
 * the screen) and by the attachment detail screen (which adds rename, reorder
 * and delete on top of the same rows).
 *
 * Uris are resolved lazily through a callback: a stored attachment may have to
 * be downloaded from Drive first, while one picked but not yet saved is
 * already on the device.
 */
import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/theme/theme";

/** One row of the list, regardless of whether it is already stored. */
export interface VoceAllegato {
  chiave: string;
  nome: string;
  mimeType: string | null;
  /** Local uri to show/open it. */
  risolviUri: () => Promise<string>;
  /** False for rows the list must not offer to remove (already stored). */
  rimovibile?: boolean;
}

export function isImmagine(mimeType: string | null): boolean {
  return (mimeType ?? "").startsWith("image/");
}

/** Thumbnail: the image itself, or a placeholder icon while (or if not) resolving. */
export function Miniatura({
  mimeType,
  risolviUri,
}: {
  mimeType: string | null;
  risolviUri: () => Promise<string>;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const immagine = isImmagine(mimeType);

  useEffect(() => {
    if (!immagine) return;
    let attivo = true;
    risolviUri()
      .then((u) => {
        if (attivo) setUri(u);
      })
      .catch(() => {
        /* ignore: the placeholder stays */
      });
    return () => {
      attivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immagine]);

  if (uri) return <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />;
  return (
    <View style={styles.thumbFallback}>
      <Text style={styles.thumbIcon}>{immagine ? "🖼️" : "📄"}</Text>
    </View>
  );
}

/**
 * Tappable attachment list. `onRimuovi` is only passed while a ripasso is
 * being created, where removing means dropping a not-yet-uploaded file.
 */
export function ListaAllegati({
  voci,
  onApri,
  onRimuovi,
  vuoto,
}: {
  voci: VoceAllegato[];
  onApri: (voce: VoceAllegato) => void;
  onRimuovi?: (voce: VoceAllegato) => void;
  vuoto?: string;
}) {
  if (voci.length === 0) {
    return vuoto ? <Text style={styles.vuoto}>{vuoto}</Text> : null;
  }

  return (
    <View style={styles.lista}>
      {voci.map((voce) => (
        <View key={voce.chiave} style={styles.riga}>
          <Pressable style={styles.rigaMain} onPress={() => onApri(voce)}>
            <Miniatura mimeType={voce.mimeType} risolviUri={voce.risolviUri} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nome} numberOfLines={1}>
                {voce.nome}
              </Text>
              <Text style={styles.meta}>Tocca per aprire</Text>
            </View>
          </Pressable>
          {onRimuovi && voce.rimovibile !== false ? (
            <Pressable onPress={() => onRimuovi(voce)} hitSlop={8}>
              <Text style={styles.rimuovi}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** Full-screen image viewer. Handles both local file:// and https uris. */
export function VisualizzatoreImmagine({
  uri,
  onChiudi,
}: {
  uri: string | null;
  onChiudi: () => void;
}) {
  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onChiudi}>
      <View style={styles.viewerBg}>
        {uri ? <Image source={{ uri }} style={styles.viewerImg} resizeMode="contain" /> : null}
        <Pressable style={styles.viewerClose} onPress={onChiudi} hitSlop={12}>
          <Text style={styles.viewerCloseText}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  lista: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  riga: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  rigaMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  nome: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.text },
  meta: { fontSize: theme.font.small, color: theme.colors.textMuted },
  rimuovi: { fontSize: 16, color: theme.colors.danger, paddingHorizontal: theme.spacing.sm },
  vuoto: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    fontStyle: "italic",
    marginTop: theme.spacing.sm,
  },
  thumb: { width: 48, height: 48, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceAlt },
  thumbFallback: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbIcon: { fontSize: 22 },
  viewerBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  viewerImg: { width: "100%", height: "100%" },
  viewerClose: {
    position: "absolute",
    top: 48,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerCloseText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
