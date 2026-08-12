/**
 * View — the two things the home screen has to say about what is *not* where
 * the user expects it to be.
 *
 * Both used to be counts, and a count is the wrong answer to both questions.
 * "3 allegati non sono disponibili offline" tells someone about to get on a
 * train that something is wrong without telling them which ripasso to open
 * while they still have a connection; naming them is the whole point.
 *
 * The list is capped rather than scrolled: this sits above the ripassi, and a
 * banner that can grow to twenty lines stops being a banner. Past the cap the
 * remainder is counted, which is the one place a number is the right answer.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import type { DaCaricare } from "@/model/outbox/codaLogic";
import type { RipassoNonDisponibile } from "@/model/cache/cacheLogic";

/** Titles shown before the rest becomes "e altri N". */
const MAX_TITOLI = 3;

/** Renders up to MAX_TITOLI names, then says how many were left out. */
function Elenco({ titoli }: { titoli: string[] }) {
  const mostrati = titoli.slice(0, MAX_TITOLI);
  const restanti = titoli.length - mostrati.length;
  return (
    <>
      {mostrati.map((t, i) => (
        <Text key={`${t}-${i}`} style={styles.voce} numberOfLines={1}>
          • {t}
        </Text>
      ))}
      {restanti > 0 ? (
        <Text style={styles.voce}>
          {restanti === 1 ? "e un altro" : `e altri ${restanti}`}
        </Text>
      ) : null}
    </>
  );
}

/**
 * What is still on this device only.
 *
 * The wording separates the two halves on purpose. A ripasso that has never
 * reached the server is at risk in a way a missing attachment is not — losing
 * the phone loses it — while a ripasso whose row is up and whose photo is not
 * is merely incomplete. Saying "non caricato" about both would either alarm
 * about the second or understate the first.
 */
export function AvvisoDaCaricare({
  voci,
  sincronizzando,
  bloccoDrive,
  onCaricaOra,
}: {
  voci: DaCaricare[];
  sincronizzando: boolean;
  bloccoDrive: boolean;
  onCaricaOra: () => void;
}) {
  if (voci.length === 0) return null;

  const bloccati = voci.filter((v) => v.bloccatoPer !== null);

  return (
    <View style={[styles.banner, styles.bannerAttesa]} accessibilityRole="summary">
      <Text style={styles.titolo}>
        {voci.length === 1
          ? "1 ripasso non è ancora su Google Drive"
          : `${voci.length} ripassi non sono ancora su Google Drive`}
      </Text>

      {voci.slice(0, MAX_TITOLI).map((v) => (
        <Text key={v.id} style={styles.voce} numberOfLines={1}>
          • {v.titolo} — {descrivi(v)}
        </Text>
      ))}
      {voci.length > MAX_TITOLI ? (
        <Text style={styles.voce}>{`e altri ${voci.length - MAX_TITOLI}`}</Text>
      ) : null}

      {bloccoDrive ? (
        <Text style={styles.nota}>
          {"Serve l'accesso a Google Drive per caricare gli allegati."}
        </Text>
      ) : bloccati.length > 0 ? (
        // The reason is already translated by the error table: shown as-is
        // because "riprova più tardi" would be advice that cannot work — these
        // are the entries that stopped being retried precisely because waiting
        // is not what they need.
        <Text style={styles.nota}>{bloccati[0].bloccatoPer}</Text>
      ) : (
        <Text style={styles.nota}>
          {"Li carico da solo appena c'è connessione. Puoi chiudere l'app."}
        </Text>
      )}

      <Pressable
        onPress={onCaricaOra}
        disabled={sincronizzando}
        accessibilityRole="button"
        style={styles.azione}
      >
        <Text style={[styles.azioneTesto, sincronizzando && styles.azioneSpenta]}>
          {sincronizzando ? "Caricamento in corso…" : "Carica ora ›"}
        </Text>
      </Pressable>
    </View>
  );
}

/** The half-sentence after a title: what exactly is missing for that ripasso. */
function descrivi(v: DaCaricare): string {
  const parti: string[] = [];
  if (v.ripassoNuovo) parti.push("solo su questo dispositivo");
  else if (v.campiDaSalvare) parti.push("modifiche non inviate");
  if (v.allegatiMancanti === 1) parti.push("1 allegato da caricare");
  else if (v.allegatiMancanti > 1) parti.push(`${v.allegatiMancanti} allegati da caricare`);
  return parti.join(", ");
}

/**
 * What cannot be read on a train.
 *
 * Only ever about the three days the app keeps locally: everything older is
 * expected to need a connection, and saying so about the whole storico would
 * bury the three lines that matter.
 */
export function AvvisoNonDisponibili({ voci }: { voci: RipassoNonDisponibile[] }) {
  if (voci.length === 0) return null;

  return (
    <View style={styles.banner} accessibilityRole="summary">
      <Text style={styles.titolo}>
        {voci.length === 1
          ? "1 ripasso di questi giorni non è disponibile offline"
          : `${voci.length} ripassi di questi giorni non sono disponibili offline`}
      </Text>
      <Elenco
        titoli={voci.map((v) =>
          v.mancanti === v.totali
            ? `${v.titolo} — nessun allegato scaricato`
            : `${v.titolo} — ${v.mancanti} allegati su ${v.totali} da scaricare`
        )}
      />
      <Text style={styles.nota}>
        {"Aprili ora, finché hai connessione: gli allegati restano poi sul dispositivo."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 2,
  },
  // Waiting to be uploaded is the more urgent of the two — the data exists
  // nowhere else — so it borrows the accent the app uses for today's rows.
  bannerAttesa: {
    backgroundColor: theme.colors.surfaceToday,
    borderColor: theme.colors.borderToday,
  },
  titolo: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: "700" },
  voce: { color: theme.colors.textMuted, fontSize: theme.font.small },
  nota: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    fontStyle: "italic",
    marginTop: 2,
  },
  azione: { paddingTop: theme.spacing.xs },
  azioneTesto: { color: theme.colors.primary, fontSize: theme.font.small, fontWeight: "700" },
  azioneSpenta: { color: theme.colors.textMuted },
});
