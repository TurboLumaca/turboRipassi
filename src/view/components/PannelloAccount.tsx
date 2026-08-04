/**
 * View — how the user gets into their account, and what that account is.
 *
 * Sits next to PannelloDrive and behaves the same way: one muted line,
 * collapsed, opened on demand. The two answer different questions and are
 * deliberately not merged — this one is about signing in, PannelloDrive is
 * about where attachment files are written.
 *
 * The note about ripassi being tied to the account rather than the sign-in
 * method is the point of the panel, not decoration: someone who has been
 * signing in two ways has every reason to expect two separate sets of
 * reviews, and this is where they find out they do not.
 */
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Button } from "@/view/components/ui";
import { useAuthCtx } from "@/controller/AuthContext";

export function PannelloAccount() {
  const { session, googleCollegato, collegaGoogle, error } = useAuthCtx();
  const [aperto, setAperto] = useState(false);
  const [inCorso, setInCorso] = useState(false);

  async function collega() {
    setInCorso(true);
    try {
      await collegaGoogle();
    } finally {
      setInCorso(false);
    }
  }

  const email = session?.user.email ?? "—";

  return (
    <View style={styles.root}>
      <Pressable onPress={() => setAperto(!aperto)} hitSlop={8}>
        <Text style={styles.riepilogo}>
          {aperto ? "▾" : "▸"} Accesso · {email}
        </Text>
      </Pressable>

      {aperto ? (
        <View style={styles.dettaglio}>
          <Voce etichetta="Email" valore={email} />
          <Voce
            etichetta="Metodi"
            valore={googleCollegato ? "Email e Google" : "Email e password"}
          />

          <Text style={styles.nota}>
            I ripassi sono legati al tuo account, non al modo in cui entri: con lo stesso
            indirizzo email verificato ritrovi gli stessi ripassi sia con la password sia
            con Google.
          </Text>

          {!googleCollegato ? (
            <>
              <Text style={styles.nota}>
                Collega Google per accedere con un tocco, senza digitare la password.
              </Text>
              {inCorso ? (
                <ActivityIndicator color={theme.colors.textMuted} />
              ) : (
                <Button label="Collega Google" variant="ghost" onPress={collega} />
              )}
            </>
          ) : null}

          {error ? <Text style={styles.errore}>{error}</Text> : null}
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
