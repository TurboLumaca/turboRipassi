/**
 * View — Profilo: the account, Google Drive, the answers to the questions the
 * interface cannot give on its own, the way to report a problem, and the way
 * out.
 *
 * These three used to live on the Home: two collapsed panels under the list
 * and an "Esci" link in the top bar. All three are things you deal with once
 * and then never again, and they were sitting on the screen you open twenty
 * times a day — with the sign-out link one mis-tap away from the title.
 *
 * Now they are one tap behind the avatar in the top bar: still reachable
 * without hunting, no longer in the way, and "Esci" is somewhere you have to
 * mean to go.
 */
import React from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Button, Card, SectionTitle } from "@/view/components/ui";
import { PannelloAccount } from "@/view/components/PannelloAccount";
import { PannelloDrive } from "@/view/components/PannelloDrive";
import { ModalitaPausa } from "@/view/components/ModalitaPausa";
import { SegnalaProblema } from "@/view/components/SegnalaProblema";
import { Aiuto } from "@/view/components/Aiuto";
import { CapitaleMentaleCard } from "@/view/components/CapitaleMentaleCard";
import { PatrimonioGallery } from "@/view/components/PatrimonioGallery";
import { TempoRisparmiatoStat } from "@/view/components/TempoRisparmiatoStat";
import { useAuthCtx } from "@/controller/AuthContext";
import { useImpostazioniCtx } from "@/controller/ImpostazioniContext";

export function ProfiloScreen() {
  const { session, driveAutorizzato, signOut } = useAuthCtx();
  const { impostazioni, salvaImpostazioni } = useImpostazioniCtx();

  /**
   * Signing out is not destructive — nothing is stored only on the device —
   * but it is a wall between the user and their reviews until they type a
   * password again, which is worth one deliberate tap.
   */
  function confermaUscita() {
    Alert.alert("Uscire dall'account?", "Per rientrare dovrai accedere di nuovo.", [
      { text: "Annulla", style: "cancel" },
      { text: "Esci", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.email}>{session?.user.email ?? "—"}</Text>

      {/* Il patrimonio per primo: è la cifra che dice chi si è diventati, e
          la distribuzione sotto è come ci si è arrivati. L'ordine inverso
          avrebbe messo il processo davanti al risultato. */}
      <PatrimonioGallery />
      <CapitaleMentaleCard />
      <TempoRisparmiatoStat />

      {/* First, because it is the setting the rest of the app reads: which
          phase every other screen draws follows from this date. */}
      

      <SectionTitle>Impostazioni</SectionTitle>
      <Card style={styles.sezione}>
        <View style={styles.rigaImpostazione}>
          <View style={styles.testiImpostazione}>
            <Text style={styles.titoloImpostazione}>Domanda al richiamo</Text>
            <Text style={styles.sottoImpostazione}>
              Quando spunti un ripasso, prima mostra la domanda e la risposta.
              Disattivala per confermare col solo tondino.
            </Text>
          </View>
          <Switch
            value={impostazioni.chiediDomandaAlRichiamo}
            onValueChange={(v) => salvaImpostazioni({ chiediDomandaAlRichiamo: v })}
            trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
            thumbColor={theme.colors.surface}
          />
        </View>
      </Card>

      <SectionTitle>Modalità Riposo & Viaggi</SectionTitle>
      <Card style={styles.sezione}>
        <ModalitaPausa />
      </Card>

      <SectionTitle>Accesso</SectionTitle>
      <Card style={styles.sezione}>
        <PannelloAccount />
      </Card>

      <SectionTitle>
        Google Drive · {driveAutorizzato ? "collegato" : "non collegato"}
      </SectionTitle>
      <Card style={styles.sezione}>
        <PannelloDrive />
      </Card>

      <SectionTitle>Aiuto</SectionTitle>
      <Card style={styles.sezione}>
        <Aiuto />
      </Card>

      {/* Un errore gestito lo vede solo chi ce l'ha davanti: da qui puo'
          raccontarlo a chi puo' farci qualcosa. Dopo l'Aiuto di proposito:
          buona parte di cio' che si segnalerebbe ha una risposta qui sopra. */}
      <SectionTitle>Assistenza</SectionTitle>
      <Card style={styles.sezione}>
        <SegnalaProblema />
      </Card>

      <View style={styles.separatore} />
      <Button label="Esci" variant="danger" onPress={confermaUscita} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  email: {
    fontSize: theme.font.title,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  sezione: { marginBottom: theme.spacing.lg },
  rigaImpostazione: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  testiImpostazione: { flex: 1, gap: 2 },
  titoloImpostazione: {
    fontSize: theme.font.body,
    fontWeight: "700",
    color: theme.colors.text,
  },
  sottoImpostazione: {
    fontSize: theme.font.small,
    color: theme.colors.textMuted,
  },
  separatore: { height: theme.spacing.lg },
});
