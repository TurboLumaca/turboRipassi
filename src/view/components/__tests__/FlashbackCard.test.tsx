import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FlashbackCard } from "../FlashbackCard";
import type { FlashbackItem } from "@/model/ripassi/flashbackLogic";

describe("FlashbackCard", () => {
  const mockFlashback: FlashbackItem = {
    voceId: "v1",
    titolo: "Algoritmo di Dijkstra",
    anteprima: "Trova i cammini minimi partendo da un nodo sorgente.",
    dataCreazioneOriginale: "2025-07-15T12:00:00.000Z",
    traguardo: "1_anno",
    giorniTrascorsi: 365,
  };

  const onApriMock = jest.fn();
  const onConfermaMock = jest.fn();
  const onDismissMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renderizza correttamente il titolo, l'anteprima e il badge temporale", async () => {
    await render(
      <FlashbackCard
        flashback={mockFlashback}
        onApri={onApriMock}
        onConferma={onConfermaMock}
        onDismiss={onDismissMock}
      />
    );

    expect(screen.getByText(/Ricordo · Esattamente 1 anno fa/i)).toBeTruthy();
    expect(screen.getByText("Algoritmo di Dijkstra")).toBeTruthy();
    expect(
      screen.getByText("Trova i cammini minimi partendo da un nodo sorgente.")
    ).toBeTruthy();
    expect(screen.getByText("Ho ancora in mente!")).toBeTruthy();
    expect(screen.getByText("Apri scheda")).toBeTruthy();
  });

  it("invoca onApri con voceId al tocco di Apri scheda", async () => {
    await render(
      <FlashbackCard
        flashback={mockFlashback}
        onApri={onApriMock}
        onConferma={onConfermaMock}
        onDismiss={onDismissMock}
      />
    );

    await fireEvent.press(screen.getByText("Apri scheda"));
    expect(onApriMock).toHaveBeenCalledWith("v1");
  });

  it("invoca onConferma al tocco di 'Ho ancora in mente!'", async () => {
    await render(
      <FlashbackCard
        flashback={mockFlashback}
        onApri={onApriMock}
        onConferma={onConfermaMock}
        onDismiss={onDismissMock}
      />
    );

    await fireEvent.press(screen.getByText("Ho ancora in mente!"));
    expect(onConfermaMock).toHaveBeenCalled();
  });

  it("invoca onDismiss al tocco del pulsante di chiusura", async () => {
    await render(
      <FlashbackCard
        flashback={mockFlashback}
        onApri={onApriMock}
        onConferma={onConfermaMock}
        onDismiss={onDismissMock}
      />
    );

    await fireEvent.press(screen.getByLabelText("Chiudi ricordo"));
    expect(onDismissMock).toHaveBeenCalled();
  });

  it("mostra il messaggio celebrativo quando celebrato è true", async () => {
    await render(
      <FlashbackCard
        flashback={mockFlashback}
        onApri={onApriMock}
        onConferma={onConfermaMock}
        onDismiss={onDismissMock}
        celebrato={true}
      />
    );

    expect(
      screen.getByText("La tua memoria a lungo termine è solida!")
    ).toBeTruthy();
    expect(screen.queryByText("Ho ancora in mente!")).toBeNull();
  });

  it("renderizza senza errori anche senza callback opzionali", async () => {
    await render(<FlashbackCard flashback={mockFlashback} />);
    expect(screen.getByText("Algoritmo di Dijkstra")).toBeTruthy();

    await render(<FlashbackCard flashback={mockFlashback} celebrato={true} />);
    expect(screen.getByText("La tua memoria a lungo termine è solida!")).toBeTruthy();
  });
});
