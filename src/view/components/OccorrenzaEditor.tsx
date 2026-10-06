/**
 * View — modal to edit a single occurrence.
 *
 * Requirements:
 *  - pick the date from a CALENDAR (any day), not just ±1 day;
 *  - the reminder's time of day stays unchanged (only the day is edited);
 *  - dismiss by tapping OUTSIDE the card (backdrop), staying on the ripasso screen.
 *
 * Pure React Native calendar: no extra native dependency.
 */
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Badge, Button, Casella } from "@/view/components/ui";
import { formatData } from "@/view/lib/format";
import { ricalcolaSuccessive } from "@/model/ripassi/occorrenzeDates";
import { CalendarioGiorni } from "@/view/components/CalendarioGiorni";
import { SchedaModale } from "@/view/components/SchedaModale";
import { conGiornoDi, stessoGiorno } from "@/view/lib/calendarUtils";
import type { Occorrenza } from "@/model/types";

interface Props {
  /** Occurrence being edited; null = modal closed. */
  occorrenza: Occorrenza | null;
  /**
   * Every occurrence of the same ripasso. Only used to show what moving this
   * one would drag along: the shift itself is recomputed by the Controller.
   */
  occorrenze: readonly Occorrenza[];
  onChiudi: () => void;
  onSalvaData: (nuovaData: Date, aCascata: boolean) => void;
  onToggleCompletata: (completata: boolean) => void;
}

/**
 * The modal shell. The editing state lives one level down, in a component
 * keyed by the occurrence id: switching to a different occurrence remounts it,
 * which resets the selected day and the visible month without an effect that
 * writes state on every prop change.
 */
export function OccorrenzaEditor({
  occorrenza,
  occorrenze,
  onChiudi,
  onSalvaData,
  onToggleCompletata,
}: Props) {
  return (
    <SchedaModale visibile={occorrenza !== null} onChiudi={onChiudi}>
      {occorrenza ? (
        <ContenutoEditor
          key={occorrenza.id}
          occorrenza={occorrenza}
          occorrenze={occorrenze}
          onChiudi={onChiudi}
          onSalvaData={onSalvaData}
          onToggleCompletata={onToggleCompletata}
        />
      ) : null}
    </SchedaModale>
  );
}

function ContenutoEditor({
  occorrenza,
  occorrenze,
  onChiudi,
  onSalvaData,
  onToggleCompletata,
}: Props & { occorrenza: Occorrenza }) {
  const dataOriginale = useMemo(
    () => new Date(occorrenza.scheduled_at),
    [occorrenza.scheduled_at],
  );

  // Day selected in the calendar.
  const [selezionata, setSelezionata] = useState<Date>(dataOriginale);

  /**
   * Ticked by default. Correcting a date and leaving the following ones where
   * they were is almost never what was meant: the spacing exists to measure
   * distance from the study, so the whole tail normally has to follow. It stays
   * a choice for the case where only this one date is wrong.
   */
  const [aCascata, setACascata] = useState(true);

  // Only the day is edited; the reminder keeps its time of day.
  const nuovaData = useMemo(
    () => conGiornoDi(dataOriginale, selezionata),
    [dataOriginale, selezionata],
  );

  // What the tick would drag along. Recomputed by the Controller when saving:
  // this is here only to say how many dates are involved, and to hide the
  // checkbox entirely when the answer is none.
  const successive = useMemo(
    () => ricalcolaSuccessive(occorrenze, occorrenza.id, nuovaData),
    [occorrenze, occorrenza.id, nuovaData],
  );

  function salva() {
    onSalvaData(nuovaData, aCascata);
    onChiudi();
  }

  const modificata = !stessoGiorno(selezionata, dataOriginale);

  return (
    <>
      <Text style={styles.titolo}>Modifica ripasso</Text>
      <Text style={styles.sottotitolo}>
        {formatData(occorrenza.scheduled_at)}
      </Text>

      {/* Completed toggle */}
      <Button
        label={occorrenza.is_completed ? "Segna da fare" : "Segna completata"}
        variant={occorrenza.is_completed ? "ghost" : "accent"}
        onPress={() => {
          onToggleCompletata(!occorrenza.is_completed);
          onChiudi();
        }}
        style={{ marginBottom: theme.spacing.md }}
      />

      <CalendarioGiorni
        selezionata={selezionata}
        onSeleziona={setSelezionata}
      />

      {modificata ? (
        <View style={styles.anteprima}>
          <Badge label="Nuova data" tone="accent" />
          <Text style={styles.anteprimaTxt}>
            {formatData(nuovaData.toISOString())}
          </Text>
        </View>
      ) : null}

      {/* Hidden when nothing would follow: an unmoved date after this one,
              a completed one, or simply the last of the schedule. */}
      {modificata && successive.length > 0 ? (
        <Casella
          label="Sposta anche i ripassi successivi"
          sotto={
            successive.length === 1
              ? "La data successiva si sposta di altrettanto, mantenendo la distanza."
              : `Le ${successive.length} date successive si spostano di altrettanto, mantenendo le distanze.`
          }
          valore={aCascata}
          onCambia={setACascata}
          style={styles.cascata}
        />
      ) : null}

      <View style={styles.azioni}>
        <Button
          label="Annulla"
          variant="ghost"
          onPress={onChiudi}
          style={{ flex: 1 }}
        />
        <Button
          label="Salva data"
          variant="accent"
          onPress={salva}
          disabled={!modificata}
          style={{ flex: 1 }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  titolo: {
    fontSize: theme.font.title,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  sottotitolo: {
    fontSize: theme.font.small,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  anteprima: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  anteprimaTxt: {
    fontSize: theme.font.small,
    color: theme.colors.text,
    flexShrink: 1,
  },
  cascata: { marginTop: theme.spacing.md },
  azioni: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
});
