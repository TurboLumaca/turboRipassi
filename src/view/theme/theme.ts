/**
 * App theme — the structure of the Genio in 21 giorni redesign, in the colours
 * TurboRipassi has always had.
 *
 * Isolated here: no View component defines inline colors. Changing this file
 * changes the entire palette without touching logic — which is why the cream
 * and terracotta of the design system could be taken back out again in one
 * place, leaving the layout, the spacing and the type exactly as they are.
 *
 * The palette is the original blue and yellow of spec section 9: blue for the
 * chrome the app speaks through, yellow for the call to action, green for
 * confirmation. What the redesign added, and what survives here, is that each
 * one also names a phase of the course, and that is the only meaning colour
 * carries anywhere in the app:
 *
 *   giallo   fase 1 — prima del corso (batteria, allenamenti obbligatori)
 *   verde    fase 2 — durante il corso (sblocchi legati alle lezioni)
 *   neutro   fase 3 — mantenimento (e stati bloccati)
 *
 * The 100–900 ramps are built around those three base colours: the original
 * hex values sit at the step where they were already being used, so nothing
 * that was blue-grey became warm. Use 100–300 for tinted fills, 500 as the
 * role's base and 700–900 for text on top of those fills — yellow at full
 * strength never reaches contrast on prose, only on chrome and icons.
 */

/** Neutral ramp — the cool blue-grey ground, the surfaces, and phase 3. */
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

/** Yellow ramp — phase 1, the battery, and every primary action. */
const accent = {
  100: "#FDF6E0",
  200: "#F7EBC4",
  300: "#EAD9A4",
  400: "#DDBF62",
  500: "#C9A83B",
  600: "#A8872A",
  700: "#866A1E",
  800: "#5F4B14",
  900: "#3D300D",
} as const;

/**
 * Green ramp — phase 2, unlocks and confirmations. Still called `sage`: the
 * name is the role, and renaming it would touch every screen for nothing.
 */
const sage = {
  100: "#EAF7EE",
  200: "#D3EEDC",
  300: "#ABDCBC",
  400: "#6EC189",
  500: "#16A34A",
  600: "#12833C",
  700: "#0F6730",
  800: "#0B4A23",
  900: "#072F16",
} as const;

export const theme = {
  colors: {
    // Ground and surfaces
    background: "#F4F6FB",
    surface: "#FFFFFF",
    surfaceAlt: neutral[200],
    /** Panels that have to read as "the app is talking to you": tab bar,
     *  battery card, lead-gen veil. The blue chrome of the old app. */
    inkSurface: "#2A3B63",

    // Text
    text: "#111827",
    textMuted: neutral[700],
    textFaint: neutral[600],
    textOnInk: "#FFFFFF",
    /** Blue on yellow: the pairing the call to action has always used. */
    textOnAccent: "#1E3A8A",

    // Accents — the three phases
    accent: "#C9A83B",
    accentSoft: accent[200],
    accentInk: accent[700],
    accentBright: accent[400],
    sage: "#16A34A",
    sageSoft: sage[200],
    sageInk: sage[800],
    neutralSoft: neutral[200],
    neutralInk: neutral[800],

    // States
    border: neutral[300],
    borderStrong: neutral[400],
    /** Filled pips, checked boxes, "fatto". Green is the confirmation voice. */
    success: "#16A34A",
    danger: "#DC2626",
    /** A done or expired row steps back without disappearing. */
    completed: neutral[500],

    // ── Compatibility aliases ────────────────────────────────────────────
    // The screens written before the redesign speak in terms of primary and
    // accent, and they mean the same things they always did: `primary` is the
    // blue chrome, `accent` is the yellow.
    primary: "#2A3B63",
    primaryDark: "#1C253F",
    primaryLight: "#4A5E8F",
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
   * Radii. "Over-round" is a rule of the system, not a preference: containers
   * take `lg`, and anything small enough to be a control goes fully pill.
   */
  radius: {
    sm: 8,
    md: 16,
    lg: 26,
    xl: 32,
    pill: 999,
  },

  /**
   * Typefaces. Caprasimo is the only display voice and is never forced to
   * uppercase; Figtree carries everything else at three weights.
   *
   * These are the names `expo-font` registers, so a family that failed to
   * load falls back to the system face instead of rendering nothing.
   */
  family: {
    heading: "Caprasimo_400Regular",
    body: "Figtree_400Regular",
    semi: "Figtree_600SemiBold",
    bold: "Figtree_700Bold",
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

  /** Section kickers: the one place small caps survive. */
  kicker: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
} as const;

export type Theme = typeof theme;
