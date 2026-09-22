import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SchedaRichiamo } from "../SchedaRichiamo";
import type { StatoRichiamo } from "@/controller/ripassi/useRichiamo";
import type { VoceRipasso } from "@/model/ripassi/ripassiLogic";
import type { Occorrenza, RipassoCompleto } from "@/model/types";

function ripasso(over: Partial<RipassoCompleto> = {}): RipassoCompleto {
  return {
    id: "r1",
    account_id: "a1",
    user_id: "u1",
    titolo: "Avversione alla perdita",
    domanda: "Perché la perdita pesa ~2,25 volte il guadagno?",
    note: "Tversky & Kahneman, 1992.",
    ceremony_shown_at: null,
    created_at: "2026-09-01T09:00:00.000Z",
    updated_at: "2026-09-01T09:00:00.000Z",
    occorrenze: [],
    allegati: [],
    ...over,
  };
}

const occorrenza: Occorrenza = {
  id: "o1",
  ripasso_id: "r1",
  account_id: "a1",
  user_id: "u1",
  scheduled_at: "2026-09-21T09:00:00.000Z",
  is_manual_1h: false,
  is_completed: false,
  created_at: "2026-09-01T09:00:00.000Z",
  updated_at: "2026-09-01T09:00:00.000Z",
};

function stato(over: Partial<StatoRichiamo> = {}): StatoRichiamo {
  const voce: VoceRipasso = { ripasso: ripasso(), occorrenza };
  return {
    voce,
    passo: "domanda",
    domanda: "Perché la perdita pesa ~2,25 volte il guadagno?",
    feedback: null,
    inCaricamento: false,
    errore: null,
    apri: jest.fn(),
    mostraRisposta: jest.fn(),
    rispondi: jest.fn().mockResolvedValue(undefined),
    completaDiretto: jest.fn().mockResolvedValue(undefined),
    chiudi: jest.fn(),
    ...over,
  };
}

describe("SchedaRichiamo", () => {
  it("chiusa non disegna niente", async () => {
    await render(<SchedaRichiamo richiamo={stato({ voce: null })} />);
    expect(screen.queryByText("Mostra risposta")).toBeNull();
  });

  // Il curiosity gap resta aperto finché non si è provato a colmarlo da soli:
  // è questa la differenza fra un richiamo e un promemoria.
  it("sul primo passo mostra la domanda e tiene coperta la risposta", async () => {
    await render(<SchedaRichiamo richiamo={stato()} />);

    expect(screen.getByText("Perché la perdita pesa ~2,25 volte il guadagno?")).toBeTruthy();
    expect(screen.queryByText("Tversky & Kahneman, 1992.")).toBeNull();
    expect(screen.getByText("Mostra risposta")).toBeTruthy();
    // Le due risposte non esistono ancora: non si può giudicare un richiamo
    // che non è stato fatto.
    expect(screen.queryByText("Lo ricordavo")).toBeNull();
  });

  it("scoperta la risposta, offre le due sole risposte possibili", async () => {
    await render(<SchedaRichiamo richiamo={stato({ passo: "risposta" })} />);
    expect(screen.getByText("Tversky & Kahneman, 1992.")).toBeTruthy();
    expect(screen.getByText("Lo ricordavo")).toBeTruthy();
    expect(screen.getByText("Non del tutto")).toBeTruthy();
  });

  it("riporta i due esiti al Controller", async () => {
    const rispondi = jest.fn().mockResolvedValue(undefined);
    await render(<SchedaRichiamo richiamo={stato({ passo: "risposta", rispondi })} />);

    await fireEvent.press(screen.getByText("Lo ricordavo"));
    expect(rispondi).toHaveBeenCalledWith("ricordato");

    await fireEvent.press(screen.getByText("Non del tutto"));
    expect(rispondi).toHaveBeenCalledWith("parziale");
  });

  // Palette neutra, nessuna colpa, e la riprogrammazione detta in chiaro:
  // il desiderio che ne nasce è per il prossimo incontro con quel concetto.
  it("sull'errore produttivo riferisce un fatto e dice quando rientra", async () => {
    await render(
      <SchedaRichiamo
        richiamo={stato({
          passo: "erroreProduttivo",
          feedback: {
            frase: "Un richiamo mancato con feedback rafforza la memoria.",
            rientro: "Rientra fra 3 giorni.",
          },
        })}
      />
    );

    expect(screen.getByText("Hai appena rafforzato questo concetto.")).toBeTruthy();
    expect(screen.getByText("Un richiamo mancato con feedback rafforza la memoria.")).toBeTruthy();
    expect(screen.getByText("Rientra fra 3 giorni.")).toBeTruthy();
  });

  it("su un concetto senza note lo dice invece di mostrare il vuoto", async () => {
    const voce: VoceRipasso = { ripasso: ripasso({ note: null }), occorrenza };
    await render(<SchedaRichiamo richiamo={stato({ passo: "risposta", voce })} />);
    expect(screen.getByText(/non ha note/)).toBeTruthy();
  });

  it("dice quando un salvataggio non è andato a buon fine", async () => {
    await render(
      <SchedaRichiamo richiamo={stato({ passo: "risposta", errore: "Nessuna connessione" })} />
    );
    expect(screen.getByText("Nessuna connessione")).toBeTruthy();
  });

  it("mentre salva non lascia premere due volte", async () => {
    const rispondi = jest.fn().mockResolvedValue(undefined);
    await render(
      <SchedaRichiamo richiamo={stato({ passo: "risposta", inCaricamento: true, rispondi })} />
    );
    await fireEvent.press(screen.getByText("Salvataggio…"));
    expect(rispondi).not.toHaveBeenCalled();
  });
});

describe("SchedaRichiamo — i casi di contorno", () => {
  // Senza domanda propria la sheet chiede la cosa generica, e non ripete il
  // titolo sotto: sarebbe la stessa frase due volte.
  it("su un concetto senza domanda propria non ripete il titolo", async () => {
    const voce: VoceRipasso = { ripasso: ripasso({ domanda: null }), occorrenza };
    await render(
      <SchedaRichiamo
        richiamo={stato({
          voce,
          domanda: "Che cosa ricordi di «Avversione alla perdita»?",
        })}
      />
    );
    expect(screen.getByText("Che cosa ricordi di «Avversione alla perdita»?")).toBeTruthy();
    expect(screen.queryByText("Avversione alla perdita")).toBeNull();
  });

  // Gli allegati si nominano, non si aprono qui: un richiamo che diventa una
  // sessione di lettura non è più un richiamo.
  it("dice che ci sono allegati senza portarci dentro", async () => {
    const voce: VoceRipasso = {
      ripasso: ripasso({
        allegati: [
          {
            id: "a1",
            ripasso_id: "r1",
            account_id: "a1",
            user_id: "u1",
            display_name: "schema.pdf",
            original_file_name: "schema.pdf",
            storage_path: "drive-1",
            order_index: 0,
            mime_type: "application/pdf",
            size_bytes: 10,
            created_at: "2026-09-01T09:00:00.000Z",
            updated_at: "2026-09-01T09:00:00.000Z",
          },
        ],
      }),
      occorrenza,
    };
    await render(<SchedaRichiamo richiamo={stato({ passo: "risposta", voce })} />);
    expect(screen.getByText(/1 allegato/)).toBeTruthy();
  });

  it("chiudere dalla testata riporta al Controller", async () => {
    const chiudi = jest.fn();
    await render(<SchedaRichiamo richiamo={stato({ chiudi })} />);
    await fireEvent.press(screen.getByLabelText("Chiudi richiamo"));
    expect(chiudi).toHaveBeenCalledTimes(1);
  });

  it("dal feedback dell'errore si esce con un solo gesto", async () => {
    const chiudi = jest.fn();
    await render(
      <SchedaRichiamo
        richiamo={stato({
          passo: "erroreProduttivo",
          feedback: { frase: "Una frase.", rientro: "Rientra fra 3 giorni." },
          chiudi,
        })}
      />
    );
    await fireEvent.press(screen.getByText("Ho capito"));
    expect(chiudi).toHaveBeenCalledTimes(1);
  });
});
