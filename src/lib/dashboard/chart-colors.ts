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
  AMBER, // #ffd400
  "#0072B2", // blue
  "#009E73", // bluish green
  "#CC79A7", // reddish purple
  "#D55E00", // vermillion
  "#56B4E9", // sky blue
  MUTED, // gray-400, overflow/other
] as const;

/** Dark tooltip on the ink end of the ramp, paper text. Shared across charts. */
export const TOOLTIP_STYLE = {
  backgroundColor: INK,
  border: "1px solid #383836", // gray-700
  borderRadius: 8,
  color: PAPER,
  fontSize: 12,
} as const;
