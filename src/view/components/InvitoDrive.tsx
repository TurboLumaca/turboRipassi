/**
 * View — the Google Drive invitation shown right after signing in.
 *
 * Attachments live on the user's Drive, and the consent used to be asked only
 * at the first upload — in the middle of saving a ripasso. Asking once, at the
 * door, gets the whole setup done before the user has anything to lose. It is
 * an invitation, not a gate: "Più tardi" closes it for this launch, and
 * Profilo keeps the same button for whenever they change their mind.
 */
import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Button } from "@/view/components/ui";
import { useInvitoDrive } from "@/controller/auth/useInvitoDrive";

export function InvitoDrive() {
  const { visibile, inCorso, confermato, collega, rimanda } = useInvitoDrive();

  return (
    <Modal visible={visibile} transparent animationType="fade" onRequestClose={rimanda}>
      <View style={styles.velo}>
        <View style={styles.scheda}>
          <Text style={styles.titolo}>
            {confermato ? "Google Drive collegato" : "Collega Google Drive"}
          </Text>
          <Text style={confermato ? styles.conferma : styles.testo}>
            {confermato
              ? "✓ Tutto pronto: gli allegati dei tuoi ripassi finiranno qui."
              : "Gli allegati dei tuoi ripassi vengono salvati sul tuo Google Drive, in una cartella dedicata. Collegalo ora così è tutto pronto quando ti serve."}
          </Text>
          {confermato ? null : (
            <>
              <Button
                label="Collega Google Drive"
                variant="accent"
                onPress={collega}
                loading={inCorso}
              />
              <Button label="Più tardi" variant="ghost" onPress={rimanda} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  velo: {
    flex: 1,
    backgroundColor: "rgba(17, 26, 46, 0.55)",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  scheda: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  titolo: {
    fontFamily: theme.family.heading,
    fontSize: theme.font.heading,
    color: theme.colors.text,
  },
  testo: {
    fontFamily: theme.family.body,
    fontSize: theme.font.body,
    color: theme.colors.textMuted,
  },
  conferma: {
    fontFamily: theme.family.body,
    fontSize: theme.font.body,
    color: theme.colors.primary,
  },
});
