import type { Seq } from '../parser/ast.ts';
import { layoutRoot } from './layout.ts';

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
] as const;

const STYLE = `
  .bg { fill: #0f172a; }
  .rail { fill: none; stroke: #0092b8; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .terminal { fill: #00d3f3; }
  .node { stroke-width: 1.5; }
  .node.literal { fill: #020618; stroke: #00d3f3; }
  .node.escape { fill: #020618; stroke: #a684ff; }
  .node.class { fill: #020618; stroke: #00d492; }
  .node.anchor { fill: #f6339a; stroke: #f6339a; }
  .node.charset { fill: #1d293d; stroke: #00b8db; }
  .label { font: 13px ui-monospace, Menlo, monospace; text-anchor: middle; fill: #a2f4fd; }
  .label.escape { fill: #ddd6ff; }
  .label.class { fill: #96f7d2; }
  .label.anchor { fill: #020618; }
  .caption { font: 11px ui-sans-serif, system-ui, sans-serif; fill: #00d3f3; text-anchor: middle; }
  .caption.legend { text-anchor: start; }
  .caption.start { text-anchor: start; fill: #ffdf20; }
  .caption.assertion { fill: #fb64b6; }
  .caption.charset { fill: #8ec5ff; }
  .caption.negated { fill: #ffb86a; }
  .frame { fill: none; stroke: #fdc700; stroke-width: 1.5; stroke-dasharray: 5 3; }
  .frame.assertion { stroke: #f6339a; }
  .frame.charset { stroke: #51a2ff; stroke-dasharray: none; fill: #1a2744; }
  .frame.negated { stroke: #ff8904; fill: #2b1c12; }
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
