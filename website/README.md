# Ripassa — sito di presentazione

Sito statico (HTML + CSS + un piccolo JS) che presenta il progetto **Ripassa**
a chi lo vede per la prima volta. Vive interamente in questa cartella:
**non condivide nulla con il codice dell'app** (`src/`, `App.tsx`, ecc.), che
resta un progetto React Native separato nella radice del repository. Nessuna
dipendenza, nessun processo di build: è pronto da servire così com'è.

## Struttura

```
website/
  index.html              Home / landing
  come-funziona.html       Il ciclo di un ripasso, allegati, offline, sync
  architettura.html        Stack tecnico, diagramma dei livelli, qualità e sicurezza
  contatti.html             Contatto e FAQ
  assets/
    css/style.css          Foglio di stile unico, condiviso da tutte le pagine
    js/main.js              Menu mobile, evidenziazione pagina corrente, anno nel footer
    img/                    Asset visivi (vedi sotto)
  image-prompts.md          Prompt testuali per generare le immagini mancanti
```

## Perché queste quattro pagine

- **Home** — il punto d'ingresso: cosa fa Ripassa e perché, in trenta secondi.
- **Come funziona** — per chi vuole capire il meccanismo (intervalli di
  ripasso, allegati su Drive, offline, sync) prima di fidarsi.
- **Architettura** — pagina tecnica per un pubblico diverso (chi valuta o
  mantiene il codice): stack, diagramma dei livelli, qualità, sicurezza.
  Ha senso qui perché Ripassa è anche un progetto d'esame, non solo un
  prodotto: il pubblico tecnico è reale, non ipotetico.
- **Contatti** — unica call-to-action concreta possibile oggi: l'app non è
  su store pubblici, quindi il passo successivo è scrivere, non "scarica ora".

Non c'è una quinta pagina (prezzi, blog, changelog...) perché in questa fase
non ci sarebbe contenuto vero dietro: pagine vuote solo per "sembrare
completi" avrebbero indebolito il sito, non rafforzato.

## Direzione visiva

Palette e spaziature **riprendono `src/view/theme/theme.ts`** (blu
`#1C253F`/`#2A3B63`/`#4A5E8F`, oro `#C9A83B`/`#A8872A`): il sito e l'app
condividono la stessa identità, non ne inventano una nuova.

Stile: minimale e tecnico, con un accento caldo (l'oro, usato come una
sottolineatura da evidenziatore). Motivazione in una riga: il pubblico è
in parte chi valuta un progetto di ingegneria del software, in parte chi
studia — il tono doveva restare sobrio e leggibile, non "app consumer
giocosa", ma nemmeno freddo.

Tipografia: nessun font esterno, solo la native stack del sistema
operativo (vedi `assets/css/style.css`, motivazione lì). Nessuna immagine
generata è ancora presente: i punti che la richiedono usano un placeholder
in CSS puro (classe `.art`), etichettato col nome del file finale, così che
sostituirlo sia un cambio di una riga. Il diagramma dell'architettura e le
icone delle funzionalità sono invece SVG scritti a mano direttamente nel
markup — motivazione in `image-prompts.md`.

## Anteprima locale

Nessun build step: basta un server statico qualsiasi.

```bash
cd website && python3 -m http.server 4173
```

Poi apri `http://localhost:4173`.

## Asset visivi

`image-prompts.md` elenca ogni immagine ancora da generare, con un prompt
completo (soggetto, stile, palette, composizione, mood) e il punto esatto
del sito in cui va inserita.
