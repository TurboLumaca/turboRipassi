/**
 * View — tutto ciò che si preme o si compila: pillole, chip, segmentato, campo
 * di ricerca, tendina.
 *
 * L'aspetto delle pillole passa da `aspettoPillola`, un `switch` esaustivo:
 * aggiungere una variante senza dirle che colore ha è un errore di
 * compilazione, non un bottone trasparente scoperto sul dispositivo.
 */
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { theme } from "@/view/theme/theme";
import { Icona, type NomeIcona } from "@/view/theme/icone";
import { TONI, type Tono } from "./toni";

type VariantePillola = "primaria" | "secondaria" | "scura" | "fantasma";

export function Pillola({
  label,
  onPress,
  variante = "primaria",
  icona,
  disabled = false,
  suScuro = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variante?: VariantePillola;
  icona?: NomeIcona;
  disabled?: boolean;
  /** Set on the dark cards, where a bordered button needs a light border. */
  suScuro?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const aspetto = aspettoPillola(variante, suScuro);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pillola,
        {
          backgroundColor: aspetto.sfondo,
          borderColor: aspetto.bordo,
          borderWidth: aspetto.bordo === "transparent" ? 0 : 1,
          // The system's disabled state is 45%, not a grey: the shape has to
          // stay recognisable as the button it will become.
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        },
        style,
      ]}
    >
      {icona ? <Icona nome={icona} size={17} color={aspetto.inchiostro} /> : null}
      <Text
        style={[
          styles.pillolaLabel,
          {
            color: aspetto.inchiostro,
            fontFamily: variante === "primaria" ? theme.family.heading : theme.family.semi,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function aspettoPillola(variante: VariantePillola, suScuro: boolean) {
  switch (variante) {
    case "primaria":
      return {
        sfondo: theme.colors.accent,
        inchiostro: theme.colors.textOnAccent,
        bordo: "transparent",
      };
    case "scura":
      return {
        sfondo: theme.colors.inkSurface,
        inchiostro: theme.colors.textOnInk,
        bordo: "transparent",
      };
    case "secondaria":
      return {
        sfondo: "transparent",
        inchiostro: suScuro ? theme.colors.textOnInk : theme.colors.text,
        bordo: suScuro ? "rgba(255,255,255,0.38)" : theme.colors.borderStrong,
      };
    case "fantasma":
      return {
        sfondo: "transparent",
        inchiostro: suScuro ? theme.colors.textOnInk : theme.colors.accentInk,
        bordo: "transparent",
      };
  }
}

/** A small label tinted from one of the three ramps. */
export function Chip({
  label,
  tono = "neutro",
  style,
}: {
  label: string;
  tono?: Tono;
  style?: StyleProp<ViewStyle>;
}) {
  const { tinta, inchiostro } = TONI[tono];
  return (
    <View style={[styles.chip, { backgroundColor: tinta }, style]}>
      <Text style={[styles.chipLabel, { color: inchiostro }]}>{label}</Text>
    </View>
  );
}

/** The two- or three-way switch inside a screen. */
export function Segmentato<T extends string>({
  opzioni,
  valore,
  onCambia,
}: {
  opzioni: { valore: T; label: string; icona?: NomeIcona }[];
  valore: T;
  onCambia: (v: T) => void;
}) {
  return (
    <View style={styles.segmentato}>
      {opzioni.map((o) => {
        const attiva = o.valore === valore;
        const inchiostro = attiva ? theme.colors.text : theme.colors.textMuted;
        return (
          <Pressable
            key={o.valore}
            onPress={() => onCambia(o.valore)}
            accessibilityRole="tab"
            accessibilityState={{ selected: attiva }}
            style={[styles.segmento, attiva && styles.segmentoAttivo]}
          >
            {o.icona ? <Icona nome={o.icona} size={15} color={inchiostro} /> : null}
            <Text style={[styles.segmentoLabel, { color: inchiostro }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The rounded search field. */
export function CampoRicerca({
  valore,
  onCambia,
  placeholder,
}: {
  valore: string;
  onCambia: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.ricerca}>
      <Icona nome="cerca" size={17} color={theme.colors.textMuted} />
      <TextInput
        value={valore}
        onChangeText={onCambia}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={styles.ricercaInput}
      />
    </View>
  );
}

/**
 * The line you press to open an explanation, and the chevron that says so.
 *
 * Collapsed by default wherever it appears. The old Home kept its panel open
 * above the list, which pushed the rows — the thing people came for — off the
 * bottom of the screen every single time.
 */
export function Tendina({
  titolo,
  aperto,
  onPremi,
  children,
}: {
  titolo: string;
  aperto: boolean;
  onPremi: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.tendina}>
      <Pressable
        onPress={onPremi}
        accessibilityRole="button"
        accessibilityState={{ expanded: aperto }}
        style={styles.tendinaTestata}
      >
        <Text style={styles.tendinaTitolo}>{titolo}</Text>
        <Icona
          nome="giu"
          size={18}
          color={theme.colors.text}
          style={aperto ? styles.chevronAperto : undefined}
        />
      </Pressable>
      {aperto ? <View style={styles.tendinaCorpo}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pillola: {
    minHeight: 46,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  pillolaLabel: { fontSize: theme.font.body },
  chip: {
    alignSelf: "flex-start",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipLabel: { fontFamily: theme.family.semi, fontSize: theme.font.meta, letterSpacing: 0.2 },
  segmentato: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: theme.radius.pill,
    // A step darker than the ground, so the selected segment reads as raised.
    backgroundColor: theme.ramp.neutral[300],
  },
  segmento: {
    flex: 1,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: theme.radius.pill,
  },
  segmentoAttivo: { backgroundColor: theme.colors.surface },
  segmentoLabel: { fontFamily: theme.family.semi, fontSize: theme.font.small },
  ricerca: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    height: 44,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
  },
  ricercaInput: {
    flex: 1,
    fontFamily: theme.family.body,
    fontSize: theme.font.body,
    color: theme.colors.text,
    padding: 0,
  },
  tendina: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
  },
  tendinaTestata: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
  },
  tendinaTitolo: {
    flex: 1,
    fontFamily: theme.family.semi,
    fontSize: theme.font.body,
    color: theme.colors.text,
  },
  chevronAperto: { transform: [{ rotate: "180deg" }] },
  tendinaCorpo: { paddingBottom: theme.spacing.lg },
});
