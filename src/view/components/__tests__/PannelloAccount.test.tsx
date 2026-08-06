/**
 * Tests for the account section of the Profilo screen.
 *
 * It exists to answer one question — "why do I see these ripassi and not
 * others?" — so the assertions are about what it tells the user, not about
 * layout. Two things must hold: the reassurance that ripassi follow the
 * account rather than the sign-in method is actually on screen, and the
 * "Collega Google" action appears only when there is something to link.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

let mockGoogleCollegato = false;
let mockError: string | null = null;
const mockCollegaGoogle = jest.fn();

jest.mock("@/controller/AuthContext", () => ({
  useAuthCtx: () => ({
    session: { user: { email: "tizio@example.com" } },
    googleCollegato: mockGoogleCollegato,
    collegaGoogle: mockCollegaGoogle,
    error: mockError,
  }),
}));

import { PannelloAccount } from "../PannelloAccount";

beforeEach(() => {
  mockGoogleCollegato = false;
  mockError = null;
  mockCollegaGoogle.mockReset().mockResolvedValue(true);
});

describe("PannelloAccount", () => {
  it("mostra l'indirizzo", async () => {
    await render(<PannelloAccount />);
    expect(screen.getByText(/tizio@example\.com/)).toBeTruthy();
  });

  it("spiega che i ripassi seguono l'account e non il metodo di accesso", async () => {
    await render(<PannelloAccount />);
    expect(screen.getByText(/non al modo in cui entri/)).toBeTruthy();
  });

  it("offre il collegamento di Google quando manca", async () => {
    await render(<PannelloAccount />);

    expect(screen.getByText("Metodi")).toBeTruthy();
    expect(screen.getByText("Email e password")).toBeTruthy();

    await fireEvent.press(screen.getByText("Collega Google"));
    expect(mockCollegaGoogle).toHaveBeenCalledTimes(1);
  });

  it("non lo offre quando Google è già collegato", async () => {
    mockGoogleCollegato = true;
    await render(<PannelloAccount />);

    expect(screen.getByText("Email e Google")).toBeTruthy();
    expect(screen.queryByText("Collega Google")).toBeNull();
  });

  // L'errore è quello condiviso dal Controller: se il collegamento fallisce,
  // fallisce qui, e questo è l'unico posto dove l'utente lo vedrebbe.
  it("mostra l'errore del collegamento invece di lasciarlo muto", async () => {
    mockError = "Questo account Google è già collegato a un altro accesso.";
    await render(<PannelloAccount />);
    expect(screen.getByText(/già collegato a un altro accesso/)).toBeTruthy();
  });
});
