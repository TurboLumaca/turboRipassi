/**
 * Component tests for MicroSessioneModal.tsx
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { MicroSessioneModal } from "../MicroSessioneModal";
import type { StatoMicroSessione } from "@/controller/ripassi/useMicroSessione";
import type { VoceRipasso } from "@/model/ripassi/ripassiLogic";

function mockVoce(id: string, titolo: string, note: string | null = null): VoceRipasso {
  return {
    ripasso: {
      id,
      account_id: "a1",
      user_id: "u1",
      titolo,
      note,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      occorrenze: [],
      allegati: [],
    },
    occorrenza: {
      id: `occ-${id}`,
      ripasso_id: id,
      account_id: "a1",
      user_id: "u1",
      scheduled_at: "2026-07-15T10:00:00.000Z",
      is_manual_1h: false,
      is_completed: false,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    },
  };
}

describe("MicroSessioneModal", () => {
  const v1 = mockVoce("r1", "Teorema di Pitagora", "Note geometriche");
  const v2 = mockVoce("r2", "Costituzione Italiana");

  let mockConferma: jest.Mock;
  let mockPosticipa: jest.Mock;
  let mockChiudi: jest.Mock;
  let mockAvvia: jest.Mock;

  beforeEach(() => {
    mockConferma = jest.fn().mockResolvedValue(undefined);
    mockPosticipa = jest.fn().mockResolvedValue(undefined);
    mockChiudi = jest.fn();
    mockAvvia = jest.fn();
  });

  function creaStato(over: Partial<StatoMicroSessione> = {}): StatoMicroSessione {
    return {
      aperta: true,
      elementi: [v1, v2],
      indiceCorrente: 0,
      elementoCorrente: v1,
      completata: false,
      conteggioCompletati: 0,
      secondiTrascorsi: 0,
      inCaricamento: false,
      errore: null,
      avvia: mockAvvia,
      confermaCorrente: mockConferma,
      posticipaCorrente: mockPosticipa,
      chiudi: mockChiudi,
      ...over,
    };
  }

  it("non renderizza nulla se aperta è false", async () => {
    const stato = creaStato({ aperta: false });
    const res = await render(<MicroSessioneModal sessione={stato} />);
    expect(res.toJSON()).toBeNull();
  });

  it("mostra il concetto corrente, le note e l'indicatore di avanzamento", async () => {
    const stato = creaStato();
    await render(<MicroSessioneModal sessione={stato} />);

    expect(screen.getByText("Pausa rapida · 60s")).toBeTruthy();
    expect(screen.getByText("Teorema di Pitagora")).toBeTruthy();
    expect(screen.getByText("Note geometriche")).toBeTruthy();
    expect(screen.getByText("1 di 2")).toBeTruthy();
    expect(screen.getByText("Ho ripassato")).toBeTruthy();
    expect(screen.getByText("Rimanda a domani")).toBeTruthy();
  });

  it("completa il concetto corrente al tocco di 'Ho ripassato'", async () => {
    const stato = creaStato();
    await render(<MicroSessioneModal sessione={stato} />);

    await fireEvent.press(screen.getByText("Ho ripassato"));
    expect(mockConferma).toHaveBeenCalledWith("");
  });

  it("posticipa il concetto al tocco di 'Rimanda a domani'", async () => {
    const stato = creaStato();
    await render(<MicroSessioneModal sessione={stato} />);

    await fireEvent.press(screen.getByText("Rimanda a domani"));
    expect(mockPosticipa).toHaveBeenCalled();
  });

  it("apre il campo micro-nota e passa il testo a confermaCorrente", async () => {
    const stato = creaStato();
    await render(<MicroSessioneModal sessione={stato} />);

    await fireEvent.press(screen.getByText("Aggiungi micro-riflessione (opzionale)"));
    const input = screen.getByPlaceholderText("Scrivi un appunto veloce...");
    await fireEvent.changeText(input, "Importante per il test");

    await fireEvent.press(screen.getByText("Ho ripassato"));
    expect(mockConferma).toHaveBeenCalledWith("Importante per il test");
  });

  it("mostra la schermata di successo quando completata è true", async () => {
    const stato = creaStato({
      completata: true,
      elementoCorrente: null,
      conteggioCompletati: 2,
      secondiTrascorsi: 45,
    });
    await render(<MicroSessioneModal sessione={stato} />);

    expect(screen.getByText("Ottimo lavoro!")).toBeTruthy();
    expect(screen.getByText("2 concetti consolidati in 45 secondi.")).toBeTruthy();

    await fireEvent.press(screen.getByText("Torna alla Home"));
    expect(mockChiudi).toHaveBeenCalled();
  });
});
