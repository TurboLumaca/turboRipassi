/**
 * Test — utilità pure sui file: inferenza dell'estensione, usata sia per il
 * nome su Drive sia per il file in cache (dove storage_path è un ID Drive e
 * non porta con sé alcuna estensione).
 */
import { estensione, isImmagine } from "../fileUtils";

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

describe("isImmagine", () => {
  it("riconosce i mime delle immagini", () => {
    expect(isImmagine("image/jpeg")).toBe(true);
    expect(isImmagine("image/png")).toBe(true);
  });

  it("non considera immagine PDF, mime assenti o vuoti", () => {
    expect(isImmagine("application/pdf")).toBe(false);
    expect(isImmagine(null)).toBe(false);
    expect(isImmagine(undefined)).toBe(false);
  });
});
