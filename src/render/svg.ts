import type { Seq } from '../parser/ast.ts';
import { layoutRoot } from './layout.ts';
import { COLORS } from './palette.ts';

const MARGIN = 12;
const END_RADIUS = 6;
const END_RAIL = 16;
const LEGEND_H = 18;
const LEGEND_CHAR_W = 6.5;
const FLAG_NAMES = [
  ['i', 'ignore case'],
  ['m', 'dot matches newline'],
  ['x', 'extended'],
  ['n', 'no encoding'],
  ['u', 'UTF-8 encoding'],
] as const;

const C = COLORS;
const STYLE = `
  .bg { fill: ${C.background}; }
  .rail { fill: none; stroke: ${C.rail}; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .terminal { fill: ${C.terminal}; }
  .node { stroke-width: 1.5; }
  .node.literal { fill: ${C.literal.fill}; stroke: ${C.literal.stroke}; }
  .node.escape { fill: ${C.escape.fill}; stroke: ${C.escape.stroke}; }
  .node.class { fill: ${C.class.fill}; stroke: ${C.class.stroke}; }
  .node.anchor { fill: ${C.anchor.fill}; stroke: ${C.anchor.stroke}; }
  .node.charset { fill: ${C.range.fill}; stroke: ${C.range.stroke}; }
  .label { font: 13px ui-monospace, Menlo, monospace; text-anchor: middle; fill: ${C.literal.text}; }
  .label.escape { fill: ${C.escape.text}; }
  .label.class { fill: ${C.class.text}; }
  .label.anchor { fill: ${C.anchor.text}; }
  .caption { font: 11px ui-sans-serif, system-ui, sans-serif; fill: ${C.caption}; text-anchor: middle; }
  .caption.legend { text-anchor: start; }
  .caption.start { text-anchor: start; fill: ${C.group.caption}; }
  .caption.assertion { fill: ${C.assertion.caption}; }
  .caption.charset { fill: ${C.oneOf.caption}; }
  .caption.negated { fill: ${C.noneOf.caption}; }
  .frame { fill: none; stroke: ${C.group.stroke}; stroke-width: 1.5; stroke-dasharray: 5 3; }
  .frame.assertion { stroke: ${C.assertion.stroke}; }
  .frame.charset { stroke: ${C.oneOf.stroke}; stroke-dasharray: none; fill: ${C.oneOf.fill}; }
  .frame.negated { stroke: ${C.noneOf.stroke}; fill: ${C.noneOf.fill}; }
`;

export function renderSvg(root: Seq, flags = ''): string {
  const box = layoutRoot(root);
  const startX = MARGIN + END_RADIUS;
  const boxX = startX + END_RADIUS + END_RAIL;
  const endX = boxX + box.w + END_RAIL + END_RADIUS;
  const names = FLAG_NAMES.filter(([flag]) => flags.includes(flag)).map(([, name]) => name);
  const legend = names.length ? `Flags: ${names.join(', ')}` : '';
  const legendH = legend ? LEGEND_H : 0;
  const width = Math.max(endX + END_RADIUS + MARGIN, 2 * MARGIN + legend.length * LEGEND_CHAR_W);
  const height = legendH + box.h + 2 * MARGIN;
  const y = legendH + MARGIN + box.mid;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<style>${STYLE}</style>` +
    `<rect class="bg" width="${width}" height="${height}"/>` +
    (legend ? `<text class="caption legend" x="${MARGIN}" y="${MARGIN + 6}">${legend}</text>` : '') +
    `<circle class="terminal" cx="${startX}" cy="${y}" r="${END_RADIUS}"/>` +
    `<path class="rail" d="M${startX} ${y}H${boxX}"/>` +
    `<g transform="translate(${boxX} ${legendH + MARGIN})">${box.svg}</g>` +
    `<path class="rail" d="M${boxX + box.w} ${y}H${endX}"/>` +
    `<circle class="terminal" cx="${endX}" cy="${y}" r="${END_RADIUS}"/>` +
    `</svg>`
  );
}
