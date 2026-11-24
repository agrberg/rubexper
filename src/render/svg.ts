import type { Seq } from '../parser/ast.ts';
import { layoutRoot } from './layout.ts';

const MARGIN = 12;
const END_RADIUS = 6;
const END_RAIL = 16;

const STYLE = `
  .rail { fill: none; stroke: #6b6659; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .terminal { fill: #6b6659; }
  .node { stroke: #6b6659; stroke-width: 1; }
  .node.literal { fill: #dae9a0; }
  .node.escape { fill: #f4dca7; }
  .node.class { fill: #c9d7ee; }
  .node.anchor { fill: #6b6659; }
  .node.charset { fill: #e4e1d6; }
  .label { font: 13px ui-monospace, Menlo, monospace; text-anchor: middle; fill: #222; }
  .label.anchor { fill: #fff; }
  .caption { font: 11px ui-sans-serif, system-ui, sans-serif; fill: #555; text-anchor: middle; }
  .caption.start { text-anchor: start; }
  .frame { fill: none; stroke: #908c83; stroke-width: 1.5; stroke-dasharray: 5 3; }
  .frame.assertion { stroke: #b4561f; }
  .frame.charset { stroke-dasharray: none; fill: #f7f6f0; }
`;

export function renderSvg(root: Seq): string {
  const box = layoutRoot(root);
  const startX = MARGIN + END_RADIUS;
  const boxX = startX + END_RADIUS + END_RAIL;
  const endX = boxX + box.w + END_RAIL + END_RADIUS;
  const width = endX + END_RADIUS + MARGIN;
  const height = box.h + 2 * MARGIN;
  const y = MARGIN + box.mid;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<style>${STYLE}</style>` +
    `<circle class="terminal" cx="${startX}" cy="${y}" r="${END_RADIUS}"/>` +
    `<path class="rail" d="M${startX} ${y}H${boxX}"/>` +
    `<g transform="translate(${boxX} ${MARGIN})">${box.svg}</g>` +
    `<path class="rail" d="M${boxX + box.w} ${y}H${endX}"/>` +
    `<circle class="terminal" cx="${endX}" cy="${y}" r="${END_RADIUS}"/>` +
    `</svg>`
  );
}
