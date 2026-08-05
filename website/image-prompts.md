# Prompt per gli asset visivi

Il sito non contiene immagini generate: ogni punto in cui ne serve una usa
per ora un placeholder in CSS puro (classe `.art`, vedi
`assets/css/style.css`), con un'etichetta (`data-label`) che indica il nome
file da produrre. Sostituire un placeholder è un cambio locale: basta
aggiungere `background-image: url("assets/img/<nome>.png")` alla regola
`.art--*` corrispondente, o inserire un `<img>` al suo posto.

Due elementi **non** sono in questa lista perché sono già implementati
direttamente in codice, non come immagini generate — scelta motivata in
ciascun caso:

- **Le 4 icone delle funzionalità** (home, sezione "Cosa fa TurboRipassi”):
  SVG in linea, disegnate a mano nel markup. Un'icona funzionale deve
  restare nitida a ogni dimensione e pesare pochi byte; un'immagine
  generata via AI, qui, sarebbe solo un downgrade.
- **Il diagramma dell'architettura** (pagina Architettura): SVG in linea.
  È un diagramma tecnico che deve rappresentare esattamente i livelli
  Model/Controller/View e le dipendenze reali: la precisione conta più
  dell'atmosfera, quindi è codice, non un'illustrazione generata.
- **La favicon** (`assets/img/favicon.svg`): già presente, SVG disegnato a
  mano (un segno blu e oro con una "R"). Il prompt per un'icona più
  elaborata (da usare come icona reale dell'app, non solo per il tab del
  browser) è comunque incluso sotto, perché quello è un asset diverso.

Per ogni immagine sotto: soggetto, stile, palette, composizione, mood.
Palette di riferimento (`assets/css/style.css`): blu `#1C253F` / `#2A3B63` /
`#4A5E8F`, oro `#C9A83B` / `#A8872A`, superfici chiare `#F4F6FB` / `#FFFFFF`.

---

## 1. `hero_home.png` — Home, sezione hero

**Dove:** `index.html`, blocco `.art--hero`, accanto al titolo principale.

**Prompt:**
> Flat vector illustration, minimal and geometric, for a study/productivity
> app. A stylized human head in profile, rendered as a simple dark navy blue
> silhouette (#1C253F), with a warm gold (#C9A83B) spiral of small dots
> flowing outward from the temple — the dots start close together and grow
> farther apart as they spiral outward, suggesting memory intervals that
> stretch out over time (spaced repetition). Deep navy blue background
> (#1C253F to #2A3B63 soft gradient) with a subtle warm gold glow in one
> corner. No text, no UI elements, no photorealism — clean flat shapes,
> generous negative space, soft rounded geometry, calm and focused mood,
> slightly premium/editorial feel (think a modern productivity SaaS hero
> illustration). Square-ish composition, safe margin on all sides for
> cropping to a 4:3.4 frame.

## 2. `curva_oblio.png` — Home, sezione "Il problema"

**Dove:** `index.html`, blocco `.art--curva`.

**Prompt:**
> Minimal editorial line-chart illustration representing the forgetting
> curve: a single smooth curved line starting high on the left and
> descending steeply, then flattening out toward the bottom right, drawn in
> dark navy blue (#2A3B63) on a very light off-white/blue background
> (#F4F6FB). Along the curve, three or four small solid gold dots
> (#C9A83B) mark points where the line is "lifted" slightly upward with a
> short upward tick, representing moments of review that push the curve
> back up before it decays again — like a staircase pattern layered on the
> decay curve. No axis labels, no numbers, no text at all. Clean, technical,
> almost like a diagram from a well-designed textbook, generous white
> space, thin 2px line weight, subtle grid texture in the background at
> very low opacity. Landscape composition, 16:10.

## 3. `timeline_intervalli.png` — Come funziona, sezione intervalli

**Dove:** `come-funziona.html`, blocco `.art--timeline` (sopra i 5 step
"Adesso / +1 giorno / +1 settimana / +1 mese / +6 mesi").

**Prompt:**
> Wide horizontal abstract illustration representing a timeline that
> stretches and accelerates: a single horizontal path made of small circular
> nodes, starting tightly clustered on the left in dark navy blue (#1C253F)
> and gradually spreading further apart and warming in color toward gold
> (#C9A83B) on the right, following a gentle upward-curving arc like a
> gentle rocket trajectory. Background is a smooth diagonal gradient from
> navy blue (#1C253F) on the left through mid blue (#2A3B63) to warm gold
> (#A8872A) on the right. No text, no numbers, no icons — pure abstract
> geometry, minimal and confident, wide cinematic banner composition,
> aspect ratio 21:9.

## 4. `sync_dispositivi.png` — Come funziona, sezione offline/sync

**Dove:** `come-funziona.html`, blocco `.art--sync`.

**Prompt:**
> Flat minimal vector illustration showing three abstract device shapes
> (a rounded rectangle phone, a slightly larger rounded rectangle tablet, a
> rounded-corner laptop shape) arranged in a loose diagonal cluster, each
> outlined in soft white/light gold lines against a deep navy blue
> background (#1C253F to #2A3B63 gradient), connected to each other by
> thin curved gold (#C9A83B) lines with small pulse/dot animations
> suggested as small gold circles along the connecting lines, implying
> real-time sync between devices. No screens content, no text, no logos —
> the devices are empty silhouettes, the focus is entirely on the
> connection between them. Calm, technical, slightly futuristic but
> restrained mood. Square-ish composition, 4:3.

## 5. `contatti_scrivania.png` — Contatti

**Dove:** `contatti.html`, blocco `.art--contatti`.

**Prompt:**
> Flat, warm, minimal vector illustration of a cozy study desk seen from a
> slight top-down angle: an open notebook with a few simple squiggle lines
> representing handwritten notes, a pencil, and a highlighter lying
> diagonally across the page leaving a soft gold (#C9A83B) highlighted
> stripe on the paper. Color palette limited to soft off-white paper
> (#FFFFFF/#F4F6FB), dark navy blue line art (#2A3B63) for the objects, and
> the gold highlighter as the single accent color. Background is a very
> light neutral surface (#EDF1FA), no clutter, generous negative space.
> Friendly, approachable, low-key mood — this should feel human and
> personal, not corporate. Square-ish composition, 4:3.

## 6. `social_share.png` — Immagine di condivisione social (Open Graph)

**Dove:** referenziata in `<meta property="og:image">` in tutte e quattro
le pagine (anteprima quando un link al sito viene condiviso su social o
chat).

**Prompt:**
> Clean, bold social-media preview card, 1200x630px, landscape. Deep navy
> blue background (#1C253F) with a subtle radial gold (#C9A83B) glow in the
> top-right corner. Centered-left, large bold wordmark-style text "TurboRipassi"
> in clean geometric sans-serif, white, with a small gold period/dot after
> the word as an accent (matching a logo that reads "TurboRipassi."). Below it, a
> shorter line of text in a lighter weight, warm gold color: "Ripassi
> programmati, senza pensarci." To the right, a small abstract graphic
> echoing the spaced-repetition motif: a few gold dots spiraling outward
> with increasing spacing, minimal and not cluttered. High contrast, crisp,
> legible at thumbnail size, no photorealistic elements, flat design only.

## 7. `app-icon-mark.png` — Icona applicativa (uso futuro, store/app icon)

**Dove:** non referenziata dal sito attuale — pensata per quando servirà
un'icona reale per gli store, più elaborata della favicon SVG scritta a
mano già presente in `assets/img/favicon.svg`.

**Prompt:**
> App icon design, single centered symbol on a solid rounded-square dark
> navy blue background (#1C253F), flat and geometric, no gradients on the
> background. The symbol: a minimal circular arrow/loop (suggesting
> "coming back to review") rendered in warm gold (#C9A83B), with one small
> solid gold dot sitting just outside the loop where it would "release" —
> like a partial orbit with a satellite. Thick, confident line weight
> (matching modern iOS/Android app icon conventions), symmetrical,
> perfectly centered, no text, no letters. Must read clearly as a tiny
> thumbnail. Square canvas, 1024x1024px, flat design, no shadows, no
> photorealism.
