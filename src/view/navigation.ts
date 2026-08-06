/** View — shared navigation types (React Navigation native stack). */
export type RootStackParamList = {
  Home: undefined;
  FormRipasso: { ripassoId?: string } | undefined;
  DettaglioAllegati: { ripassoId: string };
  Profilo: undefined;
};
