/**
 * Test del confine d'errore che avvolge tutto l'albero.
 *
 * È l'unica rete fra un errore di render e una schermata bianca, e la relazione
 * lo presenta come parte della «rete di sicurezza per distribuire l'app»: vale
 * la pena che le tre cose che promette siano verificate invece che affermate —
 * mostra il fallback, segnala l'errore al crash reporting, e «Riprova»
 * ricostruisce davvero l'albero invece di lasciare il fallback sullo schermo.
 */
import React from "react";
import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

const mockReportError = jest.fn();
jest.mock("@/config/crashReporting", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

import { ErrorBoundary } from "../ErrorBoundary";

/** Scoppia finché `esplodi` resta vero. */
function Fragile({ esplodi }: { esplodi: boolean }) {
  if (esplodi) throw new Error("boom");
  return <Text>Contenuto</Text>;
}

/**
 * React registra l'errore catturato su console.error: senza questo la suite
 * stampa uno stack di componenti per ogni test, e il rumore nasconde i
 * fallimenti veri.
 */
let silenzia: jest.SpyInstance;

beforeEach(() => {
  mockReportError.mockClear();
  silenzia = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  silenzia.mockRestore();
});

it("finché non succede niente mostra i figli e non segnala nulla", async () => {
  await render(
    <ErrorBoundary>
      <Fragile esplodi={false} />
    </ErrorBoundary>
  );

  expect(screen.getByText("Contenuto")).toBeTruthy();
  expect(mockReportError).not.toHaveBeenCalled();
});

it("un errore di render diventa un messaggio, non una schermata bianca", async () => {
  await render(
    <ErrorBoundary>
      <Fragile esplodi />
    </ErrorBoundary>
  );

  expect(screen.getByText("Qualcosa è andato storto")).toBeTruthy();
  expect(screen.getByText("Riprova")).toBeTruthy();
  expect(screen.queryByText("Contenuto")).toBeNull();
});

it("l'errore arriva al crash reporting con lo stack dei componenti", async () => {
  await render(
    <ErrorBoundary>
      <Fragile esplodi />
    </ErrorBoundary>
  );

  expect(mockReportError).toHaveBeenCalledTimes(1);
  const [errore, contesto] = mockReportError.mock.calls[0];
  expect((errore as Error).message).toBe("boom");
  expect(contesto).toHaveProperty("componentStack");
});

/** Un «Riprova» che rimostra il fallback è peggio di nessun pulsante. */
it("«Riprova» rimonta l'albero, e se la causa è passata torna il contenuto", async () => {
  const { rerender } = await render(
    <ErrorBoundary>
      <Fragile esplodi />
    </ErrorBoundary>
  );
  expect(screen.getByText("Qualcosa è andato storto")).toBeTruthy();

  await rerender(
    <ErrorBoundary>
      <Fragile esplodi={false} />
    </ErrorBoundary>
  );
  await fireEvent.press(screen.getByText("Riprova"));

  expect(screen.getByText("Contenuto")).toBeTruthy();
  expect(screen.queryByText("Qualcosa è andato storto")).toBeNull();
});
