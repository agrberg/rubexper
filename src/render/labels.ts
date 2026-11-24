import type { Node } from '../parser/ast.ts';

const CLASS_LABELS: Readonly<Record<string, string>> = {
  '.': 'any character',
  '\\d': 'digit',
  '\\D': 'non-digit',
  '\\w': 'word character',
  '\\W': 'non-word character',
  '\\s': 'whitespace',
  '\\S': 'non-whitespace',
  '\\h': 'hex digit',
  '\\H': 'non-hex digit',
  '\\R': 'linebreak',
  '\\X': 'grapheme cluster',
};

const ANCHOR_LABELS: Readonly<Record<string, string>> = {
  '^': 'start of line',
  $: 'end of line',
  '\\A': 'start of string',
  '\\z': 'end of string',
  '\\Z': 'end of string (before a final newline)',
  '\\b': 'word boundary',
  '\\B': 'non-word boundary',
  '\\G': 'where the last match ended',
  '\\K': 'keep: reset match start',
};

const ESCAPE_NAMES: Readonly<Record<string, string>> = {
  n: 'newline',
  t: 'tab',
  r: 'carriage return',
  f: 'form feed',
  v: 'vertical tab',
  a: 'bell',
  e: 'escape',
};

/** The text inside a leaf box. Literal runs and escapes quote the character; classes and anchors name it. */
export function leafLabel(node: Node): string {
  switch (node.k) {
    case 'lit':
      return `“${node.s}”`;
    case 'esc':
      return escapeLabel(node.s);
    case 'cls':
      return CLASS_LABELS[node.s] ?? node.s;
    case 'anchor':
      return ANCHOR_LABELS[node.s] ?? node.s;
    case 'posix': {
      const negated = node.s.startsWith('[:^');
      return `${negated ? 'not ' : ''}${node.s.slice(negated ? 3 : 2, -2)}`;
    }
    case 'prop':
      return propertyLabel(node.s);
    case 'ref':
      return referenceLabel(node.s, 'group');
    case 'call':
      return referenceLabel(node.s, 'call');
    default:
      return '';
  }
}

function escapeLabel(source: string): string {
  const body = source.slice(1);
  const named = ESCAPE_NAMES[body];
  if (named) return named;
  if (/^x/.test(body)) return `hex ${body.slice(1)}`;
  if (/^u\{/.test(body)) return `U+ ${body.slice(2, -1).trim().split(/\s+/).join(', ')}`;
  if (/^u/.test(body)) return `U+${body.slice(1).toUpperCase()}`;
  if (/^[0-7]+$/.test(body)) return `octal ${body}`;
  if (/^[cCM]/.test(body) && body.length > 1) return `control ${body}`;
  return `“${body}”`;
}

function propertyLabel(source: string): string {
  const [, letter, negation, name] = /^\\([pP])\{(\^?)(.*)\}$/.exec(source) ?? [];
  const negated = (letter === 'P') !== (negation === '^');
  return `${negated ? 'not ' : ''}property ${name}`;
}

function referenceLabel(source: string, verb: 'group' | 'call'): string {
  const target = /^\\[kg][<'](.*)[>']$/.exec(source)?.[1] ?? source.slice(1);
  if (verb === 'call') return target === '0' ? 'call whole pattern' : `call group ${target}`;
  return `same as group ${target}`;
}

export function quantifierLabel(min: number, max: number | null): string {
  if (min === 0 && max === 1) return '';
  if (max === null) return min === 0 ? '0 or more times' : `${min} or more times`;
  if (min === max) return min === 1 ? '' : `${min} times`;
  return `${min} to ${max} times`;
}

export function groupLabel(type: string, opener: string, captureNumber: number | null): string {
  const name = /^\(\?(?:<([^>]*)>|'([^']*)')/.exec(opener);
  switch (type) {
    case 'capture':
      return captureNumber === null ? '' : `group #${captureNumber}`;
    case 'named':
      return `group “${name?.[1] ?? name?.[2]}” #${captureNumber}`;
    case 'atomic':
      return 'atomic group';
    case 'lookahead':
      return 'positive lookahead';
    case 'nlookahead':
      return 'negative lookahead';
    case 'lookbehind':
      return 'positive lookbehind';
    case 'nlookbehind':
      return 'negative lookbehind';
    case 'absence':
      return 'absence: anything but';
    case 'options':
      return optionsLabel(opener);
    case 'options_switch':
      return `${optionsLabel(opener)} until end of group`;
    default:
      return '';
  }
}

function optionsLabel(opener: string): string {
  const [, on = '', off = ''] = /^\(\?([a-z]*)(?:-([a-z]*))?/.exec(opener) ?? [];
  const parts = [on && `on: ${on}`, off && `off: ${off}`].filter(Boolean);
  return `options ${parts.join(', ')}`.trim();
}
