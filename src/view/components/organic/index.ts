/**
 * View — the components of the redesign, and nothing else.
 *
 * The old app drew each screen out of raw Views: two blues used without roles,
 * two hand-made checkboxes, a card shape that differed from screen to screen.
 * These are the shapes the design system actually names — card, chip, pill,
 * mastery ring, battery, segmented control — so that "the same thing" looks the
 * same everywhere by construction rather than by review.
 *
 * Every one of them takes its colours from `theme`. None of them knows what a
 * ripasso or an allenamento is: that is the screens' job.
 *
 * Era un file solo di 689 righe con quattordici componenti e un unico
 * `StyleSheet` in fondo, lontano da tutti. Adesso sono quattro file per
 * famiglia, ciascuno con i propri stili accanto ai componenti che li usano, e
 * questo indice tiene fermo il percorso di import: chi scrive
 * `@/view/components/organic` non ha visto la differenza, che è esattamente il
 * punto — la divisione riguarda chi mantiene il sistema, non chi lo usa.
 */
export { TONI, type Tono } from "./toni";
export { Kicker, Testo, Titolo, Vuoto } from "./testo";
export { RigaNavigabile, Scheda, SchedaScura } from "./superfici";
export { CampoRicerca, Chip, Pillola, Segmentato, Tendina } from "./controlli";
export { Barra, Batteria, Iniziali, Tacche } from "./indicatori";
