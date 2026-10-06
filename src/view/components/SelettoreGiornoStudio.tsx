/**
 * View — "Studiato il …" row of the creation form, with its calendar.
 *
 * Every review date is measured from this day, so it is asked for where the
 * ripasso is created rather than discovered later as a wrong schedule to fix
 * one date at a time. Only the day is chosen; the time of day stays the
 * current one (see `baseDaGiorno`).
 */
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { theme } from "@/view/theme/theme";
import { Button, Card } from "@/view/components/ui";
import { CalendarioGiorni } from "@/view/components/CalendarioGiorni";
import { SchedaModale } from "@/view/components/SchedaModale";
import { stessoGiorno } from "@/view/lib/calendarUtils";
import { etichettaRelativa } from "@/view/lib/format";

interface Props {
  giorno: Date;
  onCambia: (giorno: Date) => void;
  style?: ViewStyle;
}

export function SelettoreGiornoStudio({ giorno, onCambia, style }: Props) {
  const [aperto, setAperto] = useState(false);
  const oggi = stessoGiorno(giorno, new Date());

  return (
    <>
      <Card style={style}>
        <Pressable
          style={styles.riga}
          onPress={() => setAperto(true)}
          accessibilityRole="button"
          accessibilityLabel="Cambia la data dello studio"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.titolo}>Studiato il</Text>
            <Text style={styles.sotto}>
              {oggi
                ? "Oggi. Cambia giorno se l'hai studiato prima."
                : "Le date dei richiami partono da questo giorno."}
            </Text>
          </View>
          <Text style={styles.valore}>
            {etichettaRelativa(giorno.toISOString())} ›
          </Text>
        </Pressable>
      </Card>

      <SchedaModale visibile={aperto} onChiudi={() => setAperto(false)}>
        {aperto ? (
          <Contenuto
            giorno={giorno}
            onCambia={onCambia}
            onChiudi={() => setAperto(false)}
          />
        ) : null}
      </SchedaModale>
    </>
  );
}

/** Mounted only while open, so each opening starts from the saved day. */
function Contenuto({
  giorno,
  onCambia,
  onChiudi,
}: {
  giorno: Date;
  onCambia: (giorno: Date) => void;
  onChiudi: () => void;
}) {
  const [scelto, setScelto] = useState(giorno);

  return (
    <>
      <Text style={styles.modaleTitolo}>Quando l&apos;hai studiato?</Text>
      <Text style={styles.modaleSotto}>
        1 giorno, 1 settimana, 1 mese e 6 mesi si contano da qui.
      </Text>
      <CalendarioGiorni selezionata={scelto} onSeleziona={setScelto} />
      <View style={styles.azioni}>
        <Button
          label="Annulla"
          variant="ghost"
          onPress={onChiudi}
          style={{ flex: 1 }}
        />
        <Button
          label="Conferma"
          variant="accent"
          onPress={() => {
            onCambia(scelto);
            onChiudi();
          }}
          style={{ flex: 1 }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  riga: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  titolo: {
    fontSize: theme.font.body,
    fontWeight: "700",
    color: theme.colors.text,
  },
  sotto: { fontSize: theme.font.small, color: theme.colors.textMuted },
  valore: {
    fontSize: theme.font.body,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  modaleTitolo: {
    fontSize: theme.font.title,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  modaleSotto: {
    fontSize: theme.font.small,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  azioni: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
});
