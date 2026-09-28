import { bozzaDaCondivisione, condivisioneVuota } from "../bozzaCondivisione";

describe("bozzaDaCondivisione", () => {
  it("un testo su più righe: la prima è il titolo, tutto il testo va nelle note", () => {
    const b = bozzaDaCondivisione({ text: "Teorema di Bayes\nP(A|B) = ..." });
    expect(b.titolo).toBe("Teorema di Bayes");
    expect(b.note).toBe("Teorema di Bayes\nP(A|B) = ...");
    expect(b.file).toEqual([]);
  });

  it("una riga breve sta nel titolo e non si ripete nelle note", () => {
    expect(bozzaDaCondivisione({ text: "  Ciclo di Krebs " })).toMatchObject({
      titolo: "Ciclo di Krebs",
      note: "",
    });
  });

  it("accorcia un titolo troppo lungo", () => {
    const b = bozzaDaCondivisione({ text: "a".repeat(200) });
    expect(b.titolo).toHaveLength(80);
    expect(b.titolo.endsWith("…")).toBe(true);
  });

  it("un link nudo: il titolo è il dominio, le note il link", () => {
    const url = "https://www.example.com/articolo?id=1";
    expect(bozzaDaCondivisione({ text: url, webUrl: url })).toMatchObject({
      titolo: "example.com",
      note: url,
    });
  });

  it("un link con titolo di pagina usa quel titolo", () => {
    const b = bozzaDaCondivisione({
      text: "https://example.com/x",
      webUrl: "https://example.com/x",
      meta: { title: "Una pagina" },
    });
    expect(b.titolo).toBe("Una pagina");
    expect(b.note).toBe("https://example.com/x");
  });

  it("solo webUrl, senza testo", () => {
    expect(bozzaDaCondivisione({ webUrl: "https://a.it/p" })).toMatchObject({
      titolo: "a.it",
      note: "https://a.it/p",
    });
  });

  it("un file: il titolo è il nome senza estensione e diventa allegato", () => {
    const b = bozzaDaCondivisione({
      files: [{ path: "file:///c/UML.pdf", fileName: "UML + Sviluppo.pdf", mimeType: "application/pdf", size: 10 }],
    });
    expect(b.titolo).toBe("UML + Sviluppo");
    expect(b.note).toBe("");
    expect(b.file).toEqual([
      { uri: "file:///c/UML.pdf", name: "UML + Sviluppo.pdf", mimeType: "application/pdf", size: 10 },
    ]);
  });

  it("senza nome dichiarato prende l'ultimo pezzo del percorso, poi un nome generico", () => {
    const b = bozzaDaCondivisione({
      files: [{ path: "file:///c/foto%201.jpg" }, { path: "content://" }],
    });
    expect(b.file.map((f) => f.name)).toEqual(["foto 1.jpg", "condiviso-2"]);
    expect(b.file[0].mimeType).toBeNull();
  });

  it("testo e file insieme: il testo dà il titolo, i file restano allegati", () => {
    const b = bozzaDaCondivisione({
      text: "Appunti",
      files: [{ path: "file:///a.png", fileName: "a.png" }],
    });
    expect(b.titolo).toBe("Appunti");
    expect(b.file).toHaveLength(1);
  });
});

describe("condivisioneVuota", () => {
  it("riconosce una condivisione senza contenuto", () => {
    expect(condivisioneVuota({})).toBe(true);
    expect(condivisioneVuota({ text: "  ", files: [] })).toBe(true);
    expect(condivisioneVuota({ text: "x" })).toBe(false);
    expect(condivisioneVuota({ webUrl: "https://a.it" })).toBe(false);
    expect(condivisioneVuota({ files: [{ path: "f" }] })).toBe(false);
  });
});
