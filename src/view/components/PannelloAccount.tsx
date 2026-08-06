/**
 * View — how the user gets into their account, and what that account is.
 *
 * One of the two sections of the Profilo screen, next to PannelloDrive. The
 * two answer different questions and are deliberately not merged — this one is
 * about signing in, PannelloDrive is about where attachment files are written.
 *
 * It used to be a collapsed line at the bottom of the Home, opened on demand:
 * the screen it now lives on is itself the thing you have to go looking for,
 * so collapsing it a second time only added a tap to reach what the reader
 * came for.
 *
 * The note about ripassi being tied to the account rather than the sign-in
 * method is the point of the section, not decoration: someone who has been
 * signing in two ways has every reason to expect two separate sets of reviews,
 * and this is where they find out they do not.
 */
import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Button, Voce } from "@/view/components/ui";
import { useAuthCtx } from "@/controller/AuthContext";

export function PannelloAccount() {
  const { session, googleCollegato, collegaGoogle, error } = useAuthCtx();
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
      <Voce etichetta="Email" valore={email} />
      <Voce
        etichetta="Metodi"
        valore={googleCollegato ? "Email e Google" : "Email e password"}
      />

      <Text style={styles.nota}>
        I ripassi sono legati al tuo account, non al modo in cui entri: con lo stesso
        indirizzo email verificato ritrovi gli stessi ripassi sia con la password sia con
        Google.
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
  );
}

const styles = StyleSheet.create({
  root: { gap: theme.spacing.sm },
  nota: { color: theme.colors.textMuted, fontSize: theme.font.small },
  errore: { color: theme.colors.danger, fontSize: theme.font.small },
});
