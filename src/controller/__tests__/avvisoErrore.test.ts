/**
 * Test dell'unica strada per cui un errore arriva all'utente.
 *
 * Due proprietà: che l'errore venga tradotto, riportato e mostrato — mai una
 * stringa di Postgres davanti a chi usa l'app — e che resti la traccia
 * dell'ultimo mostrato, che è quello che la segnalazione allega al posto
 * dell'utente (mezz'ora dopo si ricorda «non si caricava», non quale
 * operazione è fallita).
 */
import { Alert } from "react-native";

const mockReportError = jest.fn();
jest.mock("@/config/crashReporting", () => ({
  reportError: (...a: unknown[]) => mockReportError(...a),
}));

import { dimenticaUltimoErrore, mostraErrore, ultimoErroreMostrato } from "../avvisoErrore";

beforeEach(() => {
  jest.clearAllMocks();
  dimenticaUltimoErrore();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("mostraErrore", () => {
  it("mostra la traduzione, non il testo tecnico", () => {
    mostraErrore({ code: "23505", message: 'duplicate key value violates "ripassi_pkey"' });

    const [titolo, corpo] = (Alert.alert as unknown as jest.Mock).mock.calls[0];
    expect(titolo).toBe("Elemento già presente");
    expect(corpo).not.toContain("ripassi_pkey");
  });

  // Un errore non classificato non lascerebbe niente su cui agire: là, e solo
  // là, il testo originale vale più del silenzio.
  it("allega il dettaglio tecnico solo quando non ha saputo classificare", () => {
    mostraErrore(new Error("PGRST301: JWSError"));

    expect((Alert.alert as unknown as jest.Mock).mock.calls[0][1]).toContain("PGRST301");
  });

  it("riporta l'errore con l'operazione sotto cui archiviarlo", () => {
    const errore = new Error("Network request failed");

    mostraErrore(errore, "caricaAllegato", { ripassoId: "r1" });

    expect(mockReportError).toHaveBeenCalledWith(errore, {
      operazione: "caricaAllegato",
      ripassoId: "r1",
    });
  });

  it("archivia sotto «sconosciuta» chi non dichiara l'operazione", () => {
    mostraErrore(new Error("boom"));
    expect(mockReportError.mock.calls[0][1]).toMatchObject({ operazione: "sconosciuta" });
  });
});

describe("ultimoErroreMostrato", () => {
  it("non inventa un errore quando non ne è stato mostrato nessuno", () => {
    expect(ultimoErroreMostrato()).toBeNull();
  });

  it("tiene l'operazione, il messaggio letto e il testo originale", () => {
    mostraErrore({ message: "Quota exceeded" }, "caricaAllegato");

    const ultimo = ultimoErroreMostrato();
    expect(ultimo).toMatchObject({ operazione: "caricaAllegato" });
    expect(ultimo?.messaggio).toMatch(/spazio/i);
    // Il testo originale c'è anche per un errore riconosciuto: quello che ha
    // letto l'utente basta a riconoscere il guasto, non a indagarlo.
    expect(ultimo?.dettaglio).toContain("Quota exceeded");
  });

  it("tiene l'ultimo, non il primo", () => {
    mostraErrore(new Error("Network request failed"), "leggiRipassi");
    mostraErrore({ message: "Quota exceeded" }, "caricaAllegato");

    expect(ultimoErroreMostrato()?.operazione).toBe("caricaAllegato");
  });

  it("dimenticaUltimoErrore azzera la traccia", () => {
    mostraErrore(new Error("boom"), "test");
    dimenticaUltimoErrore();
    expect(ultimoErroreMostrato()).toBeNull();
  });
});
