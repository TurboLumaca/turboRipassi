/**
 * App theme — the structure of the Genio in 21 giorni redesign, realigned to
 * the LEARN IS identity: a navy/white/grey system with no decorative colour
 * anywhere.
 *
 * Isolated here: no View component defines inline colors. Changing this file
 * changes the entire palette without touching logic — which is why the whole
 * system could be retinted in one place, leaving the layout, the spacing and
 * the type exactly as they are.
 *
 * The old palette named each phase of the course by hue — yellow for phase 1,
 * green for phase 2, grey for phase 3. LEARN IS runs an almost monochrome
 * navy/white/grey system, so that meaning had to move from hue to *intensity*:
 * `accent` (phase 1) and `sage` (phase 2) are now both steps of the same navy
 * ramp as `neutral`, just read at different depths —
 *
 *   accent (fase 1)   the shallow end of navy: light tints, mid ink
 *   sage   (fase 2)   the deep end of navy: darker tints, near-black ink
 *   neutro (fase 3)   the grey ramp, desaturated — mantenimento reads as the
 *                     one phase that has stepped outside the navy voice
 *
 * `primary`/`inkSurface` are the LEARN IS navy, the chrome the app speaks
 * through everywhere: tab bar, battery card, lead-gen veil.
 */

/** Neutral ramp — the cool grey ground, surfaces, and phase 3. */
const neutral = {
  100: "#F8FAFD",
  200: "#EDF1FA",
  300: "#D9DEEA",
  400: "#B7C0D3",
  500: "#9CA3AF",
  600: "#7C8598",
  700: "#6B7280",
  800: "#374151",
  900: "#1C253F",
} as const;

/**
 * Navy ramp — the one hue in the system. `accent` reads its shallow end
 * (fase 1), `sage` its deep end (fase 2); `primary`/`inkSurface` sit at 800.
 */
const navy = {
  100: "#EEF1F7",
  200: "#DCE2EE",
  300: "#B9C4DC",
  400: "#8D9DC0",
  500: "#5A6C99",
  600: "#3C4F76",
  700: "#28395C",
  800: "#1B2A4A",
  900: "#111A2E",
} as const;

/** Phase 1 — the shallow end of the navy ramp. Still called `accent`: it is
 *  the role every screen already imports it for. */
const accent = {
  100: navy[100],
  200: navy[200],
  300: navy[300],
  400: navy[400],
  500: navy[500],
  600: navy[600],
  700: navy[700],
  800: navy[800],
  900: navy[900],
} as const;

/**
 * Phase 2 — the deep end of the same navy ramp, offset two steps darker so it
 * reads as "further along" next to `accent` at the same step. Still called
 * `sage`: the name is the role, and renaming it would touch every screen for
 * nothing.
 */
const sage = {
  100: navy[300],
  200: navy[400],
  300: navy[500],
  400: navy[600],
  500: navy[700],
  600: navy[800],
  700: navy[900],
  800: navy[900],
  900: "#0A1220",
} as const;

export const theme = {
  colors: {
    // Ground and surfaces
    background: "#F5F6FA",
    surface: "#FFFFFF",
    surfaceAlt: neutral[200],
    /** Panels that have to read as "the app is talking to you": tab bar,
     *  battery card, lead-gen veil. The LEARN IS navy. */
    inkSurface: navy[800],

    // Text
    text: navy[900],
    textMuted: neutral[700],
    textFaint: neutral[600],
    textOnInk: "#FFFFFF",
    /** White on navy: the pairing the call to action now uses — no colour
     *  left to pair against, only value. */
    textOnAccent: "#FFFFFF",

    // Accents — the three phases, one hue at three depths
    accent: navy[500],
    accentSoft: accent[200],
    accentInk: accent[700],
    accentBright: accent[400],
    sage: navy[700],
    sageSoft: sage[200],
    sageInk: sage[900],
    neutralSoft: neutral[200],
    neutralInk: neutral[800],

    // States
    border: neutral[300],
    borderStrong: neutral[400],
    /** Filled pips, checked boxes, "fatto" — the deep end of navy, not green. */
    success: navy[700],
    danger: "#DC2626",
    /** A done or expired row steps back without disappearing. */
    completed: neutral[500],

    // ── Compatibility aliases ────────────────────────────────────────────
    // The screens written before the redesign speak in terms of primary and
    // accent, and they mean the same things they always did: `primary` is the
    // navy chrome, `accent` is the phase-1 voice.
    primary: navy[800],
    primaryDark: navy[900],
    primaryLight: navy[600],
    accentDark: accent[600],
    textOnPrimary: "#FFFFFF",
    surfaceToday: accent[100],
    borderToday: accent[300],
  },

  /** The ramps, for the places that need a specific step. */
  ramp: { neutral, accent, sage },

  /**
   * Spacing — the design system's 1.10× density scale, rounded to whole
   * pixels. React Native has no sub-pixel layout worth the fractional values.
   */
  spacing: {
    xs: 4,
    sm: 9,
    md: 13,
    lg: 18,
    xl: 26,
    xxl: 35,
  },

  /**
   * Radii. LEARN IS runs square: containers take sharp corners, full stop.
   * `pill` survives at 999 only for shapes that are circular regardless of
   * brand — dots, progress bars, icon roundels — nothing that reads as a
   * card, button, chip or input border may use it.
   */
  radius: {
    sm: 0,
    md: 0,
    lg: 0,
    xl: 0,
    pill: 999,
  },

  /**
   * Typefaces. Anton is the display voice — the condensed, heavyweight face
   * the LEARN IS wordmark itself is set in. Figtree carries running text at
   * three weights. Lora's italic is the eyebrow voice: the light serif line
   * LEARN IS sets above a headline ("La tua Educazione Trasformativa").
   *
   * These are the names `expo-font` registers, so a family that failed to
   * load falls back to the system face instead of rendering nothing.
   */
  family: {
    heading: "Anton_400Regular",
    body: "Figtree_400Regular",
    semi: "Figtree_600SemiBold",
    bold: "Figtree_700Bold",
    eyebrow: "Lora_400Regular_Italic",
  },

  /**
   * Type scale. 11px exists only for meta lines; nothing meant to be read
   * sits below 13.
   */
  font: {
    meta: 11,
    small: 13,
    body: 15,
    title: 17,
    heading: 22,
    large: 28,
  },

  /** Section kickers: the light italic serif line LEARN IS sets above a
   *  headline — not shouted caps, a quieter voice above a louder one. */
  kicker: {
    fontSize: 14,
    letterSpacing: 0.1,
    textTransform: "none",
  },
} as const;

export type Theme = typeof theme;
