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
const CURVE = 10;
const ARROW = 5;
const FORK = 2 * CURVE;

const textWidth = (text: string): number => Array.from(text).length * CHAR_W;
const escapeXml = (text: string): string => text.replace(/[&<>"']/g, (c) => `&#${c.codePointAt(0)};`);
const at = (box: Box, x: number, y: number): string => `<g transform="translate(${x} ${y})">${box.svg}</g>`;
const rail = (x1: number, x2: number, y: number): string =>
  x1 === x2 ? '' : `<path class="rail" d="M${x1} ${y}H${x2}"/>`;
const fork = (x1: number, y1: number, x2: number, y2: number): string => {
  const dy = y2 - y1;
  if (dy === 0) return rail(x1, x2, y1);
  const sign = Math.sign(dy);
  const r = Math.min(CURVE, Math.abs(dy) / 2, (x2 - x1) / 2);
  return `<path class="rail" d="M${x1} ${y1}q${r} 0 ${r} ${sign * r}v${dy - 2 * sign * r}q0 ${sign * r} ${r} ${sign * r}H${x2}"/>`;
};
const arrowAt = (x: number, y: number, pointing: 'up' | 'down'): string => {
  const dy = pointing === 'down' ? -ARROW : ARROW;
  return `<path class="rail arrow" d="M${x} ${y}l${ARROW} ${dy}m${-ARROW} ${-dy}l${-ARROW} ${dy}"/>`;
};
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
      svg += fork(0, mid, FORK, ys[i]!) + at(b, FORK, ys[i]! - b.mid) + rail(FORK + b.w, FORK + inner, ys[i]!);
      svg += fork(FORK + inner, ys[i]!, w, mid);
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
    const padX = skips ? 2 * CURVE : loops ? CURVE : 0;
    const top = skips ? CURVE : 0;
    const w = Math.max(inner.w + 2 * padX, textWidth(label) + 8);
    const innerX = (w - inner.w) / 2;
    const mid = top + inner.mid;
    const innerBottom = top + inner.h;
    const right = innerX + inner.w;
    let svg = rail(0, innerX, mid) + at(inner, innerX, top) + rail(right, w, mid);
    if (skips) {
      const vert = Math.max(0, inner.mid - CURVE);
      const x0 = innerX - 2 * CURVE;
      const d = `M${x0} ${mid}q${CURVE} 0 ${CURVE} ${-CURVE}v${-vert}q0 ${-CURVE} ${CURVE} ${-CURVE}H${right}q${CURVE} 0 ${CURVE} ${CURVE}v${vert}q0 ${CURVE} ${CURVE} ${CURVE}`;
      svg += `<path class="rail" d="${d}"/>`;
      if (node.mode === 'lazy') svg += arrowAt(x0 + CURVE, mid - CURVE - ARROW, 'up');
    }
    let bottom = 0;
    if (loops) {
      const vert = Math.max(0, inner.h - inner.mid - CURVE);
      const d = `M${innerX} ${mid}q${-CURVE} 0 ${-CURVE} ${CURVE}v${vert}q0 ${CURVE} ${CURVE} ${CURVE}h${inner.w}q${CURVE} 0 ${CURVE} ${-CURVE}v${-vert}q0 ${-CURVE} ${-CURVE} ${-CURVE}`;
      svg += `<path class="rail loop" d="${d}"/>`;
      if (node.mode !== 'lazy') svg += arrowAt(right + CURVE, mid + CURVE + ARROW, 'down');
      bottom = CURVE;
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
