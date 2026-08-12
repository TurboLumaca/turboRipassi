/**
 * View — shared navigation types (React Navigation native stack).
 *
 * `Principale` is the shell holding the four daily tabs. Everything else is a
 * push over it: the ripasso form and its attachments, the training detail, and
 * the screens the drawer opens — the ones the redesign describes as "opened in
 * weeks, not in days".
 */
export type RootStackParamList = {
  Principale: undefined;
  FormRipasso: { ripassoId?: string } | undefined;
  DettaglioAllegati: { ripassoId: string };
  Allenamento: { id: string };
  Flashcard: undefined;
  Programma: undefined;
  Appuntamenti: undefined;
  Corsi: undefined;
  Obiettivi: undefined;
  Profilo: undefined;
};
