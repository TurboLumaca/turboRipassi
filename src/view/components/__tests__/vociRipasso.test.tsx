import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { RigaVoce } from "../vociRipasso";
import type { VoceRipasso } from "@/model/ripassi/ripassiLogic";

describe("RigaVoce", () => {
  const onApriMock = jest.fn();
  const onCompletaMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renderizza una voce normale senza badge permanente", async () => {
    const voce: VoceRipasso = {
      ripasso: {
        id: "r1",
        account_id: "a1",
        user_id: "u1",
        titolo: "Diritto Privato",
        domanda: null,
        ceremony_shown_at: null,
        note: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        occorrenze: [
          {
            id: "o1",
            ripasso_id: "r1",
            account_id: "a1",
            user_id: "u1",
            scheduled_at: "2026-01-02T10:00:00.000Z",
            is_manual_1h: false,
            is_completed: false,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        allegati: [],
      },
      occorrenza: {
        id: "o1",
        ripasso_id: "r1",
        account_id: "a1",
        user_id: "u1",
        scheduled_at: "2026-01-02T10:00:00.000Z",
        is_manual_1h: false,
        is_completed: false,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    };

    await render(
      <RigaVoce voce={voce} onApri={onApriMock} onCompleta={onCompletaMock} />
    );

    expect(screen.getByText("Diritto Privato")).toBeTruthy();
    expect(screen.queryByText("Permanente")).toBeNull();

    await fireEvent.press(screen.getByText("Diritto Privato"));
    expect(onApriMock).toHaveBeenCalledWith(voce);

    await fireEvent.press(
      screen.getByLabelText("Richiama: Diritto Privato")
    );
    expect(onCompletaMock).toHaveBeenCalledWith(voce);
  });

  it("mostra il badge 'Permanente' quando il concetto ha raggiunto la memoria permanente", async () => {
    const vocePermanente: VoceRipasso = {
      ripasso: {
        id: "r2",
        account_id: "a1",
        user_id: "u1",
        titolo: "Formula di Taylor",
        domanda: null,
        ceremony_shown_at: null,
        note: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        occorrenze: [
          {
            id: "o1",
            ripasso_id: "r2",
            account_id: "a1",
            user_id: "u1",
            scheduled_at: "2026-01-02T10:00:00.000Z",
            is_manual_1h: false,
            is_completed: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "o2",
            ripasso_id: "r2",
            account_id: "a1",
            user_id: "u1",
            scheduled_at: "2026-01-08T10:00:00.000Z",
            is_manual_1h: false,
            is_completed: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "o3",
            ripasso_id: "r2",
            account_id: "a1",
            user_id: "u1",
            scheduled_at: "2026-02-01T10:00:00.000Z",
            is_manual_1h: false,
            is_completed: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "o4",
            ripasso_id: "r2",
            account_id: "a1",
            user_id: "u1",
            scheduled_at: "2026-07-01T10:00:00.000Z",
            is_manual_1h: false,
            is_completed: true,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        allegati: [],
      },
      occorrenza: {
        id: "o4",
        ripasso_id: "r2",
        account_id: "a1",
        user_id: "u1",
        scheduled_at: "2026-07-01T10:00:00.000Z",
        is_manual_1h: false,
        is_completed: true,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    };

    await render(
      <RigaVoce voce={vocePermanente} onApri={onApriMock} onCompleta={onCompletaMock} />
    );

    expect(screen.getByText("Formula di Taylor")).toBeTruthy();
    expect(screen.getByText("Permanente")).toBeTruthy();
    expect(screen.getByLabelText("Memoria permanente")).toBeTruthy();
  });
});

/** Una voce di lista, con le sole parti che il test vuole diverse. */
function creaVoce(over: {
  ripasso?: Partial<VoceRipasso["ripasso"]>;
  occorrenza?: Partial<VoceRipasso["occorrenza"]>;
} = {}): VoceRipasso {
  const occorrenza: VoceRipasso["occorrenza"] = {
    id: "o1",
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    scheduled_at: "2026-01-02T10:00:00.000Z",
    is_manual_1h: false,
    is_completed: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...over.occorrenza,
  };
  return {
    ripasso: {
      id: "r1",
      account_id: "a1",
      user_id: "u1",
      titolo: "Diritto Privato",
      domanda: null,
      ceremony_shown_at: null,
      note: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      occorrenze: [occorrenza],
      allegati: [],
      ...over.ripasso,
    },
    occorrenza,
  };
}

describe("RigaVoce — la domanda in lista e le vie per spuntarla", () => {
  // La lista mostra la domanda e mai la risposta: il curiosity gap resta
  // aperto fino all'interazione.
  it("mostra la domanda del concetto, non le note", async () => {
    const voce = creaVoce({
      ripasso: { domanda: "Perché ~2,25?", note: "Tversky & Kahneman." },
    });
    await render(
      <RigaVoce voce={voce} onApri={jest.fn()} onCompleta={jest.fn()} />
    );
    expect(screen.getByText("Perché ~2,25?")).toBeTruthy();
    expect(screen.queryByText("Tversky & Kahneman.")).toBeNull();
  });

  it("su un concetto già spuntato non ripropone la domanda", async () => {
    const voce = creaVoce({
      ripasso: { domanda: "Perché ~2,25?" },
      occorrenza: { is_completed: true },
    });
    await render(
      <RigaVoce voce={voce} onApri={jest.fn()} onCompleta={jest.fn()} />
    );
    expect(screen.queryByText("Perché ~2,25?")).toBeNull();
  });

  it("il long-press porta al completamento diretto quando è offerto", async () => {
    const diretto = jest.fn();
    const voce = creaVoce({ ripasso: { titolo: "Bayes" } });
    await render(
      <RigaVoce
        voce={voce}
        onApri={jest.fn()}
        onCompleta={jest.fn()}
        onCompletaDiretto={diretto}
      />
    );
    await fireEvent(screen.getByLabelText("Richiama: Bayes"), "longPress");
    expect(diretto).toHaveBeenCalledWith(voce);
  });

  it("senza completamento diretto il long-press non fa niente", async () => {
    const completa = jest.fn();
    const voce = creaVoce({ ripasso: { titolo: "Bayes" } });
    await render(
      <RigaVoce voce={voce} onApri={jest.fn()} onCompleta={completa} />
    );
    await fireEvent(screen.getByLabelText("Richiama: Bayes"), "longPress");
    expect(completa).not.toHaveBeenCalled();
  });
});
