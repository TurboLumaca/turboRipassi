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
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { theme } from "@/view/theme/theme";
import { isImmagine } from "@/model/shared/fileUtils";

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

/**
 * Thumbnail: the image itself, or a placeholder icon while (or if not)
 * resolving.
 *
 * Contract: callers must render one Miniatura per attachment with a React
 * `key` derived from its id — which both call sites already do. That is what
 * makes it correct to resolve the uri once, on mount: a different file means a
 * different component instance. `risolviUri` is deliberately captured rather
 * than watched, because it is a fresh closure on every render of the parent
 * and depending on it would re-download the image continuously.
 */
export function Miniatura({
  mimeType,
  risolviUri,
}: {
  mimeType: string | null;
  risolviUri: () => Promise<string>;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const immagine = isImmagine(mimeType);
  const risolvi = useRef(risolviUri);

  useEffect(() => {
    if (!immagine) return;
    let attivo = true;
    risolvi
      .current()
      .then((u) => {
        if (attivo) setUri(u);
      })
      .catch(() => {
        /* ignore: the placeholder stays */
      });
    return () => {
      attivo = false;
    };
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

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
/** Zoom applied by a double tap, and the level above which one counts as "already zoomed". */
const ZOOM_DOPPIO_TAP = 2.5;
const DOPPIO_TAP_MS = 280;

function distanza(tocchi: { pageX: number; pageY: number }[]): number {
  const dx = tocchi[0].pageX - tocchi[1].pageX;
  const dy = tocchi[0].pageY - tocchi[1].pageY;
  return Math.hypot(dx, dy) || 1;
}

function limita(valore: number, minimo: number, massimo: number): number {
  return Math.min(massimo, Math.max(minimo, valore));
}

/**
 * Full-screen image viewer with pinch-to-zoom, drag while zoomed and
 * double-tap. Handles both local file:// and https uris.
 *
 * Gestures are built on PanResponder and Animated rather than on
 * react-native-gesture-handler: the app carries no gesture/reanimated native
 * module, and adding one for a viewer is exactly the kind of mixed-SDK native
 * dependency that already cost this project a launch crash.
 */
export function VisualizzatoreImmagine({
  uri,
  onChiudi,
}: {
  uri: string | null;
  onChiudi: () => void;
}) {
  /**
   * The Animated values, the gesture bookkeeping and the responder are built
   * together, once, in a single lazy initializer: the handlers need to read
   * and write the live transform synchronously, which neither Animated nor
   * React state offers, and keeping the mutable part inside this closure
   * means nothing mutable is read while rendering.
   */
  const [zoom] = useState(() => {
    const scala = new Animated.Value(1);
    const spostamento = new Animated.ValueXY({ x: 0, y: 0 });
    const stato = {
      scala: 1,
      x: 0,
      y: 0,
      // Snapshot taken when a gesture starts, so each move is relative to it.
      scalaIniziale: 1,
      xIniziale: 0,
      yIniziale: 0,
      distanzaIniziale: 0,
      pizzicando: false,
      ultimoTap: 0,
    };

    function applica(nuovaScala: number, x: number, y: number) {
      stato.scala = nuovaScala;
      stato.x = x;
      stato.y = y;
      scala.setValue(nuovaScala);
      spostamento.setValue({ x, y });
    }

    function reimposta() {
      applica(1, 0, 0);
    }

    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, gesto) =>
        stato.scala > 1 || Math.abs(gesto.dx) > 2 || Math.abs(gesto.dy) > 2,
      onPanResponderGrant: (e) => {
        const tocchi = e.nativeEvent.touches;
        stato.scalaIniziale = stato.scala;
        stato.xIniziale = stato.x;
        stato.yIniziale = stato.y;
        stato.pizzicando = tocchi.length >= 2;
        if (stato.pizzicando) stato.distanzaIniziale = distanza(tocchi);

        // Double tap: zoom in, or back out when already zoomed.
        const ora = Date.now();
        if (tocchi.length === 1) {
          if (ora - stato.ultimoTap < DOPPIO_TAP_MS) {
            stato.ultimoTap = 0;
            if (stato.scala > 1) reimposta();
            else applica(ZOOM_DOPPIO_TAP, 0, 0);
          } else {
            stato.ultimoTap = ora;
          }
        }
      },
      onPanResponderMove: (e, gesto) => {
        const tocchi = e.nativeEvent.touches;

        if (tocchi.length >= 2) {
          // A second finger landing mid-gesture restarts the measurement,
          // otherwise the image would jump by whatever the drag had moved.
          if (!stato.pizzicando) {
            stato.pizzicando = true;
            stato.distanzaIniziale = distanza(tocchi);
            stato.scalaIniziale = stato.scala;
            stato.xIniziale = stato.x;
            stato.yIniziale = stato.y;
          }
          const fattore = distanza(tocchi) / stato.distanzaIniziale;
          applica(
            limita(stato.scalaIniziale * fattore, ZOOM_MIN * 0.6, ZOOM_MAX),
            stato.xIniziale,
            stato.yIniziale
          );
          return;
        }

        stato.pizzicando = false;
        // Dragging is only meaningful once there is something off-screen.
        if (stato.scala <= 1) return;
        applica(stato.scala, stato.xIniziale + gesto.dx, stato.yIniziale + gesto.dy);
      },
      onPanResponderRelease: () => {
        stato.pizzicando = false;
        // Pinching below 1 is allowed during the gesture and springs back
        // after it: the rubber band is what makes "zoom out" feel finished.
        if (stato.scala < 1) {
          Animated.parallel([
            Animated.spring(scala, { toValue: 1, useNativeDriver: true }),
            Animated.spring(spostamento, { toValue: { x: 0, y: 0 }, useNativeDriver: true }),
          ]).start(() => applica(1, 0, 0));
        }
      },
    });

    return { scala, spostamento, responder, reimposta };
  });

  // A new image starts unzoomed: the previous one's transform would otherwise
  // show the next attachment already magnified and off-centre.
  useEffect(() => {
    if (uri) zoom.reimposta();
  }, [uri, zoom]);


  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onChiudi}>
      <View style={styles.viewerBg}>
        {uri ? (
          <Animated.View style={styles.viewerArea} {...zoom.responder.panHandlers}>
            <Animated.Image
              source={{ uri }}
              style={[
                styles.viewerImg,
                {
                  transform: [
                    { translateX: zoom.spostamento.x },
                    { translateY: zoom.spostamento.y },
                    { scale: zoom.scala },
                  ],
                },
              ]}
              resizeMode="contain"
            />
          </Animated.View>
        ) : null}
        <Text style={styles.viewerHint}>Pizzica o tocca due volte per ingrandire</Text>
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
  viewerArea: { width: "100%", height: "100%" },
  viewerImg: { width: "100%", height: "100%" },
  viewerHint: {
    position: "absolute",
    bottom: 40,
    color: "rgba(255,255,255,0.7)",
    fontSize: theme.font.small,
  },
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
