/**
 * Controller — apre il form di un nuovo ripasso quando un'altra app condivide
 * qualcosa con TurboRipassi (foglio "Condividi" di iOS e Android).
 *
 * Il modulo nativo (`expo-share-intent`) raccoglie la condivisione e la tiene
 * nel suo contesto; questo hook la trasforma in una bozza, apre il form e poi
 * la consuma. Vive dentro l'area autenticata: se l'app viene aperta dalla
 * condivisione senza una sessione, la condivisione resta in attesa e parte
 * appena il login è finito, invece di perdersi.
 *
 * Aspetta anche che la navigazione sia pronta: all'avvio a freddo la
 * condivisione arriva prima che lo stack abbia una rotta su cui spingere.
 */
import { useEffect } from "react";
import { StackActions, type NavigationAction } from "@react-navigation/native";
import { useShareIntentContext } from "expo-share-intent";
import { bozzaDaCondivisione, condivisioneVuota } from "@/model/ripassi/bozzaCondivisione";

export function useRipassoDaCondivisione(
  navigazione: { dispatch: (azione: NavigationAction) => void },
  navigazionePronta: boolean
): void {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent || !navigazionePronta) return;
    if (!condivisioneVuota(shareIntent)) {
      // push e non navigate: con il form già aperto navigate ne riuscirebbe
      // solo a cambiare i parametri, lasciando i campi che c'erano.
      navigazione.dispatch(
        StackActions.push("FormRipasso", { bozza: bozzaDaCondivisione(shareIntent) })
      );
    }
    resetShareIntent();
  }, [hasShareIntent, navigazionePronta, shareIntent, navigazione, resetShareIntent]);
}
