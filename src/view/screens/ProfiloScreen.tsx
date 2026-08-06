/**
 * View — Profilo: the account, Google Drive, and the way out.
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
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Button, Card, SectionTitle } from "@/view/components/ui";
import { PannelloAccount } from "@/view/components/PannelloAccount";
import { PannelloDrive } from "@/view/components/PannelloDrive";
import { useAuthCtx } from "@/controller/AuthContext";

export function ProfiloScreen() {
  const { session, driveAutorizzato, signOut } = useAuthCtx();

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
  separatore: { height: theme.spacing.lg },
});
