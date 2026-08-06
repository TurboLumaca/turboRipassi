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
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Badge, Button, Casella } from "@/view/components/ui";
import { formatData } from "@/view/lib/format";
import { ricalcolaSuccessive } from "@/model/ripassi/occorrenzeDates";
import {
  conGiornoDi,
  grigliaMese,
  INTESTAZIONI_GIORNI,
  NOMI_MESE,
  stessoGiorno,
} from "@/view/lib/calendarUtils";
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
    <Modal
      visible={occorrenza !== null}
      transparent
      animationType="fade"
      onRequestClose={onChiudi}
    >
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
    </Modal>
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
    [occorrenza.scheduled_at]
  );

  // Day selected in the calendar and the currently displayed month.
  const [selezionata, setSelezionata] = useState<Date>(dataOriginale);
  const [meseVisibile, setMeseVisibile] = useState<{ anno: number; mese: number }>({
    anno: dataOriginale.getFullYear(),
    mese: dataOriginale.getMonth(),
  });

  /**
   * Ticked by default. Correcting a date and leaving the following ones where
   * they were is almost never what was meant: the spacing exists to measure
   * distance from the study, so the whole tail normally has to follow. It stays
   * a choice for the case where only this one date is wrong.
   */
  const [aCascata, setACascata] = useState(true);

  const celle = useMemo(
    () => grigliaMese(meseVisibile.anno, meseVisibile.mese),
    [meseVisibile]
  );

  const oggi = new Date();

  // Only the day is edited; the reminder keeps its time of day.
  const nuovaData = useMemo(
    () => conGiornoDi(dataOriginale, selezionata),
    [dataOriginale, selezionata]
  );

  // What the tick would drag along. Recomputed by the Controller when saving:
  // this is here only to say how many dates are involved, and to hide the
  // checkbox entirely when the answer is none.
  const successive = useMemo(
    () => ricalcolaSuccessive(occorrenze, occorrenza.id, nuovaData),
    [occorrenze, occorrenza.id, nuovaData]
  );

  function cambiaMese(delta: number) {
    setMeseVisibile((m) => {
      const d = new Date(m.anno, m.mese + delta, 1);
      return { anno: d.getFullYear(), mese: d.getMonth() };
    });
  }

  function salva() {
    onSalvaData(nuovaData, aCascata);
    onChiudi();
  }

  const modificata = !stessoGiorno(selezionata, dataOriginale);

  return (
    <>
      {/* Backdrop: tapping here outside the card dismisses the modal (stays on the ripasso). */}
      <Pressable style={styles.backdrop} onPress={onChiudi}>
        {/* Card: intercepts the tap so it does NOT propagate to the backdrop. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.titolo}>Modifica ripasso</Text>
          <Text style={styles.sottotitolo}>{formatData(occorrenza.scheduled_at)}</Text>

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

          {/* Month header with arrows */}
          <View style={styles.headerMese}>
            <Pressable onPress={() => cambiaMese(-1)} hitSlop={12} style={styles.freccia}>
              <Text style={styles.frecciaTxt}>‹</Text>
            </Pressable>
            <Text style={styles.meseLabel}>
              {NOMI_MESE[meseVisibile.mese]} {meseVisibile.anno}
            </Text>
            <Pressable onPress={() => cambiaMese(1)} hitSlop={12} style={styles.freccia}>
              <Text style={styles.frecciaTxt}>›</Text>
            </Pressable>
          </View>

          {/* Day headers */}
          <View style={styles.settimana}>
            {INTESTAZIONI_GIORNI.map((g) => (
              <Text key={g} style={styles.intestGiorno}>
                {g}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.griglia}>
            {celle.map((c, i) => {
              const isSel = stessoGiorno(c.data, selezionata);
              const isOggi = stessoGiorno(c.data, oggi);
              return (
                <Pressable
                  key={i}
                  style={styles.cella}
                  onPress={() => setSelezionata(c.data)}
                >
                  <View style={[styles.cellaInner, isSel && styles.cellaSel]}>
                    <Text
                      style={[
                        styles.cellaTxt,
                        !c.nelMese && styles.cellaFuori,
                        isSel && styles.cellaTxtSel,
                        isOggi && !isSel && styles.cellaOggi,
                      ]}
                    >
                      {c.data.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {modificata ? (
            <View style={styles.anteprima}>
              <Badge label="Nuova data" tone="accent" />
              <Text style={styles.anteprimaTxt}>{formatData(nuovaData.toISOString())}</Text>
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
            <Button label="Annulla" variant="ghost" onPress={onChiudi} style={{ flex: 1 }} />
            <Button
              label="Salva data"
              variant="accent"
              onPress={salva}
              disabled={!modificata}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </>
  );
}

const CELLA = `${100 / 7}%`;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  titolo: { fontSize: theme.font.title, fontWeight: "800", color: theme.colors.primary },
  sottotitolo: {
    fontSize: theme.font.small,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  headerMese: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  freccia: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  frecciaTxt: { fontSize: 22, color: theme.colors.primary, fontWeight: "800", lineHeight: 24 },
  meseLabel: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.text },
  settimana: { flexDirection: "row" },
  intestGiorno: {
    width: CELLA as any,
    textAlign: "center",
    fontSize: theme.font.small,
    color: theme.colors.textMuted,
    fontWeight: "700",
    paddingVertical: theme.spacing.xs,
  },
  griglia: { flexDirection: "row", flexWrap: "wrap" },
  cella: { width: CELLA as any, aspectRatio: 1, padding: 2 },
  cellaInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
  },
  cellaSel: { backgroundColor: theme.colors.primary },
  cellaTxt: { fontSize: theme.font.body, color: theme.colors.text },
  cellaTxtSel: { color: theme.colors.textOnPrimary, fontWeight: "800" },
  cellaFuori: { color: theme.colors.completed },
  cellaOggi: { color: theme.colors.accentDark, fontWeight: "800" },
  anteprima: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  anteprimaTxt: { fontSize: theme.font.small, color: theme.colors.text, flexShrink: 1 },
  cascata: { marginTop: theme.spacing.md },
  azioni: { flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing.lg },
});
