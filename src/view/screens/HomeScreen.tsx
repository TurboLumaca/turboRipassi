/**
 * View — Home / Reviews list (spec section 9.1).
 * Two sections: "Ripassi" (today and upcoming) and "Storico" (past), search, + Add.
 */
import React, { useMemo, useState } from "react";
import {
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
import { theme } from "@/theme/theme";
import { Badge, Button } from "@/view/components/ui";
import { useRipassiCtx } from "@/controller/RipassiContext";
import { useAuth } from "@/controller/useAuth";
import { etichettaRelativa, isPassato } from "@/view/format";
import type { RootStackParamList } from "@/view/navigation";
import type { Occorrenza, RipassoCompleto } from "@/model/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "Home">;

/** Next non-completed occurrence; if all are past, the last one. */
function prossimaOccorrenza(r: RipassoCompleto): Occorrenza | null {
  const future = r.occorrenze
    .filter((o) => !o.is_completed && !isPassato(o.scheduled_at))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  if (future.length > 0) return future[0];
  return r.occorrenze[r.occorrenze.length - 1] ?? null;
}

/** A ripasso is "past" if it has no upcoming non-completed occurrence. */
function isStorico(r: RipassoCompleto): boolean {
  return !r.occorrenze.some((o) => !o.is_completed && !isPassato(o.scheduled_at));
}

export function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { ripassi, loading, error, reload } = useRipassiCtx();
  const { signOut } = useAuth();
  const [query, setQuery] = useState("");

  const { attivi, storico } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (r: RipassoCompleto) =>
      q === "" ||
      r.titolo.toLowerCase().includes(q) ||
      (r.note ?? "").toLowerCase().includes(q);
    const filtered = ripassi.filter(match);
    return {
      attivi: filtered
        .filter((r) => !isStorico(r))
        .sort((a, b) => {
          const pa = prossimaOccorrenza(a)?.scheduled_at ?? "";
          const pb = prossimaOccorrenza(b)?.scheduled_at ?? "";
          return new Date(pa).getTime() - new Date(pb).getTime();
        }),
      storico: filtered
        .filter((r) => isStorico(r))
        .sort((a, b) => {
          const ua = prossimaOccorrenza(a)?.scheduled_at ?? a.created_at;
          const ub = prossimaOccorrenza(b)?.scheduled_at ?? b.created_at;
          return new Date(ub).getTime() - new Date(ua).getTime(); // most recent first
        }),
    };
  }, [ripassi, query]);

  const data = useMemo(() => {
    const out: (
      | { type: "header"; label: string; key: string }
      | { type: "item"; ripasso: RipassoCompleto; key: string }
    )[] = [];
    out.push({ type: "header", label: "Ripassi", key: "h-attivi" });
    if (attivi.length === 0) out.push({ type: "header", label: "  Nessun ripasso in programma", key: "e-attivi" });
    attivi.forEach((r) => out.push({ type: "item", ripasso: r, key: `a-${r.id}` }));
    if (storico.length > 0) {
      out.push({ type: "header", label: "Storico", key: "h-storico" });
      storico.forEach((r) => out.push({ type: "item", ripasso: r, key: `s-${r.id}` }));
    }
    return out;
  }, [attivi, storico]);

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <Text style={styles.brand}>Ripassa</Text>
        <Pressable onPress={signOut} hitSlop={10}>
          <Text style={styles.logout}>Esci</Text>
        </Pressable>
      </View>

      <TextInput
        placeholder="Cerca ripassi…"
        placeholderTextColor={theme.colors.textMuted}
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={data}
        keyExtractor={(it) => it.key}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={theme.colors.primary} />}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return <Text style={item.key.startsWith("e-") ? styles.empty : styles.section}>{item.label}</Text>;
          }
          const r = item.ripasso;
          const prossima = prossimaOccorrenza(r);
          const storicoItem = isStorico(r);
          return (
            <Pressable
              style={styles.card}
              onPress={() => nav.navigate("FormRipasso", { ripassoId: r.id })}
            >
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, storicoItem && styles.cardTitleDone]} numberOfLines={1}>
                  {r.titolo}
                </Text>
                {r.allegati.length > 0 ? <Badge label={`📎 ${r.allegati.length}`} tone="muted" /> : null}
              </View>
              {r.note ? (
                <Text style={styles.cardNote} numberOfLines={2}>
                  {r.note}
                </Text>
              ) : null}
              {prossima ? (
                <View style={styles.cardFoot}>
                  <Badge
                    label={etichettaRelativa(prossima.scheduled_at)}
                    tone={storicoItem ? "muted" : "accent"}
                  />
                  <Text style={styles.count}>
                    {r.occorrenze.filter((o) => o.is_completed).length}/{r.occorrenze.length} completati
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />

      <View style={styles.fabWrap}>
        <Button label="＋ Aggiungi ripasso" variant="accent" onPress={() => nav.navigate("FormRipasso")} />
      </View>
    </View>
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
  logout: { color: theme.colors.textMuted, fontSize: theme.font.body, fontWeight: "600" },
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
  list: { paddingHorizontal: theme.spacing.lg, paddingBottom: 96 },
  section: {
    fontSize: theme.font.title,
    fontWeight: "800",
    color: theme.colors.primary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  empty: { color: theme.colors.textMuted, fontStyle: "italic", marginBottom: theme.spacing.sm },
  error: { color: theme.colors.danger, paddingHorizontal: theme.spacing.lg },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm },
  cardTitle: { flex: 1, fontSize: theme.font.title, fontWeight: "700", color: theme.colors.text },
  cardTitleDone: { color: theme.colors.completed },
  cardNote: { color: theme.colors.textMuted, fontSize: theme.font.body },
  cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { color: theme.colors.textMuted, fontSize: theme.font.small },
  fabWrap: {
    position: "absolute",
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: theme.spacing.xl,
  },
});
