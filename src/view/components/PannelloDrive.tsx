/**
 * View — where attachments end up: the linked Google account and the Drive
 * folder they are written to.
 *
 * The second section of the Profilo screen. It answers a question the user
 * asks occasionally ("which account is this saving to?"), which is why it is
 * not on the Home competing with the reviews for attention.
 *
 * The account is fetched on mount rather than on expand. It amounts to the
 * same restraint as the collapsed panel this replaces — the request happens
 * when someone opens Profilo, not while they are reading their reviews — with
 * one tap less to get the answer.
 */
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Button, Voce } from "@/view/components/ui";
import { useAuthCtx } from "@/controller/AuthContext";
import { useAccountDrive } from "@/controller/auth/useAccountDrive";

export function PannelloDrive() {
  const { autorizzaDrive } = useAuthCtx();
  const { stato, aggiorna } = useAccountDrive();

  useEffect(() => {
    // `void`: aggiorna() reports and stores its own failures as a state of the
    // section, so there is nothing left for this caller to handle. The marker
    // says the promise is ignored on purpose, not by oversight.
    void aggiorna();
  }, [aggiorna]);

  async function collega() {
    if (await autorizzaDrive()) await aggiorna();
  }

  return (
    <View style={styles.root}>
      {/* "ignoto" is the instant between mount and the effect firing: showing
          the spinner there too avoids a blank frame on every visit. */}
      {stato.stato === "caricamento" || stato.stato === "ignoto" ? (
        <ActivityIndicator color={theme.colors.textMuted} />
      ) : stato.stato === "collegato" ? (
        <>
          <Voce etichetta="Account" valore={stato.account.email ?? "—"} />
          {stato.account.nome ? (
            <Voce etichetta="Intestato a" valore={stato.account.nome} />
          ) : null}
          <Voce etichetta="Cartella" valore={stato.account.cartella} />
        </>
      ) : stato.stato === "errore" ? (
        <Text style={styles.errore}>{stato.messaggio}</Text>
      ) : stato.stato === "nonCollegato" ? (
        <>
          <Text style={styles.nota}>
            Gli allegati vengono salvati sul tuo Google Drive. Collega un account per
            aggiungerli.
          </Text>
          <Button label="Collega Google Drive" variant="ghost" onPress={collega} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: theme.spacing.sm },
  nota: { color: theme.colors.textMuted, fontSize: theme.font.small },
  errore: { color: theme.colors.danger, fontSize: theme.font.small },
});
