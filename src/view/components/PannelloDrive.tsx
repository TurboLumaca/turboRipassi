/**
 * View — where attachments end up: the linked Google account and the Drive
 * folder they are written to.
 *
 * Deliberately quiet. It sits at the bottom of the list, collapsed to a
 * single muted line, and only fetches the account when opened: it answers a
 * question the user asks occasionally ("which account is this saving to?")
 * and should not compete with the reviews for attention.
 */
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Button } from "@/view/components/ui";
import { useAuthCtx } from "@/controller/AuthContext";
import { useAccountDrive } from "@/controller/auth/useAccountDrive";

export function PannelloDrive() {
  const { driveAutorizzato, autorizzaDrive } = useAuthCtx();
  const { stato, aggiorna } = useAccountDrive();
  const [aperto, setAperto] = useState(false);

  function commuta() {
    const prossimo = !aperto;
    setAperto(prossimo);
    if (prossimo) aggiorna();
  }

  async function collega() {
    if (await autorizzaDrive()) await aggiorna();
  }

  return (
    <View style={styles.root}>
      <Pressable onPress={commuta} hitSlop={8}>
        <Text style={styles.riepilogo}>
          {aperto ? "▾" : "▸"} Google Drive ·{" "}
          {driveAutorizzato ? "collegato" : "non collegato"}
        </Text>
      </Pressable>

      {aperto ? (
        <View style={styles.dettaglio}>
          {stato.stato === "caricamento" ? (
            <ActivityIndicator color={theme.colors.textMuted} />
          ) : stato.stato === "collegato" ? (
            <>
              <Voce etichetta="Account" valore={stato.account.email ?? "—"} />
              {stato.account.nome ? <Voce etichetta="Intestato a" valore={stato.account.nome} /> : null}
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
      ) : null}
    </View>
  );
}

function Voce({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <View style={styles.voce}>
      <Text style={styles.etichetta}>{etichetta}</Text>
      <Text style={styles.valore} numberOfLines={1}>
        {valore}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: theme.spacing.xl, gap: theme.spacing.sm },
  riepilogo: { color: theme.colors.textMuted, fontSize: theme.font.small },
  dettaglio: {
    gap: theme.spacing.sm,
    paddingLeft: theme.spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.border,
  },
  voce: { flexDirection: "row", gap: theme.spacing.sm },
  etichetta: { color: theme.colors.textMuted, fontSize: theme.font.small, width: 88 },
  valore: { flex: 1, color: theme.colors.text, fontSize: theme.font.small },
  nota: { color: theme.colors.textMuted, fontSize: theme.font.small },
  errore: { color: theme.colors.danger, fontSize: theme.font.small },
});
