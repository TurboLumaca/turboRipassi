/**
 * Controller — the app's own settings, shared by every screen.
 *
 * A preference is read in two places and written in one, and the reader and
 * the writer are different screens that both stay mounted: the toggle lives in
 * the Profilo, the behaviour it changes on the Ripassi. Holding the state here
 — one provider above the navigation — is what makes the change land without
 * a remount, and what keeps the two screens from disagreeing.
 */
import React, { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import {
  IMPOSTAZIONI_INIZIALI,
  impostazioniRepo,
  type Impostazioni,
  type ImpostazioniRepo,
} from "@/model/impostazioni/impostazioniRepo";

export interface ContestoImpostazioni {
  /** The settings as they are now; the defaults until the file has been read. */
  impostazioni: Impostazioni;
  /** Persists a change; the in-memory state moves first, so the UI is instant. */
  salvaImpostazioni: (patch: Partial<Impostazioni>) => void;
}

const Ctx = createContext<ContestoImpostazioni | null>(null);

export function ImpostazioniProvider({
  children,
  repo: repoImpostazioni = impostazioniRepo,
}: {
  children: React.ReactNode;
  repo?: ImpostazioniRepo;
}) {
  const [impostazioni, setImpostazioni] = useState<Impostazioni>(IMPOSTAZIONI_INIZIALI);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const salvate = await repoImpostazioni.leggi();
      if (vivo) setImpostazioni(salvate);
    })();
    return () => {
      vivo = false;
    };
  }, [repoImpostazioni]);

  const salvaImpostazioni = useCallback(
    (patch: Partial<Impostazioni>) => {
      setImpostazioni((precedenti) => {
        const nuove = { ...precedenti, ...patch };
        void repoImpostazioni.scrivi(nuove);
        return nuove;
      });
    },
    [repoImpostazioni]
  );

  const valore = useMemo(
    () => ({ impostazioni, salvaImpostazioni }),
    [impostazioni, salvaImpostazioni]
  );
  return <Ctx value={valore}>{children}</Ctx>;
}

export function useImpostazioniCtx(): ContestoImpostazioni {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useImpostazioniCtx must be used inside <ImpostazioniProvider>.");
  return ctx;
}
