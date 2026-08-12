/**
 * Tests for the pure rules of the outgoing queue.
 *
 * The interesting ones are about the merge: a queued ripasso has to be
 * indistinguishable from a stored one to every screen, and a partially
 * synced one — row up, photo not — has to keep showing the photo it is still
 * waiting on, which is exactly the moment it would be easiest to drop.
 */
import {
  allegatiInCoda,
  daCaricare,
  daSincronizzare,
  idRipassiInCoda,
  isBloccata,
  isVuota,
  occorrenzeInCoda,
  ripassoDaCoda,
  uniscoConCoda,
  TENTATIVI_MASSIMI,
  type FileInCoda,
  type VoceCoda,
} from "../codaLogic";
import type { RipassoCompleto } from "@/model/types";

function fileInCoda(over: Partial<FileInCoda> & { id: string }): FileInCoda {
  return {
    uri: `file:///coda/${over.id}.jpg`,
    nome: `${over.id}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 10,
    orderIndex: 0,
    driveFileId: null,
    ...over,
  };
}

function voce(over: Partial<VoceCoda> & { id: string }): VoceCoda {
  return {
    titolo: "Teorema di Bayes",
    note: null,
    occorrenze: [{ id: "o1", scheduled_at: "2026-08-12T09:00:00.000Z", is_manual_1h: false }],
    campiModificati: true,
    allegati: [],
    accodatoIl: "2026-08-11T09:00:00.000Z",
    tentativi: 0,
    ultimoErrore: null,
    ...over,
  };
}

function ripasso(over: Partial<RipassoCompleto> & { id: string }): RipassoCompleto {
  return {
    account_id: "a1",
    user_id: "u1",
    titolo: over.id,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    occorrenze: [],
    allegati: [],
    ...over,
  };
}

describe("isVuota", () => {
  it("è vuota solo quando non resta niente da mandare", () => {
    expect(isVuota(voce({ id: "r1", occorrenze: null, campiModificati: false }))).toBe(true);
  });

  it("un ripasso mai creato non è vuoto, per quanti allegati abbia", () => {
    expect(isVuota(voce({ id: "r1", campiModificati: false }))).toBe(false);
  });

  it("una modifica in attesa non è vuota anche senza allegati", () => {
    expect(isVuota(voce({ id: "r1", occorrenze: null, campiModificati: true }))).toBe(false);
  });
});

describe("daSincronizzare", () => {
  it("smette di ritentare le voci che hanno esaurito i tentativi", () => {
    // Una voce che fallisce per un motivo che l'attesa non risolve non deve
    // bruciare batteria a ogni riconnessione: resta visibile, non ritentata.
    const bloccata = voce({ id: "r1", tentativi: TENTATIVI_MASSIMI });
    expect(isBloccata(bloccata)).toBe(true);
    expect(daSincronizzare([bloccata, voce({ id: "r2" })]).map((v) => v.id)).toEqual(["r2"]);
  });

  it("salta le voci senza più niente da fare", () => {
    const finita = voce({ id: "r1", occorrenze: null, campiModificati: false });
    expect(daSincronizzare([finita])).toEqual([]);
  });
});

describe("occorrenzeInCoda", () => {
  it("dà a ogni data un id: i promemoria ci si agganciano subito", () => {
    let n = 0;
    const occorrenze = occorrenzeInCoda(new Date("2026-08-11T09:00:00.000Z"), false, () => `id-${n++}`);

    expect(occorrenze).toHaveLength(4);
    expect(occorrenze.map((o) => o.id)).toEqual(["id-0", "id-1", "id-2", "id-3"]);
  });

  it("con il +1 ora ne genera cinque, come il percorso online", () => {
    let n = 0;
    expect(occorrenzeInCoda(new Date(), true, () => `id-${n++}`)).toHaveLength(5);
  });
});

describe("ripassoDaCoda", () => {
  it("produce un RipassoCompleto ordinario, non un tipo a parte", () => {
    const r = ripassoDaCoda(
      voce({ id: "r1", allegati: [fileInCoda({ id: "a1", orderIndex: 2 })] })
    );

    expect(r.id).toBe("r1");
    expect(r.occorrenze[0].ripasso_id).toBe("r1");
    expect(r.allegati[0].order_index).toBe(2);
    expect(r.allegati[0].display_name).toBe("a1.jpg");
  });

  it("un allegato non ancora su Drive non finge di avere un percorso remoto", () => {
    const r = ripassoDaCoda(voce({ id: "r1", allegati: [fileInCoda({ id: "a1" })] }));
    expect(r.allegati[0].storage_path).toBe("");
  });

  it("riporta il Drive id appena ce n'è uno", () => {
    const r = ripassoDaCoda(
      voce({ id: "r1", allegati: [fileInCoda({ id: "a1", driveFileId: "drive-9" })] })
    );
    expect(r.allegati[0].storage_path).toBe("drive-9");
  });
});

describe("uniscoConCoda", () => {
  it("senza coda restituisce la lista del server intatta", () => {
    const dalServer = [ripasso({ id: "r1" })];
    expect(uniscoConCoda(dalServer, [])).toEqual(dalServer);
  });

  it("mette per primi i ripassi che esistono solo sul dispositivo", () => {
    const uniti = uniscoConCoda([ripasso({ id: "server" })], [voce({ id: "locale" })]);
    expect(uniti.map((r) => r.id)).toEqual(["locale", "server"]);
  });

  it("non duplica un ripasso già salito: vince la riga del server", () => {
    const uniti = uniscoConCoda(
      [ripasso({ id: "r1", titolo: "dal server" })],
      [voce({ id: "r1", titolo: "vecchio locale", occorrenze: null, campiModificati: false })]
    );

    expect(uniti).toHaveLength(1);
    expect(uniti[0].titolo).toBe("dal server");
  });

  it("dopo una sincronizzazione parziale mostra ancora l'allegato che manca", () => {
    // Riga su, due foto su tre su: la terza è sul dispositivo e l'utente sta
    // guardando proprio quella. Toglierla dalla lista sarebbe farla sparire
    // nel momento in cui la sta aspettando.
    const uniti = uniscoConCoda(
      [
        ripasso({
          id: "r1",
          allegati: [
            {
              id: "a1",
              ripasso_id: "r1",
              account_id: "a",
              user_id: null,
              display_name: "già-su.jpg",
              original_file_name: "già-su.jpg",
              storage_path: "drive-1",
              order_index: 0,
              mime_type: "image/jpeg",
              size_bytes: 1,
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          ],
        }),
      ],
      [
        voce({
          id: "r1",
          occorrenze: null,
          campiModificati: false,
          allegati: [fileInCoda({ id: "a2" })],
        }),
      ]
    );

    expect(uniti[0].allegati.map((a) => a.id)).toEqual(["a1", "a2"]);
  });
});

describe("cosa dire all'utente", () => {
  it("segnala come 'in coda' solo i ripassi la cui riga non esiste ancora", () => {
    // Un ripasso già sul server con una foto in attesa NON è a rischio: dirlo
    // allarmerebbe sulla cosa sbagliata.
    const ids = idRipassiInCoda([
      voce({ id: "nuovo" }),
      voce({ id: "solo-foto", occorrenze: null, campiModificati: false, allegati: [fileInCoda({ id: "a1" })] }),
    ]);

    expect([...ids]).toEqual(["nuovo"]);
  });

  it("raccoglie gli id di ogni allegato in attesa, da qualunque voce", () => {
    const ids = allegatiInCoda([
      voce({ id: "r1", allegati: [fileInCoda({ id: "a1" }), fileInCoda({ id: "a2" })] }),
      voce({ id: "r2", allegati: [fileInCoda({ id: "a3" })] }),
    ]);

    expect([...ids].sort()).toEqual(["a1", "a2", "a3"]);
  });

  it("descrive ogni voce con quello che le manca davvero", () => {
    const righe = daCaricare([
      voce({ id: "r1", titolo: "Bayes", allegati: [fileInCoda({ id: "a1" })] }),
      voce({ id: "r2", titolo: "Solo modifiche", occorrenze: null, campiModificati: true }),
      voce({ id: "vuota", occorrenze: null, campiModificati: false }),
    ]);

    expect(righe.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(righe[0]).toMatchObject({ ripassoNuovo: true, allegatiMancanti: 1, campiDaSalvare: false });
    expect(righe[1]).toMatchObject({ ripassoNuovo: false, allegatiMancanti: 0, campiDaSalvare: true });
  });

  it("mostra il motivo solo per le voci che hanno smesso di essere ritentate", () => {
    const righe = daCaricare([
      voce({ id: "r1", tentativi: TENTATIVI_MASSIMI, ultimoErrore: "Spazio esaurito" }),
      voce({ id: "r2", tentativi: 1, ultimoErrore: "Un intoppo passeggero" }),
    ]);

    expect(righe[0].bloccatoPer).toBe("Spazio esaurito");
    expect(righe[1].bloccatoPer).toBeNull();
  });
});
