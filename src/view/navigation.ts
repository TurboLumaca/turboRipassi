/**
 * View — shared navigation types (React Navigation native stack).
 *
 * `Principale` is the shell holding the four daily tabs. Everything else is a
 * push over it: the ripasso form and its attachments, the training detail, and
 * the screens the drawer opens — the ones the redesign describes as "opened in
 * weeks, not in days".
 */
import type { BozzaCondivisa } from "@/model/ripassi/bozzaCondivisione";

export type RootStackParamList = {
  Ripassi: undefined;
  /** `bozza`: ciò che un'altra app ha condiviso, a precompilare un ripasso nuovo. */
  FormRipasso: { ripassoId?: string; bozza?: BozzaCondivisa } | undefined;
  DettaglioAllegati: { ripassoId: string };
  Profilo: undefined;
};
