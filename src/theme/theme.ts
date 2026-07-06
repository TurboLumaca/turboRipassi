/**
 * Tema colori dell'app — sezione 9 della spec: blu e giallo.
 * Isolato qui: nessun componente View definisce colori inline.
 * Modificando questo file cambia l'intera palette senza toccare la logica.
 */
export const theme = {
  colors: {
    // Blu
    primary: "#1E3A8A",
    primaryDark: "#152C6B",
    primaryLight: "#3B5BB5",
    // Giallo (accento / call to action)
    accent: "#F5C518",
    accentDark: "#D9AC0B",
    // Superfici
    background: "#F4F6FB",
    surface: "#FFFFFF",
    surfaceAlt: "#EDF1FA",
    // Testo
    text: "#111827",
    textMuted: "#6B7280",
    textOnPrimary: "#FFFFFF",
    textOnAccent: "#1E3A8A",
    // Stati
    border: "#D9DEEA",
    danger: "#DC2626",
    success: "#16A34A",
    completed: "#9CA3AF",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
    pill: 999,
  },
  font: {
    small: 13,
    body: 15,
    title: 18,
    heading: 22,
    large: 28,
  },
} as const;

export type Theme = typeof theme;
