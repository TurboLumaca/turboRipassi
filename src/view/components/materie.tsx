/**
 * View — the materie as the user sees them: a coloured chip, the filter bar of
 * the list, and the picker of the form.
 *
 * The colour of a materia comes from the data, so unlike the rest of the
 * design system these components take it as a value and compute a readable ink
 * for it (`inchiostroSu`) instead of reading a token. Which colour a new
 * materia gets, and whether a name is acceptable, are the Model's decisions:
 * this file only draws and reports taps.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { theme } from "@/view/theme/theme";
import { inchiostroSu } from "@/model/materie/materieLogic";
import type { Materia } from "@/model/types";

/**
 * A materia as a chip.
 *
 * `attiva` fills it with its colour; otherwise it is a tinted outline with a
 * coloured dot. Without `onPress` it is a plain label (the row of the list),
 * with it, a toggle (filter and picker).
 */
export function ChipMateria({
  materia,
  attiva = true,
  onPress,
  compatto = false,
  style,
}: {
  materia: Materia;
  attiva?: boolean;
  onPress?: () => void;
  compatto?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inchiostro = attiva ? inchiostroSu(materia.colore) : theme.colors.text;
  const contenuto = (
    <>
      {attiva ? null : <View style={[styles.punto, { backgroundColor: materia.colore }]} />}
      <Text
        numberOfLines={1}
        style={[styles.etichetta, compatto && styles.etichettaCompatta, { color: inchiostro }]}
      >
        {materia.nome}
      </Text>
    </>
  );
  const stile = [
    styles.chip,
    compatto && styles.chipCompatto,
    attiva
      ? { backgroundColor: materia.colore, borderColor: materia.colore }
      : { backgroundColor: "transparent", borderColor: materia.colore },
    style,
  ];

  if (!onPress) {
    return (
      <View style={stile} accessibilityLabel={`Materia: ${materia.nome}`}>
        {contenuto}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Materia ${materia.nome}`}
      accessibilityState={{ selected: attiva }}
      style={({ pressed }) => [stile, pressed && styles.premuto]}
    >
      {contenuto}
    </Pressable>
  );
}

/**
 * The filter bar above the list: «Tutte» plus one chip per materia, scrolling
 * sideways. Tapping the selected chip again clears the filter, so there is no
 * state to get stuck in.
 */
export function FiltroMaterie({
  materie,
  selezionata,
  onCambia,
}: {
  materie: readonly Materia[];
  selezionata: string | null;
  onCambia: (id: string | null) => void;
}) {
  if (materie.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.filtro}
      accessibilityLabel="Filtra per materia"
    >
      <Pressable
        onPress={() => onCambia(null)}
        accessibilityRole="button"
        accessibilityLabel="Tutte le materie"
        accessibilityState={{ selected: selezionata === null }}
        style={[styles.chip, styles.chipTutte, selezionata === null && styles.chipTutteAttiva]}
      >
        <Text
          style={[
            styles.etichetta,
            { color: selezionata === null ? theme.colors.textOnInk : theme.colors.text },
          ]}
        >
          Tutte
        </Text>
      </Pressable>
      {materie.map((m) => (
        <ChipMateria
          key={m.id}
          materia={m}
          attiva={selezionata === m.id}
          onPress={() => onCambia(selezionata === m.id ? null : m.id)}
        />
      ))}
    </ScrollView>
  );
}

/**
 * The picker of the form: the materie as toggles (tapping the chosen one
 * clears it — «nessuna materia» is a valid answer) and a «Nuova materia» field
 * that creates one and selects it on the spot.
 *
 * `onCrea` resolves with the new materia or rejects with a sentence for the
 * user; the rejection is shown under the field and the typed name is kept.
 */
export function SelettoreMateria({
  materie,
  valore,
  onCambia,
  onCrea,
}: {
  materie: readonly Materia[];
  valore: string | null;
  onCambia: (id: string | null) => void;
  onCrea: (nome: string) => Promise<Materia>;
}) {
  const [creando, setCreando] = useState(false);
  const [nome, setNome] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  async function conferma() {
    if (inCorso) return;
    setInCorso(true);
    setErrore(null);
    try {
      const creata = await onCrea(nome);
      onCambia(creata.id);
      setNome("");
      setCreando(false);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non sono riuscito a creare la materia.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <View style={styles.selettore}>
      <View style={styles.elenco}>
        {materie.map((m) => (
          <ChipMateria
            key={m.id}
            materia={m}
            attiva={valore === m.id}
            onPress={() => onCambia(valore === m.id ? null : m.id)}
          />
        ))}
        {!creando ? (
          <Pressable
            onPress={() => setCreando(true)}
            accessibilityRole="button"
            accessibilityLabel="Nuova materia"
            style={[styles.chip, styles.chipNuova]}
          >
            <Text style={[styles.etichetta, { color: theme.colors.primary }]}>+ Nuova materia</Text>
          </Pressable>
        ) : null}
      </View>

      {creando ? (
        <View style={styles.nuova}>
          <TextInput
            value={nome}
            onChangeText={(t) => {
              setNome(t);
              setErrore(null);
            }}
            placeholder="Nome della materia"
            placeholderTextColor={theme.colors.textMuted}
            autoFocus
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={() => void conferma()}
            style={styles.campo}
          />
          <Pressable
            onPress={() => void conferma()}
            disabled={inCorso}
            accessibilityRole="button"
            accessibilityLabel="Aggiungi materia"
            style={[styles.aggiungi, inCorso && styles.premuto]}
          >
            {inCorso ? (
              <ActivityIndicator size="small" color={theme.colors.textOnInk} />
            ) : (
              <Text style={styles.aggiungiTesto}>Aggiungi</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              setCreando(false);
              setNome("");
              setErrore(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Annulla nuova materia"
            hitSlop={8}
          >
            <Text style={styles.annulla}>Annulla</Text>
          </Pressable>
        </View>
      ) : null}
      {errore ? <Text style={styles.errore}>{errore}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 220,
  },
  chipCompatto: { paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  etichetta: { fontFamily: theme.family.semi, fontSize: theme.font.small, flexShrink: 1 },
  etichettaCompatta: { fontSize: theme.font.meta },
  premuto: { opacity: 0.75 },
  filtro: { gap: 8, paddingVertical: 2, paddingRight: theme.spacing.lg },
  chipTutte: { borderColor: theme.colors.borderStrong, backgroundColor: "transparent" },
  chipTutteAttiva: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  selettore: { gap: theme.spacing.sm },
  elenco: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipNuova: { borderStyle: "dashed", borderColor: theme.colors.borderStrong },
  nuova: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  campo: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.font.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  aggiungi: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    minWidth: 84,
    alignItems: "center",
  },
  aggiungiTesto: { color: theme.colors.textOnInk, fontWeight: "700", fontSize: theme.font.small },
  annulla: { color: theme.colors.textMuted, fontSize: theme.font.small },
  errore: { color: theme.colors.danger, fontSize: theme.font.small },
});
