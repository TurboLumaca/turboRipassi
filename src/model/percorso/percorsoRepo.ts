/**
 * Model layer — where the state of the journey is kept between launches.
 *
 * Phase, enrolment and per-training mastery have no table on Supabase: the
 * redesign specifies the screens, not an API. Until one exists they live in a
 * single small JSON file on the device, behind the same `interface` + default
 * implementation the server-backed repositories use — so the day the columns
 * appear, only this file changes and the controller above it does not notice.
 *
 * A file rather than a SQLite table because there is exactly one row of it:
 * the attachment cache needs queries, this needs `read` and `write`.
 *
 * The cost of the choice, stated plainly because it contradicts a founding
 * promise of the project ("one account, the same things on every device"):
 * this state does not sync. Enrol on the phone and the tablet still shows the
 * guest home. It is accepted for now because the journey is a demo of the
 * redesign rather than sold functionality, and because the data is
 * reconstructible in a few taps — but it is an exception, and it is written
 * down in the report as one.
 *
 * ---------------------------------------------------------------------------
 * If the journey is ever sold, this is the whole change
 * ---------------------------------------------------------------------------
 * The schema, the RLS policy and the reasoning are in
 * `supabase/futuro/0004_percorso.sql`, which is deliberately NOT a migration:
 * nothing in `supabase/migrations/` applies it, and no code below reads it.
 * The work would be:
 *
 *   1. apply that file as migration 0004;
 *   2. add, next to this one, a second implementation of `PercorsoRepo` —
 *
 *        export const percorsoRepoRemoto: PercorsoRepo = {
 *          async leggi() {
 *            const { data, error } = await supabase
 *              .from("percorso").select("stato").maybeSingle();
 *            if (error) { reportError(error, { dove: "leggiPercorso" }); return STATO_INIZIALE; }
 *            return normalizza(data?.stato);
 *          },
 *          async scrivi(stato) {
 *            const { error } = await supabase.from("percorso").upsert({ stato });
 *            if (error) reportError(error, { dove: "scriviPercorso" });
 *          },
 *        };
 *
 *   3. pass it to the provider: `<PercorsoProvider repo={percorsoRepoRemoto}>`.
 *
 * Nothing else moves. `normalizza` is reused as it is and stops being merely
 * defensive — over the network the payload really is foreign — and the file
 * implementation stays as the offline fallback, which is the reason the
 * repository is a parameter of the provider rather than a module it imports.
 */
import * as FileSystem from "expo-file-system/legacy";
import { reportError } from "@/config/crashReporting";
import type { Iscrizione } from "./fasi";
import type { Padronanze } from "./allenamenti";
import { LINGUA_PREDEFINITA, isLingua, type Lingua } from "@/model/flashcard/flashcard";

const FILE = FileSystem.documentDirectory + "percorso.json";

export interface StatoPercorso {
  iscrizione: Iscrizione;
  padronanze: Padronanze;
  /** Language of the flashcard deck. Shown in the profile, so it is state. */
  lingua: Lingua;
  /** Which study programme is selected, by id. */
  programma: string | null;
}

/**
 * What a fresh install looks like: not enrolled, nothing trained.
 *
 * `ospite` is the right default rather than a wrong guess — an app that
 * assumed an enrolment would show a course day to somebody who has not bought
 * anything, and the guest state is the one that degrades gracefully.
 */
export const STATO_INIZIALE: StatoPercorso = {
  iscrizione: { inizio: null },
  padronanze: {},
  lingua: LINGUA_PREDEFINITA,
  programma: null,
};

/**
 * Narrow whatever is on disk to the shape we expect.
 *
 * The file is ours, but it is also a file: a half-written save or a version
 * from an older build must not take the app down. Every field falls back to
 * its initial value independently, so one bad key costs one key.
 */
function normalizza(raw: unknown): StatoPercorso {
  if (typeof raw !== "object" || raw === null) return STATO_INIZIALE;
  const o = raw as Record<string, unknown>;

  const iscrizioneRaw = o.iscrizione as Record<string, unknown> | undefined;
  const inizio = typeof iscrizioneRaw?.inizio === "string" ? iscrizioneRaw.inizio : null;
  const sede = typeof iscrizioneRaw?.sede === "string" ? iscrizioneRaw.sede : undefined;
  const tutor = typeof iscrizioneRaw?.tutor === "string" ? iscrizioneRaw.tutor : undefined;

  const padronanze: Record<string, number> = {};
  if (typeof o.padronanze === "object" && o.padronanze !== null) {
    for (const [id, v] of Object.entries(o.padronanze as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) padronanze[id] = v;
    }
  }

  return {
    iscrizione: { inizio, sede, tutor },
    padronanze,
    lingua: typeof o.lingua === "string" && isLingua(o.lingua) ? o.lingua : LINGUA_PREDEFINITA,
    programma: typeof o.programma === "string" ? o.programma : null,
  };
}

/**
 * The one contract the Controller knows about.
 *
 * Same shape as `RipassiRepo` and `AllegatiRepo`: an interface plus a default
 * implementation, injected rather than imported. Here it also happens to be
 * what makes the paragraph above a three-line change instead of a rewrite.
 */
export interface PercorsoRepo {
  leggi(): Promise<StatoPercorso>;
  scrivi(stato: StatoPercorso): Promise<void>;
}

export const percorsoRepo: PercorsoRepo = {
  /**
   * Read the saved state. Never throws: a journey nobody can read is a journey
   * that starts over, which is recoverable — a crash on launch is not.
   */
  async leggi(): Promise<StatoPercorso> {
    try {
      const info = await FileSystem.getInfoAsync(FILE);
      if (!info.exists) return STATO_INIZIALE;
      return normalizza(JSON.parse(await FileSystem.readAsStringAsync(FILE)));
    } catch (e) {
      reportError(e, { dove: "leggiPercorso" });
      return STATO_INIZIALE;
    }
  },

  /**
   * Write the state back.
   *
   * Failures are reported and swallowed: the caller has already updated the
   * screen, and an alert saying the mastery could not be persisted would
   * interrupt a training session to report something the next save will fix.
   */
  async scrivi(stato: StatoPercorso): Promise<void> {
    try {
      await FileSystem.writeAsStringAsync(FILE, JSON.stringify(stato));
    } catch (e) {
      reportError(e, { dove: "scriviPercorso" });
    }
  },
};
