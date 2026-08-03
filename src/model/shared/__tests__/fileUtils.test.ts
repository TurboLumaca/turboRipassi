/**
 * Test — utilità pure sui file: estensione e decodifica base64 (usata
 * dall'upload su Storage: una regressione qui corrompe i file caricati).
 */
import { decodeBase64, estensione } from "../fileUtils";

describe("estensione", () => {
  it("estrae l'estensione dal nome file", () => {
    expect(estensione("foto.JPG")).toBe(".JPG");
    expect(estensione("archivio.tar.gz")).toBe(".gz");
  });

  it("ricava l'estensione dal mime quando il nome non ce l'ha", () => {
    expect(estensione("documento", "application/pdf")).toBe(".pdf");
    expect(estensione("img", "image/png")).toBe(".png");
    expect(estensione("img", "image/jpeg")).toBe(".jpg");
  });

  it("nome senza estensione e mime sconosciuto → stringa vuota", () => {
    expect(estensione("senza", "application/zip")).toBe("");
    expect(estensione("senza")).toBe("");
  });

  it("nome che termina col punto → non restituisce solo il punto", () => {
    expect(estensione("strano.", null)).toBe("");
  });
});

describe("decodeBase64", () => {
  function roundtrip(testo: string): void {
    const b64 = Buffer.from(testo, "utf-8").toString("base64");
    const atteso = new Uint8Array(Buffer.from(testo, "utf-8"));
    expect(decodeBase64(b64)).toEqual(atteso);
  }

  it("decodifica stringhe con padding 0, 1 e 2 (=, ==)", () => {
    roundtrip("abc"); // 3 byte → nessun padding
    roundtrip("a"); // 1 byte → ==
    roundtrip("ab"); // 2 byte → =
    roundtrip("abcd"); // 4 byte → blocco pieno + ==
  });

  it("decodifica dati binari arbitrari", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    const b64 = Buffer.from(bytes).toString("base64");
    expect(decodeBase64(b64)).toEqual(bytes);
  });

  it("ignora whitespace e newline (output di readAsStringAsync)", () => {
    const b64 = Buffer.from("contenuto di prova", "utf-8").toString("base64");
    const conAcapo = b64.replace(/(.{8})/g, "$1\n");
    expect(decodeBase64(conAcapo)).toEqual(
      new Uint8Array(Buffer.from("contenuto di prova", "utf-8"))
    );
  });

  it("stringa vuota → array vuoto", () => {
    expect(decodeBase64("")).toEqual(new Uint8Array(0));
  });
});
