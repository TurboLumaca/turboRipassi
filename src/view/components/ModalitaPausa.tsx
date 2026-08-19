/**
 * View — ModalitaPausa: pannello per la gestione della pausa consapevole
 * (modalità riposo / viaggio) basata sull'autodeterminazione.
 */
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Chip, Pillola, Segmentato, Testo } from "@/view/components/organic";
import { useRipassiCtx } from "@/controller/RipassiContext";
import {
  creaConfigurazionePausa,
  type TipoDurataPausa,
} from "@/model/ripassi/pausaLogic";
import { formatDataBreve } from "@/view/lib/format";

type OpzioneDurata = "weekend" | "settimana" | "manuale";

export function ModalitaPausa() {
  const { pausa, attivaPausa, riprendiPausa } = useRipassiCtx();
  const [opzione, setOpzione] = useState<OpzioneDurata>("weekend");
  const [inCorso, setInCorso] = useState(false);

  async function gestisciAttivazione() {
    setInCorso(true);
    try {
      const config = creaConfigurazionePausa(opzione as TipoDurataPausa);
      await attivaPausa(config);
    } finally {
      setInCorso(false);
    }
  }

  async function gestisciRipresa() {
    setInCorso(true);
    try {
      await riprendiPausa();
    } finally {
      setInCorso(false);
    }
  }

  if (pausa.attiva) {
    return (
      <View style={styles.contenitore}>
        <View style={styles.rigaStato}>
          <Chip label="Modalità riposo attiva" tono="salvia" />
        </View>
        <Testo size={theme.font.body} colore={theme.colors.text}>
          {pausa.dataFine
            ? `I tuoi ripassi sono congelati fino al ${formatDataBreve(pausa.dataFine)}. I progressi sono protetti e non subiscono penalizzazioni.`
            : "I tuoi ripassi sono congelati fino alla tua riattivazione. I progressi sono protetti e non subiscono penalizzazioni."}
        </Testo>
        <Pillola
          label={inCorso ? "Ripresa in corso…" : "Riprendi i ripassi adesso"}
          onPress={() => void gestisciRipresa()}
          disabled={inCorso}
          style={styles.bottone}
        />
      </View>
    );
  }

  return (
    <View style={styles.contenitore}>
      <Testo size={theme.font.body} colore={theme.colors.text}>
        Hai un viaggio, un esame o un periodo di riposo? Congela i tuoi ripassi:
        le scadenze slitteranno dei giorni effettivi senza accumulare arretrati né
        perdere il ritmo.
      </Testo>

      <Segmentato<OpzioneDurata>
        valore={opzione}
        onCambia={setOpzione}
        opzioni={[
          { valore: "weekend", label: "Weekend" },
          { valore: "settimana", label: "1 settimana" },
          { valore: "manuale", label: "Aperta" },
        ]}
      />

      <Pillola
        label={inCorso ? "Attivazione…" : "Attiva modalità riposo"}
        onPress={() => void gestisciAttivazione()}
        disabled={inCorso}
        style={styles.bottone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenitore: { gap: theme.spacing.md },
  rigaStato: { flexDirection: "row", alignItems: "center" },
  bottone: { marginTop: theme.spacing.xs },
});
