/**
 * View — Aiuto: le domande che l'app si sente fare, con la risposta sotto.
 *
 * Testo statico, nessuna chiamata di rete: sono le cose che l'interfaccia da
 * sola non riesce a dire — perché Drive chiede di nuovo il consenso, perché i
 * ripassi sono gli stessi con due modi di accedere, cosa resta leggibile
 * offline, cosa succede a un allegato che non è arrivato. Sono anche i punti
 * su cui una segnalazione arriverebbe altrimenti scritta come «non funziona».
 *
 * Una domanda alla volta: aprirne una chiude quella prima. Le risposte sono
 * lunghe qualche riga, e con tutte aperte la sezione diventerebbe un muro di
 * testo in cui la domanda che interessa non si trova più.
 */
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { TestataATendina } from "@/view/components/ui";

interface VoceAiuto {
  domanda: string;
  risposta: string;
}

const DOMANDE: VoceAiuto[] = [
  {
    domanda: "Come funziona il collegamento a Google Drive?",
    risposta:
      "Gli allegati non stanno sui nostri server: vengono caricati sul tuo Google Drive, " +
      "in una cartella chiamata ripassiProgrammati. La prima volta che allegi qualcosa " +
      "l'app ti chiede il permesso, e chiede solo quello di gestire i file che crea lei: " +
      "il resto del tuo Drive non le è visibile. Puoi collegarlo anche prima, da questa " +
      "schermata, nella sezione Google Drive.",
  },
  {
    domanda: "Perché mi richiede l'accesso a Drive che avevo già dato?",
    risposta:
      "Il permesso è un'autorizzazione a scadenza, e può anche essere revocata dal tuo " +
      "account Google. Quando succede l'app non può più leggere né scrivere gli allegati, " +
      "e l'unica cosa che serve è ridare il consenso: nessun file viene perso, restano " +
      "dove sono sul tuo Drive.",
  },
  {
    domanda: "Sono entrato con Google invece che con la password: ritrovo i miei ripassi?",
    risposta:
      "Sì. I ripassi sono legati al tuo account, non al modo in cui entri: con lo stesso " +
      "indirizzo email verificato ritrovi gli stessi ripassi sia digitando la password " +
      "sia toccando «Continua con Google». Nella sezione Accesso puoi collegare Google " +
      "all'account che usi già, così la prossima volta basta un tocco. Un indirizzo " +
      "diverso è invece un altro account, con i suoi ripassi.",
  },
  {
    domanda: "L'app funziona senza connessione?",
    risposta:
      "In lettura sì. I ripassi già scaricati restano consultabili, e gli allegati dei " +
      "ripassi di ieri, oggi e domani vengono tenuti sul dispositivo apposta per quando " +
      "la connessione non c'è. Se qualcuno di quei file non è stato scaricato, la Home te " +
      "lo dice invece di lasciartelo scoprire in treno. Per creare, modificare o " +
      "completare un ripasso serve invece la rete: le modifiche non vengono messe in coda.",
  },
  {
    domanda: "Cosa succede se il caricamento di un allegato non riesce?",
    risposta:
      "Il ripasso viene salvato lo stesso, e i file che non sono arrivati restano nella " +
      "schermata, in attesa: tocca di nuovo Salva e riparte solo quello che manca. Non " +
      "sparisce niente in silenzio, e non ti tocca ricercare le foto nella galleria.",
  },
  {
    domanda: "Cosa succede quando esco dall'account?",
    risposta:
      "Vengono cancellati dal dispositivo gli allegati tenuti da parte per l'uso offline " +
      "e il permesso di accedere a Drive. I ripassi e i file su Drive restano dove sono: " +
      "rientrando con lo stesso indirizzo ritrovi tutto, e la copia offline si ricostruisce " +
      "da sola.",
  },
];

export function Aiuto() {
  const [aperta, setAperta] = useState<string | null>(null);

  return (
    <View>
      {DOMANDE.map(({ domanda, risposta }) => (
        <View key={domanda} style={styles.voce}>
          <TestataATendina
            titolo={domanda}
            aperto={aperta === domanda}
            onPremi={() => setAperta((precedente) => (precedente === domanda ? null : domanda))}
          />
          {aperta === domanda ? <Text style={styles.risposta}>{risposta}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  voce: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.xs,
  },
  risposta: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    lineHeight: 20,
    paddingBottom: theme.spacing.md,
  },
});
