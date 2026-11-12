/**
 * Controller — the materie (subject tags): the list, and creating one.
 *
 * Loaded from the server and mirrored to the device; with no connection the
 * mirror is what the form and the filter bar show. Creating a materia needs
 * the server (there is no queued path for it), and says so instead of failing
 * with a database error: the tag has to exist before a ripasso can point at
 * it, and a ripasso saved offline may only point at one that already does.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { materieRepo as repoDefault, type MaterieRepo } from "@/model/materie/materieRepo";
import { leggiMaterieSalvate, salvaMaterie } from "@/model/materie/materieOffline";
import {
  erroreNome,
  normalizzaNome,
  ordinaMaterie,
  prossimoColore,
  trovaPerNome,
} from "@/model/materie/materieLogic";
import { idLocale } from "@/model/shared/idLocale";
import { reportError } from "@/config/crashReporting";
import type { Materia } from "@/model/types";

export interface StatoMaterie {
  /** In ordine alfabetico. */
  materie: Materia[];
  /** Rilegge dal server; non lancia: in caso di errore resta la lista che c'era. */
  ricaricaMaterie: () => Promise<void>;
  /**
   * Crea una materia, con il primo colore libero della tavolozza.
   * Se esiste già una materia con quel nome restituisce quella, senza errore:
   * chi la scrive due volte la vuole, non vuole un messaggio.
   * Lancia con un messaggio per l'utente se il nome non è valido.
   */
  creaMateria: (nome: string) => Promise<Materia>;
}

export function useMaterie(repo: MaterieRepo = repoDefault): StatoMaterie {
  const [materie, setMaterie] = useState<Materia[]>([]);

  const ricaricaMaterie = useCallback(async () => {
    try {
      const dalServer = await repo.leggi();
      setMaterie(dalServer);
      await salvaMaterie(dalServer);
    } catch (e) {
      // Not worth an alert: the list on screen is the saved one, and the
      // ripassi's own load already tells the user the connection is down.
      reportError(e, { operazione: "leggiMaterie" });
    }
  }, [repo]);

  useEffect(() => {
    let attivo = true;
    void (async () => {
      const salvate = await leggiMaterieSalvate();
      if (attivo && salvate) setMaterie((attuali) => (attuali.length === 0 ? salvate : attuali));
      await ricaricaMaterie();
    })();
    return () => {
      attivo = false;
    };
  }, [ricaricaMaterie]);

  const creaMateria = useCallback(
    async (nome: string): Promise<Materia> => {
      const esistente = trovaPerNome(materie, nome);
      if (esistente) return esistente;
      const errore = erroreNome(materie, nome);
      if (errore) throw new Error(errore);

      const creata = await repo.crea({
        id: idLocale(),
        nome: normalizzaNome(nome),
        colore: prossimoColore(materie),
      });
      const aggiornate = [...materie.filter((m) => m.id !== creata.id), creata];
      setMaterie(aggiornate);
      await salvaMaterie(aggiornate);
      return creata;
    },
    [materie, repo]
  );

  const ordinate = useMemo(() => ordinaMaterie(materie), [materie]);

  return { materie: ordinate, ricaricaMaterie, creaMateria };
}
