/**
 * View — il Patrimonio come collezione rara, e il canarino sotto.
 *
 * La rarità qui è autentica, ed è il capovolgimento di come funziona nei
 * giochi. Là la rarità è una percentuale scritta in un file di
 * configurazione, e la dignità tipografica riservata al drop leggendario
 * serve a far sembrare grande una cosa che è stata decisa piccola. Qui il
 * numero grande — in Anton, a piena scala, la stessa grammatica visiva —
 * misura la quota di conoscenza che ha attraversato sei mesi. È raro perché
 * sei mesi sono sei mesi.
 *
 * L'ancora identitaria è il sapere posseduto, e mai la sequenza di giorni:
 * *"Sai cose che non dimenticherai"*. È il versante pulito del sunk cost —
 * l'asset vive nella testa di chi lo ha costruito, non dentro l'app, e
 * abbandonare l'app non distrugge niente. Per questo non ci sarà mai accanto
 * un asset sintetico concorrente da proteggere: una streak messa qui
 * diventerebbe la cosa da difendere, e il patrimonio tornerebbe a essere
 * gear di WoW.
 *
 * Sotto c'è il rendimento formativo. Sta in faccia all'utente e non in una
 * dashboard interna perché è la metrica che dice se l'app sta funzionando
 * come promette, ed è l'unica difesa contro l'ipotesi in cui la retention
 * sale mentre l'apprendimento no.
 */
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "@/view/theme/theme";
import { Icona } from "@/view/theme/icone";
import { Card } from "@/view/components/ui";
import { Kicker, Testo, Titolo, Vuoto } from "@/view/components/organic";
import { useRipassiCtx } from "@/controller/RipassiContext";
import { calcolaStatisticheCapitale } from "@/model/ripassi/capitaleMentaleLogic";
import {
  concettiPermanenti,
  rendimentoFormativo,
} from "@/model/ripassi/patrimonioLogic";
import { formatDataBreve } from "@/view/lib/format";

export function PatrimonioGallery() {
  const { ripassi } = useRipassiCtx();
  const [apertoId, setApertoId] = useState<string | null>(null);

  const stats = useMemo(() => calcolaStatisticheCapitale(ripassi), [ripassi]);
  const permanenti = useMemo(() => concettiPermanenti(ripassi), [ripassi]);
  const rendimento = useMemo(() => rendimentoFormativo(ripassi), [ripassi]);

  return (
    <Card style={styles.card}>
      <Kicker>Patrimonio</Kicker>

      <View style={styles.numeroneRiga}>
        <Titolo size={56} style={styles.numerone}>
          {`${stats.percentualePermanente}%`}
        </Titolo>
        <View style={styles.numeroneNota}>
          <Testo size={theme.font.small} forte>
            permanente
          </Testo>
          <Testo size={theme.font.meta} muto>
            {stats.totalePermanenti === 1
              ? `1 concetto su ${stats.totaleVoci}`
              : `${stats.totalePermanenti} concetti su ${stats.totaleVoci}`}
          </Testo>
        </View>
      </View>

      <Testo size={theme.font.small} style={styles.identita}>
        Sai cose che non dimenticherai.
      </Testo>

      <View style={styles.separatore} />

      {permanenti.length === 0 ? (
        <Vuoto>
          Nessun concetto permanente, per ora. Il primo arriva dopo sei mesi: è
          il tipo di cosa che non si può accelerare.
        </Vuoto>
      ) : (
        permanenti.map((c) => {
          const aperto = apertoId === c.ripasso.id;
          return (
            <Pressable
              key={c.ripasso.id}
              onPress={() => setApertoId(aperto ? null : c.ripasso.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded: aperto }}
              style={({ pressed }) => [styles.voce, pressed && styles.premuta]}
            >
              <View style={styles.voceTestata}>
                <Icona nome="lucchetto" size={14} color={theme.colors.accentDark} />
                <View style={styles.voceTesti}>
                  <Testo size={theme.font.body} forte numberOfLines={aperto ? undefined : 1}>
                    {c.ripasso.titolo}
                  </Testo>
                  <Testo size={theme.font.meta} muto>
                    {`Permanente dal ${formatDataBreve(c.promossoIl)}`}
                  </Testo>
                </View>
              </View>

              {/* La storia di spacing, la stessa della cerimonia: qui si può
                  rivedere quante volte si vuole, perché guardarla non è una
                  ricompensa da rigiocare, è un fatto da consultare. */}
              {aperto ? (
                <View style={styles.storia}>
                  {c.storia.map((iso, i) => (
                    <View key={iso + String(i)} style={styles.tappa}>
                      <View style={styles.pallino} />
                      <Testo size={theme.font.meta} muto>
                        {formatDataBreve(iso)}
                      </Testo>
                    </View>
                  ))}
                </View>
              ) : null}
            </Pressable>
          );
        })
      )}

      <View style={styles.separatore} />

      {/* Il canarino. Se un giorno questa riga smette di salire mentre le
          sessioni salgono, la missione sta fallendo anche se il prodotto
          cresce — ed è meglio leggerlo qui che scoprirlo fra due anni. */}
      <View style={styles.canarino}>
        <Testo size={theme.font.meta} muto>
          Rendimento formativo
        </Testo>
        <Testo size={theme.font.small} forte>
          {`${rendimento.perTrimestre} promozioni per trimestre`}
        </Testo>
        <Testo size={theme.font.meta} muto>
          {rendimento.inMaturazione === 1
            ? "1 concetto sta maturando."
            : `${rendimento.inMaturazione} concetti stanno maturando.`}
        </Testo>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: theme.spacing.lg, marginBottom: theme.spacing.lg, gap: theme.spacing.xs },
  numeroneRiga: { flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.md },
  numerone: { lineHeight: 62 },
  numeroneNota: { paddingBottom: theme.spacing.sm, gap: 1 },
  identita: { fontFamily: theme.family.eyebrow },
  separatore: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  voce: { paddingVertical: theme.spacing.sm, gap: theme.spacing.sm },
  premuta: { opacity: 0.7 },
  voceTestata: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  voceTesti: { flex: 1, gap: 1 },
  storia: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.lg,
    paddingLeft: theme.spacing.lg,
  },
  tappa: { alignItems: "center", gap: 4 },
  pallino: {
    width: 6,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sage,
  },
  canarino: { gap: 2 },
});
