/**
 * View — Home / Reviews list (spec section 9.1).
 *
 * One line per scheduled review. Two tabs split them by day: "Ripassi" (today
 * and later, soonest first) and "Storico" (earlier days, most recent first).
 * A review lands in the storico because its day has passed, not because it was
 * done — what was skipped is found again with the storico filter.
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { theme } from "@/view/theme/theme";
import { Casella } from "@/view/components/ui";
import { ComeFunziona } from "@/view/components/ComeFunziona";
import { RigaVoce } from "@/view/components/vociRipasso";
import { useRipassiCtx } from "@/controller/RipassiContext";
import { useAuthCtx } from "@/controller/AuthContext";
import { useConnettivita } from "@/controller/useConnettivita";
import { mostraErrore } from "@/controller/avvisoErrore";
import {
  corrispondeRicerca,
  soloDaCompletare,
  suddividiVoci,
  type VoceRipasso,
} from "@/model/ripassi/ripassiLogic";
import type { RootStackParamList } from "@/view/navigation";

type NavigazioneHome = NativeStackNavigationProp<RootStackParamList, "Home">;

/** Which of the two lists is on screen. */
type Scheda = "ripassi" | "storico";

/**
 * The letter shown in the profile button. Falls back to "?" rather than an
 * empty circle: a session with no readable address is odd enough that the
 * button should still look like something you can press.
 */
function iniziale(email: string | undefined): string {
  return email?.trim().charAt(0).toUpperCase() || "?";
}

export function HomeScreen() {
  const nav = useNavigation<NavigazioneHome>();
  const { ripassi, loading, ritentando, error, reload, cache, completaOccorrenza } =
    useRipassiCtx();
  const { session } = useAuthCtx();
  const { online } = useConnettivita();
  const [query, setQuery] = useState("");
  const [scheda, setScheda] = useState<Scheda>("ripassi");
  // Storico filter. Kept out of the tab state so switching back and forth does
  // not silently reset what the user asked to see.
  const [soloDaFare, setSoloDaFare] = useState(false);
  // Pull-to-refresh spinner. Presentation state, so it lives here: the
  // Controller's `loading` means "the list has never arrived", which is a
  // different question and stops being true after the first load.
  const [aggiornando, setAggiornando] = useState(false);

  async function aggiorna() {
    setAggiornando(true);
    try {
      await reload();
    } finally {
      setAggiornando(false);
    }
  }

  /**
   * The circle. The write is optimistic in appearance only: the Controller
   * reloads the list when it lands, so a failure leaves the circle as it was
   * and says why.
   */
  async function completa(v: VoceRipasso) {
    try {
      await completaOccorrenza(v.occorrenza.id, !v.occorrenza.is_completed);
    } catch (e) {
      mostraErrore(e, "completaOccorrenza", { occorrenzaId: v.occorrenza.id });
    }
  }

  // Classification and ordering live in the Model (ripassiLogic), tested there.
  const { attive, storico } = useMemo(
    () => suddividiVoci(ripassi.filter((r) => corrispondeRicerca(r, query))),
    [ripassi, query]
  );

  const voci = useMemo(() => {
    if (scheda === "ripassi") return attive;
    return soloDaFare ? soloDaCompletare(storico) : storico;
  }, [scheda, soloDaFare, attive, storico]);

  const vuoto =
    scheda === "ripassi"
      ? "Nessun ripasso da fare"
      : soloDaFare
      ? "Nessun ripasso da recuperare"
      : "Lo storico è vuoto";

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <Text style={styles.brand}>TurboRipassi</Text>
        {/* Account, Drive and the way out live behind here. Reachable without
            hunting, and off a screen that is opened twenty times a day. */}
        <Pressable
          onPress={() => nav.navigate("Profilo")}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Profilo"
          style={styles.avatar}
        >
          <Text style={styles.avatarIniziale}>{iniziale(session?.user.email)}</Text>
        </Pressable>
      </View>

      <TextInput
        placeholder="Cerca ripassi…"
        placeholderTextColor={theme.colors.textMuted}
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />

      {!online ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Sei offline — vedi i ripassi già scaricati. Le modifiche richiedono
            la connessione.
          </Text>
        </View>
      ) : null}

      {/* Offline reading is a promise the app makes silently; when part of it
          could not be kept, saying so now beats finding out on a train. */}
      {cache.ultimoEsito && cache.ultimoEsito.falliti > 0 ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            {cache.ultimoEsito.falliti === 1
              ? "1 allegato dei prossimi ripassi non è disponibile offline."
              : `${cache.ultimoEsito.falliti} allegati dei prossimi ripassi non sono disponibili offline.`}
          </Text>
        </View>
      ) : null}

      {/* Un ritento dura secondi, con attese che raddoppiano: senza questa
          riga l'app sembra ferma e l'unica reazione sensata sarebbe toccare
          di nuovo, cioè la cosa che non aiuta. */}
      {ritentando ? (
        <View style={styles.ritento}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.ritentoText}>La connessione fa i capricci: riprovo…</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={voci}
        keyExtractor={(v) => v.occorrenza.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={aggiornando || loading}
            onRefresh={aggiorna}
            tintColor={theme.colors.primary}
          />
        }
        ListHeaderComponent={
          <Intestazione
            scheda={scheda}
            onScheda={setScheda}
            soloDaFare={soloDaFare}
            onFiltro={() => setSoloDaFare((v) => !v)}
            onAggiungi={() => nav.navigate("FormRipasso")}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>{vuoto}</Text>}
        renderItem={({ item }) => (
          <RigaVoce
            voce={item}
            onApri={(v) => nav.navigate("FormRipasso", { ripassoId: v.ripasso.id })}
            onCompleta={completa}
          />
        )}
      />
    </View>
  );
}

/**
 * Everything above the rows and scrolling with them: the explanation strip, the
 * add button, the two tabs and — in the storico — the filter.
 *
 * Declared at module level and passed as an element, not as an inline
 * function: FlatList would otherwise see a new component type on every render
 * and remount the header, closing the "Come funziona?" panel the moment it is
 * opened.
 */
function Intestazione({
  scheda,
  onScheda,
  soloDaFare,
  onFiltro,
  onAggiungi,
}: {
  scheda: Scheda;
  onScheda: (s: Scheda) => void;
  soloDaFare: boolean;
  onFiltro: () => void;
  onAggiungi: () => void;
}) {
  return (
    <>
      <ComeFunziona />

      <Pressable style={styles.aggiungi} onPress={onAggiungi}>
        <View style={styles.aggiungiTondo}>
          <Text style={styles.aggiungiPiu}>＋</Text>
        </View>
        <Text style={styles.aggiungiLabel}>Aggiungi ripasso</Text>
      </Pressable>

      <View style={styles.schede}>
        <Linguetta
          label="RIPASSI"
          attiva={scheda === "ripassi"}
          onPress={() => onScheda("ripassi")}
        />
        <Linguetta
          label="STORICO"
          attiva={scheda === "storico"}
          onPress={() => onScheda("storico")}
        />
      </View>

      {scheda === "storico" ? (
        <Casella
          label="Solo da completare"
          valore={soloDaFare}
          onCambia={onFiltro}
          style={styles.filtro}
        />
      ) : null}
    </>
  );
}

/** One of the two list tabs. Underlined when it is the one on screen. */
function Linguetta({
  label,
  attiva,
  onPress,
}: {
  label: string;
  attiva: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.scheda, attiva && styles.schedaAttiva]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: attiva }}
    >
      <Text style={[styles.schedaLabel, attiva && styles.schedaLabelAttiva]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  topbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  brand: { fontSize: theme.font.heading, fontWeight: "900", color: theme.colors.primary },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarIniziale: {
    color: theme.colors.textOnPrimary,
    fontSize: theme.font.body,
    fontWeight: "800",
  },
  search: {
    margin: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.font.body,
    color: theme.colors.text,
  },
  aggiungi: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  aggiungiTondo: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  aggiungiPiu: { color: theme.colors.textOnPrimary, fontSize: theme.font.heading, fontWeight: "800" },
  aggiungiLabel: { color: theme.colors.primary, fontSize: theme.font.title, fontWeight: "700" },
  schede: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginTop: theme.spacing.sm,
  },
  scheda: {
    flex: 1,
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  schedaAttiva: { borderBottomColor: theme.colors.primary },
  schedaLabel: { fontSize: theme.font.body, fontWeight: "700", color: theme.colors.textMuted },
  schedaLabelAttiva: { color: theme.colors.primary },
  filtro: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  list: { paddingBottom: theme.spacing.xxl },
  empty: {
    color: theme.colors.textMuted,
    fontStyle: "italic",
    padding: theme.spacing.lg,
  },
  error: { color: theme.colors.danger, paddingHorizontal: theme.spacing.lg },
  offlineBanner: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  offlineText: { color: theme.colors.textMuted, fontSize: theme.font.small },
  ritento: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  ritentoText: { color: theme.colors.textMuted, fontSize: theme.font.small },
});
