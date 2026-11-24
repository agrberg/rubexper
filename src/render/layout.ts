import type { Node, Seq } from '../parser/ast.ts';
import { groupLabel, leafLabel, quantifierLabel } from './labels.ts';

/** A drawn fragment. `svg` is in local coordinates; `mid` is the y of the rail that enters and leaves it. */
export interface Box {
  w: number;
  h: number;
  mid: number;
  svg: string;
}

const CHAR_W = 7.2;
const ROW_H = 24;
const PAD = 10;
const GAP = 14;
const LABEL_H = 14;
const FORK = 20;
const LOOP_PAD = 16;

const textWidth = (text: string): number => Array.from(text).length * CHAR_W;
const escapeXml = (text: string): string => text.replace(/[&<>"']/g, (c) => `&#${c.codePointAt(0)};`);
const at = (box: Box, x: number, y: number): string => `<g transform="translate(${x} ${y})">${box.svg}</g>`;
const rail = (x1: number, x2: number, y: number): string =>
  x1 === x2 ? '' : `<path class="rail" d="M${x1} ${y}H${x2}"/>`;
const curve = (x1: number, y1: number, x2: number, y2: number): string =>
  y1 === y2
    ? `<path class="rail" d="M${x1} ${y1}H${x2}"/>`
    : `<path class="rail" d="M${x1} ${y1}C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}"/>`;
const text = (label: string, x: number, y: number, cls: string): string =>
  `<text class="${cls}" x="${x}" y="${y}">${escapeXml(label)}</text>`;

class Layout {
  private captures = 0;
  private readonly namedGroups: boolean;

  constructor(root: Seq) {
    this.namedGroups = containsNamedGroup(root);
  }

  seq(items: Node[]): Box {
    const boxes = mergeLiterals(items).map((item) => this.node(item));
    if (boxes.length === 0) return emptyBox();
    const mid = Math.max(...boxes.map((b) => b.mid));
    const below = Math.max(...boxes.map((b) => b.h - b.mid));
    let x = 0;
    let svg = '';
    boxes.forEach((box, i) => {
      if (i > 0) svg += rail(x, x + GAP, mid);
      if (i > 0) x += GAP;
      svg += at(box, x, mid - box.mid);
      x += box.w;
    });
    return { w: x, h: mid + below, mid, svg };
  }

  private node(node: Node): Box {
    switch (node.k) {
      case 'seq':
        return this.seq(node.c);
      case 'alt':
        return this.alternation(node.c.map((branch) => this.seq(branch.c)));
      case 'q':
        return this.quantified(node);
      case 'group':
        return this.group(node);
      case 'set':
        return this.set(node);
      case 'cond':
        return node.t === 'open' ? this.conditional(node) : emptyBox();
      case 'lit':
      case 'esc':
        return leaf(leafLabel(node), node.k === 'lit' ? 'literal' : 'escape');
      case 'comment':
        return emptyBox();
      default:
        return leaf(leafLabel(node), node.k === 'anchor' ? 'anchor' : 'class');
    }
  }

  private alternation(branches: Box[]): Box {
    const inner = Math.max(...branches.map((b) => b.w));
    const w = inner + 2 * FORK;
    let y = 0;
    const ys = branches.map((b) => {
      const top = y;
      y += b.h + 8;
      return top + b.mid;
    });
    const mid = ys[0]!;
    let svg = '';
    branches.forEach((b, i) => {
      svg += curve(0, mid, FORK, ys[i]!) + at(b, FORK, ys[i]! - b.mid) + rail(FORK + b.w, FORK + inner, ys[i]!);
      svg += curve(FORK + inner, ys[i]!, w, mid);
    });
    return { w, h: y - 8, mid, svg };
  }

  private quantified(node: Extract<Node, { k: 'q' }>): Box {
    const inner = this.node(node.c[0]);
    const loops = node.max === null || node.max > 1;
    const skips = node.min === 0;
    const label = [quantifierLabel(node.min, node.max), node.mode === 'greedy' ? '' : node.mode]
      .filter(Boolean)
      .join(', ');
    if (!loops && !skips && !label) return inner;
    const padX = loops || skips ? LOOP_PAD : 0;
    const top = skips ? 18 : 0;
    const bottom = loops ? 18 : 0;
    const w = Math.max(inner.w + 2 * padX, textWidth(label) + 8);
    const innerX = (w - inner.w) / 2;
    const mid = top + inner.mid;
    const innerBottom = top + inner.h;
    let svg = rail(0, innerX, mid) + at(inner, innerX, top) + rail(innerX + inner.w, w, mid);
    if (skips) svg += `<path class="rail" d="M8 ${mid}V14Q8 8 14 8H${w - 14}Q${w - 8} 8 ${w - 8} 14V${mid}"/>`;
    if (loops) {
      const y = innerBottom + 9;
      svg += `<path class="rail loop" marker-end="url(#arrow)" d="M${w - 8} ${mid}V${y - 6}Q${w - 8} ${y} ${w - 14} ${y}H14Q8 ${y} 8 ${y - 6}V${mid}"/>`;
    }
    const labelH = label ? LABEL_H : 0;
    if (label) svg += text(label, w / 2, innerBottom + bottom + 11, 'caption');
    return { w, h: innerBottom + bottom + labelH, mid, svg };
  }

  private group(node: Extract<Node, { k: 'group' }>): Box {
    if (node.t === 'options_switch') return leaf(groupLabel(node.t, node.s, null), 'anchor');
    let number: number | null = null;
    if (node.t === 'named' || (node.t === 'capture' && !this.namedGroups)) number = ++this.captures;
    const inner = this.seq(node.c);
    const label = groupLabel(node.t, node.s, number);
    return label
      ? framed(inner, label, node.t.includes('look') || node.t === 'atomic' ? 'frame assertion' : 'frame')
      : inner;
  }

  private conditional(node: Extract<Node, { k: 'cond'; t: 'open' }>): Box {
    const [condition, ...branches] = node.c;
    const subject = condition!.k === 'cond' && condition!.t === 'condition' ? condition!.s : '';
    const named = /^\((?:<(.*)>|'(.*)')\)$/.exec(subject);
    const label = `if group ${named ? `“${named[1] ?? named[2]}”` : subject.slice(1, -1)} matched`;
    const labels = ['then', 'else'];
    const parts = branches.map((branch, i) => framed(this.node(branch), labels[i]!, 'frame'));
    return framed(stack(parts), label, 'frame');
  }

  private set(node: Extract<Node, { k: 'set' }>): Box {
    if (node.t === 'range') {
      const [from, to] = node.c;
      return leaf(`${leafLabel(from!)} to ${leafLabel(to!)}`, 'charset');
    }
    const only = node.c[0];
    const isIntersection = node.c.length === 1 && only!.k === 'set' && only.t === 'intersection';
    if (isIntersection) {
      const parts = only.c.map((part) => this.set({ k: 'set', t: 'character', neg: false, c: (part as Seq).c }));
      return framed(stack(parts), `${node.neg ? 'Not in ' : 'In '}all of:`, 'frame charset');
    }
    const items = node.c.map((item) => this.node(item));
    return framed(stack(items.length ? items : [emptyBox()]), node.neg ? 'None of:' : 'One of:', 'frame charset');
  }
}

function containsNamedGroup(node: Node): boolean {
  if (node.k === 'group' && node.t === 'named') return true;
  return 'c' in node && node.c.some(containsNamedGroup);
}

function mergeLiterals(items: Node[]): Node[] {
  const merged: Node[] = [];
  for (const item of items) {
    const last = merged[merged.length - 1];
    if (item.k === 'lit' && last?.k === 'lit') merged[merged.length - 1] = { k: 'lit', s: last.s + item.s };
    else merged.push(item);
  }
  return merged;
}

function emptyBox(): Box {
  return { w: 20, h: ROW_H, mid: ROW_H / 2, svg: rail(0, 20, ROW_H / 2) };
}

function leaf(label: string, cls: string): Box {
  const w = textWidth(label) + 2 * PAD;
  const svg = `<rect class="node ${cls}" width="${w}" height="${ROW_H}" rx="5"/>${text(label, w / 2, ROW_H / 2 + 4, `label ${cls}`)}`;
  return { w, h: ROW_H, mid: ROW_H / 2, svg };
}

/** Items stacked vertically and centered, the way regexper draws a character set. */
function stack(items: Box[]): Box {
  const w = Math.max(...items.map((b) => b.w));
  let y = 0;
  let svg = '';
  for (const item of items) {
    svg += at(item, (w - item.w) / 2, y);
    y += item.h + 4;
  }
  return { w, h: y - 4, mid: (y - 4) / 2, svg };
}

function framed(inner: Box, label: string, cls: string): Box {
  const w = Math.max(inner.w + 2 * PAD, textWidth(label) + 12);
  const innerX = (w - inner.w) / 2;
  const innerY = LABEL_H + PAD;
  const h = innerY + inner.h + PAD;
  const mid = innerY + inner.mid;
  const svg =
    `<rect class="${cls}" y="${LABEL_H}" width="${w}" height="${h - LABEL_H}" rx="6"/>` +
    text(label, 6, 11, 'caption start') +
    rail(0, innerX, mid) +
    at(inner, innerX, innerY) +
    rail(innerX + inner.w, w, mid);
  return { w, h, mid, svg };
}

export function layoutRoot(root: Seq): Box {
  return new Layout(root).seq(root.c);
}
