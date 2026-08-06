/**
 * Controller — keeps the device's scheduled reminders in sync with the
 * current list of ripassi. Mirrors useLocalCache: it reacts to the same
 * `ripassi` prop RipassiProvider already holds, so there is no second
 * subscription and no second source of truth for "what is scheduled".
 *
 * For now this reminds about one thing only: a ripasso whose time has come.
 */
import { useEffect, useRef } from "react";
import { assicuraPermessoNotifiche } from "@/config/notifications";
import {
  diffPromemoria,
  occorrenzeDaRicordare,
  type PromemoriaOccorrenza,
} from "@/model/notifiche/notificheLogic";
import { notificheRepo, type NotificheRepo } from "@/model/notifiche/notificheRepo";
import { reportError } from "@/config/crashReporting";
import type { RipassoCompleto } from "@/model/types";

export function useNotificheRipassi(
  ripassi: RipassoCompleto[],
  repo: NotificheRepo = notificheRepo
): void {
  // What is currently scheduled, as far as this device knows. A ref and not
  // state: it is bookkeeping for the sync, not something any screen renders.
  const programmati = useRef<Map<string, PromemoriaOccorrenza>>(new Map());

  useEffect(() => {
    const desiderati = occorrenzeDaRicordare(ripassi);
    // Nothing to remind about yet: don't ask for permission until there is a
    // reason to, same as Drive only asks for consent on the first attachment.
    if (desiderati.length === 0 && programmati.current.size === 0) return;

    let vivo = true;
    (async () => {
      const concesso = await assicuraPermessoNotifiche();
      if (!vivo || !concesso) return;

      const { daPianificare, daCancellare } = diffPromemoria(desiderati, programmati.current);
      for (const id of daCancellare) {
        try {
          await repo.cancella(id);
          programmati.current.delete(id);
        } catch (e) {
          reportError(e, { operazione: "cancellaPromemoria", occorrenzaId: id });
        }
      }
      for (const p of daPianificare) {
        try {
          await repo.pianifica(p.id, p.titolo, p.quando);
          programmati.current.set(p.id, p);
        } catch (e) {
          reportError(e, { operazione: "pianificaPromemoria", occorrenzaId: p.id });
        }
      }
    })();

    return () => {
      vivo = false;
    };
  }, [ripassi, repo]);
}
