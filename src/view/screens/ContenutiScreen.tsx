/**
 * View — Contenuti: the recorded lessons and the readings.
 *
 * Two destinations became one with a segmented control inside it: video and
 * letture have the same frequency of use and the same nature, so they were
 * spending two of the four slots in the bar on one job.
 *
 * The thumbnails are the other change. The old cards all used the company logo,
 * six identical images for six different videos — a thumbnail whose only job is
 * letting you recognise the item in half a second and which was doing none of
 * it. Until real stills exist, the day number and a tint do that job.
 */
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Icona } from "@/view/theme/icone";
import {
  Barra,
  CampoRicerca,
  Scheda,
  Segmentato,
  TONI,
  Testo,
  Titolo,
  Vuoto,
} from "@/view/components/organic";
import { ALTEZZA_TAB_BAR } from "@/view/components/TabBar";
import {
  CONTENUTI,
  ETICHETTE_STATO,
  FILTRO_TUTTI,
  filtraContenuti,
  moduliDi,
  statoContenuto,
  type Contenuto,
  type TipoContenuto,
} from "@/model/contenuti/contenuti";

/**
 * Four tints, rotated by position.
 *
 * Not semantic — nothing about a video is "sage" — but stable per position in
 * the list, which is what makes two adjacent cards distinguishable at a glance.
 */
const TINTE = [
  { sfondo: TONI.salvia.tinta, inchiostro: TONI.salvia.inchiostro },
  { sfondo: TONI.accento.tinta, inchiostro: TONI.accento.inchiostro },
  // A step deeper than TONI.neutro: three of the four have a hue to be told
  // apart by, and the neutral one needs the extra weight to keep up.
  { sfondo: theme.ramp.neutral[300], inchiostro: TONI.neutro.inchiostro },
  { sfondo: theme.ramp.sage[300], inchiostro: TONI.salvia.inchiostro },
];

export function ContenutiScreen() {
  const [tipo, setTipo] = useState<TipoContenuto>("video");
  const [modulo, setModulo] = useState(FILTRO_TUTTI);
  const [query, setQuery] = useState("");

  const moduli = useMemo(() => moduliDi(tipo), [tipo]);
  const elenco = useMemo(
    () => filtraContenuti(tipo, modulo, query, CONTENUTI),
    [tipo, modulo, query]
  );

  function cambiaTipo(t: TipoContenuto) {
    setTipo(t);
    // The chips of the other tab do not exist here; keeping the old selection
    // would silently filter the new list down to nothing.
    setModulo(FILTRO_TUTTI);
  }

  return (
    <ScrollView contentContainerStyle={styles.contenuto} showsVerticalScrollIndicator={false}>
      <Segmentato<TipoContenuto>
        valore={tipo}
        onCambia={cambiaTipo}
        opzioni={[
          { valore: "video", label: "Video", icona: "video" },
          { valore: "lettura", label: "Letture", icona: "lettura" },
        ]}
      />

      <CampoRicerca
        valore={query}
        onCambia={setQuery}
        placeholder={tipo === "video" ? "Cerca un video" : "Cerca fra le letture"}
      />

      <View style={styles.chips}>
        {moduli.map((m) => {
          const attivo = m === modulo;
          return (
            <Pressable
              key={m}
              onPress={() => setModulo(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: attivo }}
              style={[styles.chip, attivo && styles.chipAttivo]}
            >
              <Testo
                size={theme.font.small}
                colore={attivo ? theme.colors.textOnInk : theme.colors.text}
              >
                {m}
              </Testo>
            </Pressable>
          );
        })}
      </View>

      {elenco.length === 0 ? (
        <Vuoto>Nessun contenuto con questi filtri</Vuoto>
      ) : (
        elenco.map((c, i) =>
          c.tipo === "video" ? (
            <CardVideo key={c.id} contenuto={c} indice={i} />
          ) : (
            <CardLettura key={c.id} contenuto={c} indice={i} />
          )
        )
      )}
    </ScrollView>
  );
}

function CardVideo({ contenuto, indice }: { contenuto: Contenuto; indice: number }) {
  const tinta = TINTE[indice % TINTE.length];
  const stato = statoContenuto(contenuto);
  return (
    <View style={styles.video}>
      <View style={[styles.miniatura, { backgroundColor: tinta.sfondo }]}>
        <Titolo size={34} colore={tinta.inchiostro} style={styles.sigla}>
          {contenuto.sigla}
        </Titolo>
        {/* One play affordance per card. The old ones carried two — an overlay
            and an icon in the footer — for the same tap. */}
        <View style={styles.play}>
          <Icona nome="play" size={17} color={theme.colors.text} />
        </View>
        {contenuto.durata ? (
          <View style={styles.durata}>
            <Testo size={theme.font.meta} colore={theme.colors.textOnInk}>
              {contenuto.durata}
            </Testo>
          </View>
        ) : null}
      </View>
      <View style={styles.piede}>
        <View style={styles.piedeTesti}>
          <Testo size={theme.font.body} forte numberOfLines={2}>
            {contenuto.titolo}
          </Testo>
          <Testo size={theme.font.meta} muto>
            {contenuto.meta}
          </Testo>
        </View>
        <View style={[styles.stato, statoSfondo(stato)]}>
          <Testo size={theme.font.meta} colore={statoInchiostro(stato)}>
            {ETICHETTE_STATO[stato]}
          </Testo>
        </View>
      </View>
    </View>
  );
}

function CardLettura({ contenuto, indice }: { contenuto: Contenuto; indice: number }) {
  const tinta = TINTE[indice % TINTE.length];
  const completata = contenuto.progresso >= 100;
  return (
    <Scheda style={styles.lettura}>
      <View style={[styles.dorso, { backgroundColor: tinta.sfondo }]}>
        <Titolo size={17} colore={tinta.inchiostro}>
          {contenuto.sigla}
        </Titolo>
      </View>
      <View style={styles.letturaTesti}>
        <Testo size={theme.font.body} forte numberOfLines={2}>
          {contenuto.titolo}
        </Testo>
        <Testo size={theme.font.small} muto>
          {contenuto.meta}
        </Testo>
        <View style={styles.progresso}>
          <View style={styles.barra}>
            <Barra
              percentuale={contenuto.progresso}
              colore={completata ? theme.colors.sage : theme.colors.accent}
            />
          </View>
          <Testo size={theme.font.meta} muto>
            {contenuto.progresso}%
          </Testo>
        </View>
      </View>
    </Scheda>
  );
}

function statoSfondo(stato: ReturnType<typeof statoContenuto>) {
  if (stato === "visto") return { backgroundColor: theme.ramp.neutral[200] };
  if (stato === "a-meta") return { backgroundColor: theme.ramp.accent[200] };
  return { backgroundColor: theme.ramp.sage[200] };
}

function statoInchiostro(stato: ReturnType<typeof statoContenuto>) {
  if (stato === "visto") return theme.colors.textMuted;
  if (stato === "a-meta") return theme.ramp.accent[700];
  return theme.ramp.sage[800];
}

const styles = StyleSheet.create({
  contenuto: { gap: theme.spacing.md, paddingBottom: ALTEZZA_TAB_BAR + theme.spacing.xxl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
  },
  chipAttivo: { backgroundColor: theme.colors.inkSurface },
  video: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  miniatura: { height: 132, alignItems: "center", justifyContent: "center" },
  sigla: { opacity: 0.75 },
  play: {
    position: "absolute",
    left: 12,
    top: 12,
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  durata: {
    position: "absolute",
    right: 12,
    bottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(28,37,63,0.82)",
  },
  piede: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  piedeTesti: { flex: 1, gap: 2 },
  stato: { borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  lettura: { flexDirection: "row", gap: theme.spacing.md },
  dorso: {
    width: 46,
    height: 60,
    borderTopLeftRadius: theme.radius.sm,
    borderBottomLeftRadius: theme.radius.sm,
    borderTopRightRadius: theme.radius.md,
    borderBottomRightRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  letturaTesti: { flex: 1, gap: 3 },
  progresso: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  barra: { flex: 1 },
});
