/**
 * View — il messaggio che segue la creazione di un concetto.
 *
 * Endowed progress: la tessera fedeltà con due timbri già messi in regalo ha
 * raddoppiato il tasso di completamento rispetto a quella da zero (Nunes &
 * Drèze, 2006). Qui il timbro regalato corrisponde a una cosa vera — scrivere
 * il concetto e incontrarlo *è* il primo incontro — e la data del secondo è
 * già sul calendario mentre si legge la frase. È l'unica forma di progresso
 * donato che non chiede di credere a niente.
 *
 * Una volta sola per concetto, e nessun pulsante che riporti indietro:
 * l'unico gesto disponibile chiude e torna alla lista.
 */
import React from "react";
import { Modal, StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Icona } from "@/view/theme/icone";
import { Kicker, Pillola, Testo, Titolo } from "@/view/components/organic";
import { etichettaRelativa, formatDataBreve } from "@/view/lib/format";

export function PrimoPasso({
  prossimoRichiamo,
  onChiudi,
}: {
  prossimoRichiamo: string | null;
  onChiudi: () => void;
}) {
  if (prossimoRichiamo === null) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onChiudi}>
      <View style={styles.velo}>
        <View style={styles.scheda}>
          <View style={styles.segno}>
            <Icona nome="memoria" size={22} color={theme.colors.accentInk} />
          </View>

          <Kicker colore={theme.colors.accent}>Primo passo verso il Permanente</Kicker>
          <Titolo size={22} style={styles.centrato}>
            Fatto: 1 richiamo su 4.
          </Titolo>

          <Testo size={theme.font.body} muto style={styles.centrato}>
            {`Il prossimo è ${etichettaRelativa(prossimoRichiamo)}, il ${formatDataBreve(prossimoRichiamo)}. Da adesso il tempo lavora per te, anche quando l'app è chiusa.`}
          </Testo>

          <Pillola label="Torna alla lista" onPress={onChiudi} style={styles.bottone} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  velo: {
    flex: 1,
    backgroundColor: "rgba(17,26,46,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  scheda: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  segno: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
  },
  centrato: { textAlign: "center" },
  bottone: { marginTop: theme.spacing.lg, minWidth: 200 },
});
