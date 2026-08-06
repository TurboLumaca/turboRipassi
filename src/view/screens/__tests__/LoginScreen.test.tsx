/**
 * Test della schermata di accesso: verifica il cablaggio fra Controller e View.
 *
 * È l'unica schermata che si vede senza sessione, quindi ogni suo errore è un
 * errore che blocca l'app intera. Le asserzioni sono su cosa la schermata
 * mostra e su cosa parte al tocco — quale chiamata Supabase venga fatta è già
 * verificato nei test di useAuth.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

const mockSignInWithGoogle = jest.fn();
const mockSignInWithEmail = jest.fn();
const mockSignUpWithEmail = jest.fn();
let mockError: string | null = null;
jest.mock("@/controller/AuthContext", () => ({
  useAuthCtx: () => ({
    signInWithGoogle: mockSignInWithGoogle,
    signInWithEmail: mockSignInWithEmail,
    signUpWithEmail: mockSignUpWithEmail,
    error: mockError,
  }),
}));

let mockOnline = true;
jest.mock("@/controller/useConnettivita", () => ({
  useConnettivita: () => ({ online: mockOnline }),
}));

import { LoginScreen } from "../LoginScreen";

/** Compila i due campi con credenziali plausibili. */
async function compila(email = "tizio@example.com", password = "segretissima") {
  await fireEvent.changeText(screen.getByPlaceholderText("Email"), email);
  await fireEvent.changeText(screen.getByPlaceholderText("Password"), password);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockError = null;
  mockOnline = true;
  mockSignInWithEmail.mockResolvedValue(undefined);
  mockSignUpWithEmail.mockResolvedValue(undefined);
});

describe("LoginScreen", () => {
  it("propone Google come metodo principale", async () => {
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByText("Continua con Google"));

    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it("accede con email e password", async () => {
    await render(<LoginScreen />);
    await compila();

    await fireEvent.press(screen.getByText("Accedi"));

    expect(mockSignInWithEmail).toHaveBeenCalledWith("tizio@example.com", "segretissima");
  });

  // Uno spazio in coda all'indirizzo — che la tastiera aggiunge da sola — non
  // deve diventare un "credenziali non valide".
  it("ripulisce l'indirizzo dagli spazi prima di inviarlo", async () => {
    await render(<LoginScreen />);
    await compila("  tizio@example.com  ");

    await fireEvent.press(screen.getByText("Accedi"));

    expect(mockSignInWithEmail).toHaveBeenCalledWith("tizio@example.com", "segretissima");
  });

  it("passa alla registrazione e registra", async () => {
    await render(<LoginScreen />);
    await compila();

    await fireEvent.press(screen.getByText("Non hai un account? Registrati"));
    await fireEvent.press(screen.getByText("Registrati"));

    expect(mockSignUpWithEmail).toHaveBeenCalledWith("tizio@example.com", "segretissima");
    expect(mockSignInWithEmail).not.toHaveBeenCalled();
  });

  it("torna all'accesso dalla registrazione", async () => {
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByText("Non hai un account? Registrati"));
    await fireEvent.press(screen.getByText("Hai già un account? Accedi"));

    expect(screen.getByText("Accedi")).toBeTruthy();
  });

  // L'errore arriva dal Controller condiviso: se non comparisse qui, un
  // accesso rifiutato sarebbe indistinguibile da un tocco non registrato.
  it("mostra l'errore dell'accesso", async () => {
    mockError = "Email o password non corretti. Controlla i dati e riprova.";
    await render(<LoginScreen />);

    expect(screen.getByText(/Email o password non corretti/)).toBeTruthy();
  });

  it("avvisa che senza connessione non si entra", async () => {
    mockOnline = false;
    await render(<LoginScreen />);

    expect(screen.getByText(/Sei offline/)).toBeTruthy();
  });

  it("non mostra l'avviso di rete quando la connessione c'è", async () => {
    await render(<LoginScreen />);
    expect(screen.queryByText(/Sei offline/)).toBeNull();
  });
});
