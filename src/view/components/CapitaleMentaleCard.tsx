/**
 * View — Capitale Mentale & Conoscenza Permanente (Endowment Effect & Identity Shift).
 *
 * Replaces toxic consecutive-day streak counters with a non-judgmental, cumulative
 * view of permanent mental assets that are safely retained long-term.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Card } from "@/view/components/ui";
import { Icona } from "@/view/theme/icone";
import { Kicker, Testo } from "@/view/components/organic";
import { useCapitaleMentale } from "@/controller/ripassi/useCapitaleMentale";
import type { StatisticheCapitaleMentale } from "@/model/ripassi/capitaleMentaleLogic";

export function CapitaleMentaleCard({
  statistiche: customStats,
}: {
  statistiche?: StatisticheCapitaleMentale;
}) {
  const hookStats = useCapitaleMentale();
  const stats = customStats ?? hookStats;

  const {
    totaleVoci,
    totalePermanenti,
    totaleInConsolidamento,
    totaleNuovi,
  } = stats;

  const testoPermanenti =
    totalePermanenti === 1
      ? "1 nozione stabile a lungo termine"
      : `${totalePermanenti} nozioni stabili a lungo termine`;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconaContenitore}>
          <Icona nome="memoria" size={20} color={theme.colors.sage} />
        </View>
        <View style={styles.titoloColonna}>
          <Kicker>Patrimonio di Conoscenza</Kicker>
          <Testo size={theme.font.body} forte>
            {totalePermanenti > 0
              ? `${totalePermanenti} ${totalePermanenti === 1 ? "concetto permanente" : "concetti permanenti"}`
              : "La tua cassaforte mentale"}
          </Testo>
        </View>
      </View>

      {/* Main counter */}
      <View style={styles.contatoreBlocco}>
        <Testo size={theme.font.large} forte style={styles.numeroGrande}>
          {String(totalePermanenti)}
        </Testo>
        <Testo size={theme.font.small} muto style={styles.etichettaContatore}>
          {testoPermanenti}
        </Testo>
      </View>

      {/* Identity micro-copy */}
      <Testo size={theme.font.small} muto style={styles.microCopy}>
        {"La conoscenza che hai reso parte permanente di te."}
      </Testo>

      {/* 3-segment horizontal progress bar */}
      <View
        style={styles.barraContenitore}
        accessibilityLabel={`Distribuzione consolidamento: ${totaleNuovi} iniziali, ${totaleInConsolidamento} in consolidamento, ${totalePermanenti} permanenti`}
      >
        {totaleVoci === 0 ? (
          <View style={[styles.segmento, styles.segmentoVuoto]} />
        ) : (
          <>
            {totaleNuovi > 0 && (
              <View
                style={[
                  styles.segmento,
                  styles.segmentoIniziale,
                  { flex: totaleNuovi },
                ]}
              />
            )}
            {totaleInConsolidamento > 0 && (
              <View
                style={[
                  styles.segmento,
                  styles.segmentoConsolidamento,
                  { flex: totaleInConsolidamento },
                ]}
              />
            )}
            {totalePermanenti > 0 && (
              <View
                style={[
                  styles.segmento,
                  styles.segmentoPermanente,
                  { flex: totalePermanenti },
                ]}
              />
            )}
          </>
        )}
      </View>

      {/* Distribution legend */}
      <View style={styles.legenda}>
        <View style={styles.colonnaLegenda}>
          <View style={styles.puntoRiga}>
            <View style={[styles.punto, styles.puntoIniziale]} />
            <Testo size={theme.font.meta} forte>
              Iniziale
            </Testo>
          </View>
          <Testo size={theme.font.small} forte>
            {String(totaleNuovi)}
          </Testo>
          <Testo size={theme.font.meta} muto>
            Meno di 2 sett.
          </Testo>
        </View>

        <View style={styles.colonnaLegenda}>
          <View style={styles.puntoRiga}>
            <View style={[styles.punto, styles.puntoConsolidamento]} />
            <Testo size={theme.font.meta} forte>
              In Consolidamento
            </Testo>
          </View>
          <Testo size={theme.font.small} forte>
            {String(totaleInConsolidamento)}
          </Testo>
          <Testo size={theme.font.meta} muto>
            2 sett. - 6 mesi
          </Testo>
        </View>

        <View style={styles.colonnaLegenda}>
          <View style={styles.puntoRiga}>
            <View style={[styles.punto, styles.puntoPermanente]} />
            <Testo size={theme.font.meta} forte>
              Permanente
            </Testo>
          </View>
          <Testo size={theme.font.small} forte>
            {String(totalePermanenti)}
          </Testo>
          <Testo size={theme.font.meta} muto>
            6 mesi e 4 ripassi
          </Testo>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  iconaContenitore: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.ramp.sage[100],
    alignItems: "center",
    justifyContent: "center",
  },
  titoloColonna: {
    flex: 1,
    gap: 1,
  },
  contatoreBlocco: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  numeroGrande: {
    fontSize: 34,
    color: theme.colors.text,
  },
  etichettaContatore: {
    flex: 1,
  },
  microCopy: {
    fontStyle: "italic",
    marginBottom: theme.spacing.md,
    color: theme.colors.textMuted,
  },
  barraContenitore: {
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.ramp.neutral[200],
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: theme.spacing.md,
    gap: 2,
  },
  segmento: {
    height: "100%",
  },
  segmentoVuoto: {
    flex: 1,
    backgroundColor: theme.ramp.neutral[300],
  },
  segmentoIniziale: {
    backgroundColor: theme.ramp.neutral[400],
  },
  segmentoConsolidamento: {
    backgroundColor: theme.colors.accent,
  },
  segmentoPermanente: {
    backgroundColor: theme.colors.sage,
  },
  legenda: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  colonnaLegenda: {
    flex: 1,
    gap: 2,
  },
  puntoRiga: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  punto: {
    width: 7,
    height: 7,
    borderRadius: theme.radius.pill,
  },
  puntoIniziale: {
    backgroundColor: theme.ramp.neutral[400],
  },
  puntoConsolidamento: {
    backgroundColor: theme.colors.accent,
  },
  puntoPermanente: {
    backgroundColor: theme.colors.sage,
  },
});
