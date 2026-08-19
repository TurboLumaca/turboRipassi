/**
 * Tests for ModalitaPausa component.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ModalitaPausa } from "../ModalitaPausa";

const mockAttivaPausa = jest.fn();
const mockRiprendiPausa = jest.fn();
let mockPausa = { attiva: false, dataInizio: undefined as string | undefined, dataFine: undefined as string | undefined };

jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({
    pausa: mockPausa,
    attivaPausa: mockAttivaPausa,
    riprendiPausa: mockRiprendiPausa,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPausa = { attiva: false, dataInizio: undefined, dataFine: undefined };
  mockAttivaPausa.mockResolvedValue(undefined);
  mockRiprendiPausa.mockResolvedValue(undefined);
});

describe("ModalitaPausa", () => {
  it("quando non attiva mostra le opzioni di durata e il testo esplicativo", async () => {
    await render(<ModalitaPausa />);

    expect(screen.getByText(/Hai un viaggio, un esame o un periodo di riposo\?/)).toBeTruthy();
    expect(screen.getByText("Weekend")).toBeTruthy();
    expect(screen.getByText("1 settimana")).toBeTruthy();
    expect(screen.getByText("Aperta")).toBeTruthy();
    expect(screen.getByText("Attiva modalità riposo")).toBeTruthy();
  });

  it("attiva la modalità riposo al tocco", async () => {
    await render(<ModalitaPausa />);

    await fireEvent.press(screen.getByText("Attiva modalità riposo"));

    await waitFor(() => expect(mockAttivaPausa).toHaveBeenCalledTimes(1));
    expect(mockAttivaPausa.mock.calls[0][0]).toMatchObject({
      attiva: true,
      motivo: "Weekend di riposo",
    });
  });

  it("permette di selezionare l'opzione settimana", async () => {
    await render(<ModalitaPausa />);

    await fireEvent.press(screen.getByText("1 settimana"));
    await fireEvent.press(screen.getByText("Attiva modalità riposo"));

    await waitFor(() => expect(mockAttivaPausa).toHaveBeenCalledTimes(1));
    expect(mockAttivaPausa.mock.calls[0][0]).toMatchObject({
      attiva: true,
      motivo: "Settimana di pausa",
    });
  });

  it("quando attiva mostra il badge di stato e l'opzione di ripresa immediata", async () => {
    mockPausa = {
      attiva: true,
      dataInizio: "2026-07-10T10:00:00.000Z",
      dataFine: "2026-07-17T10:00:00.000Z",
    };

    await render(<ModalitaPausa />);

    expect(screen.getByText("Modalità riposo attiva")).toBeTruthy();
    expect(screen.getByText(/I tuoi ripassi sono congelati/)).toBeTruthy();
    expect(screen.getByText("Riprendi i ripassi adesso")).toBeTruthy();

    await fireEvent.press(screen.getByText("Riprendi i ripassi adesso"));
    await waitFor(() => expect(mockRiprendiPausa).toHaveBeenCalledTimes(1));
  });

  it("quando attiva senza data fine (pausa aperta) mostra messaggio dedicato", async () => {
    mockPausa = {
      attiva: true,
      dataInizio: "2026-07-10T10:00:00.000Z",
      dataFine: undefined,
    };

    await render(<ModalitaPausa />);

    expect(screen.getByText(/fino alla tua riattivazione/)).toBeTruthy();
  });
});
