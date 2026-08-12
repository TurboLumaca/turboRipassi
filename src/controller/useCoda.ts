/**
 * Controller — the queue of saves waiting for a connection, and the worker
 * that drains it.
 *
 * The promise this keeps: pressing Salva never fails because of the network.
 * The ripasso is written to the device, appears in the list with its dates and
 * its reminders, and goes up to Supabase and Drive by itself the moment there
 * is a connection again — while the app is open, without blocking anything the
 * user is doing.
 *
 * What "in background" means here is worth being exact about, because there are
 * two things it can mean. This drains without holding up the UI, and it starts
 * on its own when connectivity returns or when the app comes back to the
 * foreground. It is NOT an OS-level background task: with the app killed,
 * nothing runs, and the upload happens at the next launch. Doing better needs
 * expo-background-task and a native rebuild — worth it if the queue turns out
 * to sit full for days, pointless if it drains on the next app open, which is
 * the case this is written for.
 *
 * Draining is deliberately sequential. The entries are photos on a connection
 * that has just come back, often a bad one; three parallel uploads on a train
 * make all three slower and all three likelier to fail.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  accodaSalvataggio,
  leggiCoda,
  rimuoviVoce,
  segnaCompletati,
  aggiornaVoce,
  type SalvataggioDaAccodare,
} from "@/model/outbox/coda";
import { daSincronizzare, type VoceCoda } from "@/model/outbox/codaLogic";
import { ripassiRepo, type RipassiRepo } from "@/model/ripassi/ripassiRepo";
import { allegatiRepo, type AllegatiRepo } from "@/model/allegati/allegatiRepo";
import { registraFileLocale } from "@/model/cache/localCache";
import { isErroreDiRete, messaggioErrore } from "@/model/shared/errorMessages";
import { reportError } from "@/config/crashReporting";
import { useAuthCtx } from "./AuthContext";
import { useConnettivita } from "./useConnettivita";

/** What the queue offers the rest of the app. */
export interface StatoCoda {
  /** Everything still waiting to be sent, oldest first. */
  voci: VoceCoda[];
  /** True while the worker is going through it. */
  sincronizzando: boolean;
  /**
   * Set when the queue is held up by something the user has to resolve rather
   * than wait out — today that means Drive access was never granted or has been
   * revoked. Null while the only thing missing is a connection, which needs no
   * explaining beyond the offline banner already on screen.
   */
  bloccoDrive: boolean;
  /**
   * Defers a save. Resolves once it is safely on disk — a queued save that was
   * never written is the one failure the user must hear about, because they are
   * about to walk away believing their ripasso exists.
   */
  accoda: (input: SalvataggioDaAccodare) => Promise<void>;
  /**
   * Drains the queue now, at the user's request. Unlike the automatic pass this
   * one may ask for Drive consent, because there is someone looking at it.
   */
  sincronizzaOra: () => Promise<void>;
  /** Throws an entry away, files and all. For a save the user gives up on. */
  scarta: (id: string) => Promise<void>;
}

/**
 * The repos are parameters with defaults, like everywhere else in this layer:
 * the hook depends on the two contracts, not on module paths, so a test can
 * drive a whole sync with fakes and no network.
 */
export function useCoda(
  onSincronizzato: () => void,
  repoRipassi: RipassiRepo = ripassiRepo,
  repoAllegati: AllegatiRepo = allegatiRepo
): StatoCoda {
  const [voci, setVoci] = useState<VoceCoda[]>([]);
  const [sincronizzando, setSincronizzando] = useState(false);
  const [bloccoDrive, setBloccoDrive] = useState(false);
  const { online } = useConnettivita();
  const { assicuraAccessoDrive, accessoDrivePronto } = useAuthCtx();

  const montato = useRef(true);
  /**
   * True while a drain is running. A ref and not state: it is claimed before
   * the first await, so a re-render arriving mid-drain — and there will be
   * several, the list reloads as entries land — cannot start a second worker
   * over the same files.
   */
  const inCorso = useRef(false);

  useEffect(() => {
    montato.current = true;
    return () => {
      montato.current = false;
    };
  }, []);

  const ricarica = useCallback(async () => {
    const attuali = await leggiCoda();
    if (montato.current) setVoci(attuali);
  }, []);

  useEffect(() => {
    void ricarica();
  }, [ricarica]);

  const accoda = useCallback(
    async (input: SalvataggioDaAccodare) => {
      const voce = await accodaSalvataggio(input);
      // The files are on this device already. Registering them in the cache is
      // what lets the user open the photo they have just taken, through the
      // same lookup as any other attachment — `risolviUri` never learns that
      // the queue exists. The rotation is told to leave them alone (see
      // `idsProtetti`), because this is their only copy.
      for (const a of voce.allegati) {
        try {
          await registraFileLocale(a.id, a.uri);
        } catch (e) {
          // The save itself is safe on disk; not being able to open the file
          // until it is uploaded is a smaller failure than losing it.
          reportError(e, { operazione: "registraFileInCoda", allegatoId: a.id });
        }
      }
      await ricarica();
    },
    [ricarica]
  );

  const scarta = useCallback(
    async (id: string) => {
      await rimuoviVoce(id);
      await ricarica();
    },
    [ricarica]
  );

  /**
   * Sends one entry. Returns whether the connection is still usable — false
   * stops the whole pass, because the next entry would only fail the same way,
   * and each failure costs a Drive round trip and a chunk of battery.
   */
  const inviaVoce = useCallback(
    async (v: VoceCoda, driveOk: boolean): Promise<boolean> => {
      const caricati: string[] = [];
      let ripassoFatto = false;

      try {
        // The row first: the RLS policy on both children checks that the
        // parent ripasso exists and belongs to the same account, so an
        // attachment sent before it is rejected rather than orphaned.
        if (v.occorrenze !== null) {
          await repoRipassi.creaDaCoda({
            id: v.id,
            titolo: v.titolo,
            note: v.note,
            occorrenze: v.occorrenze,
          });
          ripassoFatto = true;
        } else if (v.campiModificati) {
          await repoRipassi.aggiorna(v.id, { titolo: v.titolo, note: v.note });
          ripassoFatto = true;
        }

        for (const a of v.allegati) {
          // Not an error worth counting against the entry: the ripasso is
          // safely up, and the files stay queued until the user grants Drive
          // access. Saying so is the banner's job, not the worker's.
          if (!driveOk) break;
          await repoAllegati.caricaDaCoda({
            id: a.id,
            ripassoId: v.id,
            localUri: a.uri,
            originalFileName: a.nome,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            orderIndex: a.orderIndex,
            driveFileId: a.driveFileId,
            // Recorded before the metadata row exists, so a crash in between
            // costs one insert and not a second copy of the photo on Drive.
            onBinarioCaricato: async (driveFileId) => {
              await aggiornaVoce(v.id, (voce) => ({
                ...voce,
                allegati: voce.allegati.map((x) =>
                  x.id === a.id ? { ...x, driveFileId } : x
                ),
              }));
            },
          });
          caricati.push(a.id);
        }

        await segnaCompletati(v.id, caricati, ripassoFatto);
        return true;
      } catch (e) {
        // Whatever did land stays landed: recording the partial progress is
        // what makes the next pass resume instead of restarting, which on a
        // ripasso with four photos is the difference between finishing over a
        // flaky connection and never finishing at all.
        await segnaCompletati(v.id, caricati, ripassoFatto);

        if (isErroreDiRete(e)) return false;

        // Anything else is this entry's own problem — a title the database
        // refuses, a Drive with no space left. Counted against it so it stops
        // being retried forever, and reported once: a queued save that can
        // never go up is exactly the failure nobody would otherwise see.
        await aggiornaVoce(v.id, (voce) => ({
          ...voce,
          tentativi: voce.tentativi + 1,
          ultimoErrore: messaggioErrore(e),
        }));
        reportError(e, { operazione: "sincronizzaCoda", ripassoId: v.id });
        return true;
      }
    },
    [repoRipassi, repoAllegati]
  );

  /**
   * One pass over the queue.
   *
   * `interattivo` is the difference between the user tapping "Carica ora" and
   * the network quietly coming back: only the first may open a Drive consent
   * browser, because only the first has someone waiting for it.
   */
  const sincronizza = useCallback(
    async (interattivo: boolean) => {
      if (inCorso.current) return;
      const attuali = daSincronizzare(await leggiCoda());
      if (attuali.length === 0) return;

      inCorso.current = true;
      if (montato.current) setSincronizzando(true);
      try {
        const servonoFile = attuali.some((v) => v.allegati.length > 0);
        const driveOk = !servonoFile
          ? true
          : interattivo
          ? await assicuraAccessoDrive()
          : await accessoDrivePronto();

        // Told, not reported: a missing authorization is not a defect, it is a
        // tap the user has not made yet, and Sentry cannot do anything with it.
        if (montato.current) setBloccoDrive(servonoFile && !driveOk);

        for (const v of attuali) {
          const reteViva = await inviaVoce(v, driveOk);
          if (!reteViva) break;
        }
      } finally {
        inCorso.current = false;
        if (montato.current) setSincronizzando(false);
        await ricarica();
        // The list on screen is now behind: entries that went up are rows the
        // server has, and until it is reloaded they would show twice — once
        // from the queue, once from Realtime.
        onSincronizzato();
      }
    },
    [assicuraAccessoDrive, accessoDrivePronto, inviaVoce, ricarica, onSincronizzato]
  );

  const sincronizzaOra = useCallback(() => sincronizza(true), [sincronizza]);

  /**
   * The two moments worth trying again.
   *
   * Connectivity returning is the obvious one. The foreground is the one that
   * matters in practice: NetInfo does not always fire while the app is
   * suspended, so the phone that spent the night on wifi with a queue full of
   * photos would otherwise wake up with it still full.
   */
  useEffect(() => {
    if (!online) return;
    void sincronizza(false);

    const sub = AppState.addEventListener("change", (stato) => {
      if (stato === "active") void sincronizza(false);
    });
    return () => sub.remove();
  }, [online, sincronizza]);

  return { voci, sincronizzando, bloccoDrive, accoda, sincronizzaOra, scarta };
}
