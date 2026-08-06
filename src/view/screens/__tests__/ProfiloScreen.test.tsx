/**
 * Test della schermata Profilo: è dove si vede con quale account si sta
 * lavorando, dove si collega Drive e da dove si esce.
 *
 * I due pannelli sono testati per conto loro (PannelloAccount.test.tsx); qui
 * interessa che la schermata li monti davvero e che l'uscita — l'unica azione
 * distruttiva della schermata — passi da una conferma prima di chiudere la
 * sessione.
 */
import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

let mockDriveAutorizzato = false;
const mockSignOut = jest.fn();
const mockAutorizzaDrive = jest.fn();
jest.mock("@/controller/AuthContext", () => ({
  useAuthCtx: () => ({
    session: { user: { email: "tizio@example.com" } },
    driveAutorizzato: mockDriveAutorizzato,
    googleCollegato: false,
    collegaGoogle: jest.fn(),
    autorizzaDrive: mockAutorizzaDrive,
    signOut: mockSignOut,
    error: null,
  }),
}));

const mockAggiornaDrive = jest.fn();
jest.mock("@/controller/auth/useAccountDrive", () => ({
  useAccountDrive: () => ({ stato: { stato: "nonCollegato" }, aggiorna: mockAggiornaDrive }),
}));

import { ProfiloScreen } from "../ProfiloScreen";

/** Esegue l'azione dell'ultimo Alert con l'etichetta data. */
async function premiNellAvviso(etichetta: string) {
  const spy = Alert.alert as unknown as jest.Mock;
  const bottoni = spy.mock.calls[spy.mock.calls.length - 1][2] as {
    text: string;
    onPress?: () => void;
  }[];
  await bottoni.find((b) => b.text === etichetta)?.onPress?.();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDriveAutorizzato = false;
  mockSignOut.mockResolvedValue(undefined);
  mockAggiornaDrive.mockResolvedValue(undefined);
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("ProfiloScreen", () => {
  // Compare due volte: come testata della schermata e nel pannello Accesso.
  it("mostra l'indirizzo dell'account", async () => {
    await render(<ProfiloScreen />);
    expect(screen.getAllByText("tizio@example.com").length).toBeGreaterThan(0);
  });

  it("dice se Drive è collegato", async () => {
    mockDriveAutorizzato = true;
    await render(<ProfiloScreen />);
    expect(screen.getByText(/Google Drive · collegato/)).toBeTruthy();
  });

  it("dice anche quando non lo è", async () => {
    await render(<ProfiloScreen />);
    expect(screen.getByText(/Google Drive · non collegato/)).toBeTruthy();
  });

  // Il form ha i suoi test (SegnalaProblema.test.tsx): qui basta che la
  // schermata lo monti, perché è l'unico posto da cui si raggiunge.
  it("offre di segnalare un problema", async () => {
    await render(<ProfiloScreen />);
    expect(screen.getByText("Segnala problema")).toBeTruthy();
  });

  // Uscire non distrugge nulla, ma è un muro fra l'utente e i suoi ripassi
  // finché non ridigita la password: un tocco solo non basta.
  it("non esce senza conferma", async () => {
    await render(<ProfiloScreen />);

    await fireEvent.press(screen.getByText("Esci"));

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Uscire dall'account?",
      expect.stringContaining("accedere di nuovo"),
      expect.any(Array)
    );
  });

  it("chiude la sessione quando la conferma arriva", async () => {
    await render(<ProfiloScreen />);

    await fireEvent.press(screen.getByText("Esci"));
    await premiNellAvviso("Esci");

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("annullare la conferma lascia la sessione aperta", async () => {
    await render(<ProfiloScreen />);

    await fireEvent.press(screen.getByText("Esci"));
    await premiNellAvviso("Annulla");

    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
