/**
 * Design system — the icon set.
 *
 * Lives beside the palette and the type scale because it is the same kind of
 * thing: a table with no behaviour, mapping a name the screens use ("allenati")
 * to a glyph. The screens never name a glyph themselves, so replacing the set
 * is one edit here rather than a search across twenty files.
 *
 * The design calls for Lucide at stroke 2.75. Lucide is a fork of Feather and
 * the two share most of the set, so Feather carries almost everything; the
 * handful of shapes it lacks (a dumbbell, a brain, a mortarboard, a QR code)
 * come from Material Community, which ships in the same package.
 */
import React from "react";
import type { TextStyle } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

/** Every icon the app draws, by what it means rather than by what it looks like. */
export type NomeIcona =
  | "home"
  | "allenati"
  | "ripassa"
  | "contenuti"
  | "video"
  | "lettura"
  | "flashcard"
  | "lucchetto"
  | "fulmine"
  | "griglia"
  | "occhio"
  | "memoria"
  | "calendario"
  | "profilo"
  | "campanella"
  | "corsi"
  | "obiettivi"
  | "qr"
  | "recensione"
  | "esci"
  | "avanti"
  | "indietro"
  | "giu"
  | "menu"
  | "piu"
  | "cerca"
  | "filtri"
  | "fatto"
  | "chiudi"
  | "allegato"
  | "play";

type Voce =
  | { set: "feather"; nome: React.ComponentProps<typeof Feather>["name"] }
  | { set: "material"; nome: React.ComponentProps<typeof MaterialCommunityIcons>["name"] };

/**
 * A `Record` keyed on the union, not a lookup with a fallback: leaving a new
 * name out is then a compile error rather than a blank square on a screen
 * nobody opened during review. Same argument the button variants make.
 */
const GLIFI: Record<NomeIcona, Voce> = {
  home: { set: "feather", nome: "home" },
  allenati: { set: "material", nome: "dumbbell" },
  ripassa: { set: "feather", nome: "clock" },
  contenuti: { set: "feather", nome: "book" },
  video: { set: "feather", nome: "play-circle" },
  lettura: { set: "feather", nome: "book-open" },
  flashcard: { set: "feather", nome: "copy" },
  lucchetto: { set: "feather", nome: "lock" },
  fulmine: { set: "feather", nome: "zap" },
  griglia: { set: "feather", nome: "grid" },
  occhio: { set: "feather", nome: "eye" },
  memoria: { set: "material", nome: "brain" },
  calendario: { set: "feather", nome: "calendar" },
  profilo: { set: "feather", nome: "user" },
  campanella: { set: "feather", nome: "bell" },
  corsi: { set: "material", nome: "school-outline" },
  obiettivi: { set: "feather", nome: "target" },
  qr: { set: "material", nome: "qrcode" },
  recensione: { set: "feather", nome: "edit-2" },
  esci: { set: "feather", nome: "log-out" },
  avanti: { set: "feather", nome: "chevron-right" },
  indietro: { set: "feather", nome: "chevron-left" },
  giu: { set: "feather", nome: "chevron-down" },
  menu: { set: "feather", nome: "menu" },
  piu: { set: "feather", nome: "plus" },
  cerca: { set: "feather", nome: "search" },
  filtri: { set: "feather", nome: "sliders" },
  fatto: { set: "feather", nome: "check" },
  chiudi: { set: "feather", nome: "x" },
  allegato: { set: "feather", nome: "paperclip" },
  play: { set: "material", nome: "play" },
};

export function Icona({
  nome,
  size = 19,
  color,
  style,
}: {
  nome: NomeIcona;
  size?: number;
  color: string;
  style?: TextStyle;
}) {
  const glifo = GLIFI[nome];
  if (glifo.set === "material") {
    return <MaterialCommunityIcons name={glifo.nome} size={size} color={color} style={style} />;
  }
  return <Feather name={glifo.nome} size={size} color={color} style={style} />;
}

/** The icon standing for one training, keyed by its id in the catalogue. */
export const ICONA_ALLENAMENTO: Record<string, NomeIcona> = {
  fonetica: "griglia",
  schedario: "memoria",
  puntini: "occhio",
  rombo: "fulmine",
  copri: "occhio",
  parole: "memoria",
  date: "calendario",
  griglia: "griglia",
};
