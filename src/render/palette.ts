// Single source of truth for color. svg.ts reads it for the diagram, and main.ts publishes it
// as --<family>-<shade> CSS variables for the page.
export const PALETTE = {
  night: { page: '#0f172a', panel: '#1d293d', void: '#020618' },
  cyan: { deep: '#007595', dim: '#0092b8', base: '#00b8db', bright: '#00d3f3', light: '#53eafd', pale: '#a2f4fd' },
  magenta: { dark: '#4a1030', base: '#f6339a', bright: '#fb64b6', pale: '#fda5d5', selection: '#7a1850' },
  violet: { base: '#a684ff', pale: '#ddd6ff' },
  green: { base: '#00d492', pale: '#96f7d2' },
  yellow: { base: '#fdc700', bright: '#ffdf20' },
  blue: { base: '#51a2ff', pale: '#8ec5ff', tint: '#1a2744' },
  orange: { base: '#ff8904', pale: '#ffb86a', tint: '#2b1c12' },
} as const;

const { night, cyan, magenta, violet, green, yellow, blue, orange } = PALETTE;

export const COLORS = {
  background: night.page,
  rail: cyan.dim,
  terminal: cyan.bright,
  literal: { fill: night.void, stroke: cyan.bright, text: cyan.pale },
  escape: { fill: night.void, stroke: violet.base, text: violet.pale },
  class: { fill: night.void, stroke: green.base, text: green.pale },
  anchor: { fill: magenta.base, stroke: magenta.base, text: night.void },
  range: { fill: night.panel, stroke: cyan.base },
  caption: cyan.bright,
  group: { stroke: yellow.base, caption: yellow.bright },
  assertion: { stroke: magenta.base, caption: magenta.bright },
  oneOf: { stroke: blue.base, fill: blue.tint, caption: blue.pale },
  noneOf: { stroke: orange.base, fill: orange.tint, caption: orange.pale },
} as const;
