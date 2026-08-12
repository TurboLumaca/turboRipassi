/**
 * Test del guscio: la barra in basso, il menu laterale e il velo dell'ospite.
 *
 * Le quattro schermate delle schede sono sostituite da segnaposto: hanno i loro
 * test, e qui interessa solo che il guscio scelga quella giusta, intitoli la
 * testata di conseguenza e veli le sezioni che il corso include — mai i ripassi,
 * che sono liberi, e mai la Home, che è dove l'offerta viene fatta.
 */
import React from "react";
import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ContestoPercorso } from "@/controller/PercorsoContext";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

/**
 * Il guscio e la barra chiedono gli inset per non finire sotto la tacca in alto
 * e sull'indicatore in basso. Fuori da un `SafeAreaProvider` l'hook lancia, e
 * montare il provider vero in ogni test aggiungerebbe rumore senza verificare
 * nulla: qui i margini valgono zero.
 */
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

let mockPercorso: ContestoPercorso;
jest.mock("@/controller/PercorsoContext", () => ({
  usePercorso: () => mockPercorso,
}));

jest.mock("@/controller/AuthContext", () => ({
  useAuthCtx: () => ({ session: { user: { email: "marta@example.com" } } }),
}));

jest.mock("@/view/screens/HomeScreen", () => ({
  HomeScreen: () => {
    const { Text: T } = require("react-native");
    return <T>SCHERMATA HOME</T>;
  },
}));
jest.mock("@/view/screens/AllenatiScreen", () => ({
  AllenatiScreen: () => {
    const { Text: T } = require("react-native");
    return <T>SCHERMATA ALLENATI</T>;
  },
}));
jest.mock("@/view/screens/RipassiScreen", () => ({
  RipassiScreen: () => {
    const { Text: T } = require("react-native");
    return <T>SCHERMATA RIPASSA</T>;
  },
}));
jest.mock("@/view/screens/ContenutiScreen", () => ({
  ContenutiScreen: () => {
    const { Text: T } = require("react-native");
    return <T>SCHERMATA CONTENUTI</T>;
  },
}));

import { GuscioScreen } from "../GuscioScreen";

function contesto(over: Partial<ContestoPercorso> = {}): ContestoPercorso {
  return {
    pronto: true,
    fase: "pre",
    giorno: 0,
    giorniAllInizio: 12,
    settimaneDalCorso: 0,
    iscrizione: { inizio: "2026-09-12" },
    padronanze: {},
    batteria: 0,
    lingua: "Inglese",
    programma: null,
    registraSessione: jest.fn(),
    scegliLingua: jest.fn(),
    scegliProgramma: jest.fn(),
    impostaIscrizione: jest.fn(),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPercorso = contesto();
});

describe("Guscio — le quattro schede", () => {
  it("apre sulla Home, con il nome del prodotto in testata", async () => {
    await render(<GuscioScreen />);

    expect(screen.getByText("SCHERMATA HOME")).toBeTruthy();
    expect(screen.getByText("Genio in 21 giorni")).toBeTruthy();
  });

  it("la barra ha quattro voci, quelle che si aprono ogni giorno", async () => {
    await render(<GuscioScreen />);

    for (const voce of ["Home", "Allenati", "TurboRipassi", "Contenuti"]) {
      expect(screen.getByLabelText(voce)).toBeTruthy();
    }
    // Le Flashcard stanno nel menu laterale, non qui.
    expect(screen.queryByLabelText("Flashcard")).toBeNull();
  });

  it("cambiare scheda cambia contenuto e titolo", async () => {
    await render(<GuscioScreen />);

    await fireEvent.press(screen.getByLabelText("Allenati"));
    expect(screen.getByText("SCHERMATA ALLENATI")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("TurboRipassi"));
    expect(screen.getByText("SCHERMATA RIPASSA")).toBeTruthy();
    expect(screen.getAllByText("TurboRipassi").length).toBeGreaterThan(0);
  });
});

describe("Guscio — menu laterale", () => {
  it("è chiuso finché non lo si apre", async () => {
    await render(<GuscioScreen />);
    expect(screen.queryByText("Il tuo percorso")).toBeNull();
  });

  it("raggruppa le voci e le spiega una per una", async () => {
    await render(<GuscioScreen />);
    await fireEvent.press(screen.getByLabelText("Menu"));

    expect(screen.getByText("Il tuo percorso")).toBeTruthy();
    expect(screen.getByText("Strumenti")).toBeTruthy();
    expect(screen.getByText("Account")).toBeTruthy();
    expect(screen.getByText("Date in aula e colloqui col tutor")).toBeTruthy();
  });

  it("dice a che punto del percorso sei", async () => {
    mockPercorso = contesto({ fase: "durante", giorno: 7 });
    await render(<GuscioScreen />);
    await fireEvent.press(screen.getByLabelText("Menu"));

    expect(screen.getByText("Giorno 7 di 21")).toBeTruthy();
  });

  it("una voce porta alla sua schermata e chiude il menu", async () => {
    await render(<GuscioScreen />);
    await fireEvent.press(screen.getByLabelText("Menu"));
    await fireEvent.press(screen.getByText("Appuntamenti"));

    expect(mockNavigate).toHaveBeenCalledWith("Appuntamenti");
    expect(screen.queryByText("Il tuo percorso")).toBeNull();
  });

  it("all'ospite le flashcard restano visibili ma spente", async () => {
    mockPercorso = contesto({ fase: "ospite", iscrizione: { inizio: null } });
    await render(<GuscioScreen />);
    await fireEvent.press(screen.getByLabelText("Menu"));
    await fireEvent.press(screen.getByText("Flashcard"));

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("Guscio — velo dell'ospite", () => {
  beforeEach(() => {
    mockPercorso = contesto({ fase: "ospite", iscrizione: { inizio: null } });
  });

  it("non vela la Home: è dove l'offerta viene fatta", async () => {
    await render(<GuscioScreen />);
    expect(screen.queryByText("Incluso nel corso")).toBeNull();
  });

  it("non vela i ripassi: sono liberi e completi", async () => {
    await render(<GuscioScreen />);
    await fireEvent.press(screen.getByLabelText("TurboRipassi"));

    expect(screen.getByText("SCHERMATA RIPASSA")).toBeTruthy();
    expect(screen.queryByText("Incluso nel corso")).toBeNull();
  });

  it("vela gli allenamenti, lasciando vedere cosa sono", async () => {
    await render(<GuscioScreen />);
    await fireEvent.press(screen.getByLabelText("Allenati"));

    expect(screen.getByText("SCHERMATA ALLENATI")).toBeTruthy();
    expect(screen.getByText("Incluso nel corso")).toBeTruthy();
    expect(screen.getByText("Gli allenamenti si attivano con il corso")).toBeTruthy();
  });

  it("offre sempre la stessa coppia: scopri il corso, oppure usa i ripassi", async () => {
    await render(<GuscioScreen />);
    await fireEvent.press(screen.getByLabelText("Contenuti"));

    expect(screen.getByText("Scopri il corso")).toBeTruthy();
    await fireEvent.press(screen.getByText("Usa i ripassi"));
    expect(screen.getByText("SCHERMATA RIPASSA")).toBeTruthy();
  });

  it("chi è iscritto non vede nessun velo", async () => {
    mockPercorso = contesto({ fase: "pre" });
    await render(<GuscioScreen />);
    await fireEvent.press(screen.getByLabelText("Allenati"));

    expect(screen.queryByText("Incluso nel corso")).toBeNull();
  });
});

// Il segnaposto usato dai mock sopra vive qui solo per tenere buono il
// type-checker su un file che importa React senza altri JSX propri.
export const _Segnaposto = () => <Text>x</Text>;
