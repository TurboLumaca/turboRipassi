/**
 * View — il countdown verso il Permanente: quattro tacche e una barra di tempo.
 *
 * È la struttura psicologica del pity timer — certezza annidata
 * nell'incertezza, countdown visibile, goal gradient — con l'uncino tolto.
 * Il premio in fondo è sicuro e reale, e quando arriva non si consuma: la
 * conoscenza resta. Nessuna delle due metà si può comprare.
 *
 * Il verbo è *maturare*, mai "salire di livello". La differenza non è di
 * tono: un livello è fabbricabile e vendibile, una maturazione è biologica e
 * l'unico modo di ottenerla è che passi il tempo.
 *
 * La metà dei giorni avanza da sola mentre l'app è chiusa, ed è la cosa più
 * vera e più insolita che questa schermata dice: il tempo sta lavorando
 * adesso, mentre non stai facendo niente.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Testo } from "@/view/components/organic";
import type { ProgressoMaturazione as Progresso } from "@/model/ripassi/capitaleMentaleLogic";

export function ProgressoMaturazione({
  progresso,
  compatto = false,
}: {
  progresso: Progresso;
  /** Nella riga di lista: solo le tacche e una cifra, senza spiegazioni. */
  compatto?: boolean;
}) {
  const {
    richiami,
    richiamiRichiesti,
    giorni,
    giorniRichiesti,
    livello,
    attendeRichiamoFinale,
  } = progresso;

  // Già permanente: il countdown ha finito di avere un senso, e lasciarlo
  // pieno sullo schermo sarebbe una barra che non misura più niente.
  if (livello === "permanente") return null;

  const richiamiFatti = Math.min(richiami, richiamiRichiesti);
  const giorniFatti = Math.min(giorni, giorniRichiesti);
  const quota = Math.round((giorniFatti / giorniRichiesti) * 100);

  return (
    <View
      style={compatto ? styles.compatto : styles.blocco}
      accessibilityLabel={
        `Maturazione: ${richiamiFatti} richiami su ${richiamiRichiesti}, ` +
        `${giorniFatti} giorni su ${giorniRichiesti}`
      }
    >
      <View style={styles.tacche}>
        {Array.from({ length: richiamiRichiesti }, (_, i) => (
          <View
            key={i}
            style={[styles.tacca, i < richiamiFatti && styles.taccaPiena]}
          />
        ))}
      </View>

      <Testo size={theme.font.meta} muto>
        {`${richiamiFatti}/${richiamiRichiesti} richiami · ${giorniFatti}/${giorniRichiesti} giorni`}
      </Testo>

      {compatto ? null : (
        <>
          <View style={styles.barra}>
            <View style={[styles.barraPiena, { width: `${quota}%` }]} />
          </View>
          <Testo size={theme.font.meta} muto style={styles.nota}>
            {attendeRichiamoFinale
              ? "I sei mesi sono passati: manca un richiamo, adesso, per chiudere la maturazione."
              : "La parte dei giorni avanza da sola: il tempo sta lavorando anche adesso."}
          </Testo>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blocco: { gap: 6 },
  compatto: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  tacche: { flexDirection: "row", gap: 4 },
  tacca: {
    width: 14,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border,
  },
  taccaPiena: { backgroundColor: theme.colors.accent },
  barra: {
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border,
    overflow: "hidden",
  },
  barraPiena: { height: "100%", backgroundColor: theme.ramp.sage[300] },
  nota: { fontStyle: "italic" },
});
