/**
 * Controller — "sto ritentando", detto alle schermate.
 *
 * `conRetry` (Model) ritenta da solo gli errori transitori con attese che
 * raddoppiano: fino a tre tentativi sono diversi secondi in cui l'app non
 * mostra niente e sembra bloccata, e l'unica reazione ragionevole di chi
 * guarda è toccare di nuovo — cioè la cosa che non aiuta.
 *
 * La logica di ritento resta dov'è, pura e senza stato: qui si usa solo il
 * gancio `onRitento` che già esporta, per accendere un flag che la View possa
 * leggere. Un contatore e non un booleano: più operazioni possono essere in
 * volo insieme (una scrittura e il ricaricamento che ne segue), e con un
 * booleano la prima che finisce spegnerebbe l'indicatore mentre la seconda sta
 * ancora aspettando.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { conRetry } from "@/model/shared/retry";

export interface Ritento {
  /** True finché almeno un'operazione è fra un tentativo e il successivo. */
  ritentando: boolean;
  /** Esegue l'azione con ritento, dicendolo alle schermate mentre accade. */
  conRitentoVisibile: <T>(azione: () => Promise<T>) => Promise<T>;
}

export function useRitento(): Ritento {
  const [ritentando, setRitentando] = useState(false);
  const inCorso = useRef(0);
  const montato = useRef(true);

  useEffect(() => {
    montato.current = true;
    return () => {
      montato.current = false;
    };
  }, []);

  const conRitentoVisibile = useCallback(async <T,>(azione: () => Promise<T>): Promise<T> => {
    // Contata una volta sola per operazione: `onRitento` scatta a ogni
    // tentativo, e contarli tutti lascerebbe il contatore sopra lo zero.
    let contata = false;
    const aggiorna = () => {
      if (montato.current) setRitentando(inCorso.current > 0);
    };

    try {
      return await conRetry(azione, {
        onRitento: () => {
          if (contata) return;
          contata = true;
          inCorso.current += 1;
          aggiorna();
        },
      });
    } finally {
      if (contata) {
        inCorso.current -= 1;
        aggiorna();
      }
    }
  }, []);

  return { ritentando, conRitentoVisibile };
}
