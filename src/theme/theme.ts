/**
 * App color theme — spec section 9: blue and yellow.
 * Isolated here: no View component defines inline colors.
 * Changing this file changes the entire palette without touching logic.
 */
export const theme = {
  colors: {
    // Blue
    primary: "#1E3A8A",
    primaryDark: "#152C6B",
    primaryLight: "#3B5BB5",
    // Yellow (accent / call to action)
    accent: "#F5C518",
    accentDark: "#D9AC0B",
    // Surfaces
    background: "#F4F6FB",
    surface: "#FFFFFF",
    surfaceAlt: "#EDF1FA",
    // Text
    text: "#111827",
    textMuted: "#6B7280",
    textOnPrimary: "#FFFFFF",
    textOnAccent: "#1E3A8A",
    // States
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
