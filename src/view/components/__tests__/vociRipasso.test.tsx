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
      screen.getByLabelText("Segna come completato: Diritto Privato")
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
