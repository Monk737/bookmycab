/**
 * Shared chart colour system for the dashboard.
 *
 * Single source of truth so every chart stays on-brand and accessible:
 * - Brand neutrals (ink/paper/gray ramp) match globals.css token values.
 * - The categorical PALETTE is an Okabe-Ito-derived, colour-blind-safe set,
 *   led by brand Ink and Dispatch Amber. It is distinguishable under the common
 *   forms of colour-vision deficiency, but charts must STILL pair colour with a
 *   label (legend, axis or direct annotation): never encode meaning by hue alone.
 *
 * Hex literals are required because recharts takes colour props, not CSS classes.
 */

// Brand neutrals (mirror of globals.css :root tokens).
export const INK = "#0a0a0a";
export const PAPER = "#ffffff";
export const AMBER = "#ffd400";
export const GRID = "#dcdcda"; // gray-200, gridlines
export const AXIS = "#6f6f6b"; // gray-500, axis text (>=4.5:1 on paper)
export const MUTED = "#9a9a96"; // gray-400, de-emphasised series

/** Single-series default: ink reads as the confident, neutral data colour. */
export const PRIMARY = INK;

/**
 * Categorical palette for multi-series charts (donuts, stacked bars, legends).
 * Okabe-Ito-based, colour-blind-safe, brand-led. Order matters: the first two
 * carry the most weight (ink, then amber).
 */
export const PALETTE = [
  INK, // #0a0a0a
  AMBER, // #ffd400, brut-yellow
  "#2f6bff", // brut-blue
  "#c6f24e", // brut-lime
  "#ff7ac0", // brut-pink
  "#ff5247", // brut-red
  "#5fd9e8", // brut-cyan
  "#b794ff", // brut-violet
] as const;

/** Hard ink tooltip with a paper frame and sharp corners. Shared across charts. */
export const TOOLTIP_STYLE = {
  backgroundColor: INK,
  border: "2px solid #ffffff",
  borderRadius: 0,
  color: PAPER,
  fontSize: 12,
  fontWeight: 600,
} as const;
