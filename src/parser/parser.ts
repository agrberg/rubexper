import { RegexSyntaxError, type Node, type QuantifierMode, type Seq } from './ast.ts';
import { PROPERTY_NAMES } from './properties.ts';

const POSIX_NAMES = new Set([
  'alnum',
  'alpha',
  'ascii',
  'blank',
  'cntrl',
  'digit',
  'graph',
  'lower',
  'print',
  'punct',
  'space',
  'upper',
  'word',
  'xdigit',
]);
const MAX_REPEAT = 100_000;
const MAX_CODE_POINT = 0x10ffff;
const SIMPLE_ESCAPES: Readonly<Record<string, number>> = { n: 10, t: 9, r: 13, f: 12, v: 11, a: 7, e: 27 };
const CLASS_ESCAPES = 'dDwWsShHRX';
const ANCHOR_ESCAPES = 'BAzZGK';
const GROUP_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['(?:', 'passive'],
  ['(?>', 'atomic'],
  ['(?=', 'lookahead'],
  ['(?!', 'nlookahead'],
  ['(?<=', 'lookbehind'],
  ['(?<!', 'nlookbehind'],
  ['(?~', 'absence'],
];

type RefKind = 'backref' | 'call' | 'condition';
interface PendingRef {
  kind: RefKind;
  number?: number;
  relative?: 'back' | 'forward';
  name?: string;
  groupsBefore: number;
  position: number;
}

class Parser {
  private pos = 0;
  private extended: boolean;
  private groupCount = 0;
  private readonly names = new Set<string>();
  private readonly refs: PendingRef[] = [];

  private readonly src: string;

  constructor(src: string, flags: string) {
    this.src = src;
    this.extended = flags.includes('x');
  }

  parse(): Seq {
    const branches = this.parseBranches();
    if (this.pos < this.src.length) this.fail('unmatched close parenthesis');
    this.validateRefs();
    return { k: 'seq', c: fold(branches) };
  }

  private fail(message: string, position = this.pos): never {
    throw new RegexSyntaxError(message, position);
  }

  private peek(): string | undefined {
    return this.pos < this.src.length ? String.fromCodePoint(this.src.codePointAt(this.pos)!) : undefined;
  }

  private matchHere(pattern: RegExp): RegExpExecArray | null {
    pattern.lastIndex = this.pos;
    return pattern.exec(this.src);
  }

  private parseBranches(): Node[][] {
    const branches = [this.parseSeq()];
    while (this.peek() === '|') {
      this.pos++;
      branches.push(this.parseSeq());
    }
    return branches;
  }

  private parseSeq(): Node[] {
    const items: Node[] = [];
    for (;;) {
      this.skipExtended(items);
      const c = this.peek();
      if (c === undefined || c === '|' || c === ')') return items;
      items.push(this.parseQuantified());
    }
  }

  private skipExtended(items: Node[]): void {
    while (this.extended) {
      const c = this.peek();
      if (c !== undefined && /\s/.test(c)) {
        this.pos++;
      } else if (c === '#') {
        const end = this.src.indexOf('\n', this.pos);
        const stop = end === -1 ? this.src.length : end;
        items.push({ k: 'comment', s: this.src.slice(this.pos, stop) });
        this.pos = stop;
      } else {
        return;
      }
    }
  }

  private skipExtendedWhitespace(): void {
    while (this.extended) {
      const c = this.peek();
      if (c === undefined || !/\s/.test(c)) return;
      this.pos++;
    }
  }

  private parseQuantified(): Node {
    let node = this.parseAtom();
    for (;;) {
      this.skipExtendedWhitespace();
      const quantifier = this.tryQuantifier();
      if (!quantifier) return node;
      node = { k: 'q', ...quantifier, c: [node] };
    }
  }

  private tryQuantifier(): { min: number; max: number | null; mode: QuantifierMode } | null {
    const c = this.peek();
    if (c === '*' || c === '+' || c === '?') {
      this.pos++;
      const suffix = this.peek();
      let mode: QuantifierMode = 'greedy';
      if (suffix === '?') mode = 'lazy';
      if (suffix === '+') mode = 'possessive';
      if (mode !== 'greedy') this.pos++;
      return { min: c === '+' ? 1 : 0, max: c === '?' ? 1 : null, mode };
    }
    if (c !== '{') return null;
    const interval = this.matchHere(/\{(\d*)(?:(,)(\d*))?\}/y);
    if (!interval) return null;
    const [text, low = '', comma, high = ''] = interval;
    if (low === '' && high === '') return null;
    const min = low === '' ? 0 : Number(low);
    const max = comma ? (high === '' ? null : Number(high)) : min;
    if (min > MAX_REPEAT || (max !== null && max > MAX_REPEAT)) this.fail('too big number for repeat range');
    if (max !== null && min > max) this.fail('too big number for repeat range');
    this.pos += text.length;
    const lazy = this.peek() === '?';
    if (lazy) this.pos++;
    return { min, max, mode: lazy ? 'lazy' : 'greedy' };
  }

  private parseAtom(): Node {
    const c = this.peek()!;
    switch (c) {
      case '(':
        return this.parseGroup();
      case '[':
        return this.parseSet();
      case '\\':
        return this.parseEscape(false);
      case '.':
        this.pos++;
        return { k: 'cls', s: '.' };
      case '^':
      case '$':
        this.pos++;
        return { k: 'anchor', s: c };
      case '*':
      case '+':
      case '?':
        return this.fail('target of repeat operator is not specified');
      default:
        this.pos += c.length;
        return { k: 'lit', s: c };
    }
  }

  private parseGroup(): Node {
    const start = this.pos;
    if (this.src[start + 1] !== '?') {
      this.groupCount++;
      this.pos++;
      return this.finishGroup('capture', '(', start);
    }
    if (this.src.startsWith('(?#', start)) return this.parseComment(start);
    if (this.src.startsWith('(?(', start)) return this.parseConditional(start);
    for (const [prefix, type] of GROUP_PREFIXES) {
      if (!this.src.startsWith(prefix, start)) continue;
      this.pos += prefix.length;
      return this.finishGroup(type, prefix, start);
    }
    const named = this.matchHere(/\(\?(?:<([^>]*)>|'([^']*)')/y);
    if (named) return this.parseNamedGroup(named, start);
    return this.parseOptionsGroup(start);
  }

  private parseComment(start: number): Node {
    for (let i = start + 3; i < this.src.length; i++) {
      if (this.src[i] === '\\') i++;
      else if (this.src[i] === ')') {
        this.pos = i + 1;
        return { k: 'comment', s: this.src.slice(start, this.pos) };
      }
    }
    return this.fail('end pattern in group', start);
  }

  private parseNamedGroup(match: RegExpExecArray, start: number): Node {
    const name = match[1] ?? match[2] ?? '';
    if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(name)) this.fail(name === '' ? 'group name is empty' : 'invalid group name');
    this.names.add(name);
    this.groupCount++;
    this.pos += match[0].length;
    return this.finishGroup('named', match[0], start);
  }

  private parseOptionsGroup(start: number): Node {
    const options = this.matchHere(/\(\?([imxadu]*)(?:-([imx]*))?([:)])/y);
    if (!options) return this.fail('undefined group option');
    const [text, on = '', off = '', terminator] = options;
    this.pos += text.length;
    const nextExtended = on.includes('x') ? true : off.includes('x') ? false : this.extended;
    if (terminator === ')') {
      this.extended = nextExtended;
      return { k: 'group', t: 'options_switch', s: text, c: [] };
    }
    const outer = this.extended;
    this.extended = nextExtended;
    const node = this.finishGroup('options', text, start);
    this.extended = outer;
    return node;
  }

  private finishGroup(type: string, opener: string, start: number): Node {
    const outerExtended = this.extended;
    const branches = this.parseBranches();
    this.closeGroup(start);
    this.extended = outerExtended;
    const children = fold(branches);
    if (type === 'lookbehind' || type === 'nlookbehind') this.checkLookbehind(children, start);
    return { k: 'group', t: type, s: opener, c: children };
  }

  private closeGroup(start: number): void {
    if (this.peek() !== ')') this.fail('end pattern with unmatched parenthesis', start);
    this.pos++;
  }

  private parseConditional(start: number): Node {
    const condition = this.matchHere(/\(\?(\((?:(\d+)|<([^>)]+)>|'([^')]+)')\))/y);
    if (!condition) return this.fail('invalid conditional pattern', start);
    const [text, label, digits, angled, quoted] = condition;
    this.pos += text.length;
    const name = angled ?? quoted;
    this.refs.push({
      kind: 'condition',
      ...(digits === undefined ? { name } : { number: Number(digits) }),
      groupsBefore: this.groupCount,
      position: start,
    });
    const outerExtended = this.extended;
    const branches = this.parseBranches();
    if (branches.length > 2) this.fail('invalid conditional pattern', start);
    this.closeGroup(start);
    this.extended = outerExtended;
    const conditionNode: Node = { k: 'cond', t: 'condition', s: label!, c: [] };
    return { k: 'cond', t: 'open', c: [conditionNode, ...branches.map((c): Node => ({ k: 'seq', c }))] };
  }

  private parseSet(): Node {
    const start = this.pos;
    this.pos++;
    const neg = this.peek() === '^';
    if (neg) this.pos++;
    const parts: Node[][] = [];
    let items: Node[] = [];
    let first = true;
    for (;;) {
      const c = this.peek();
      if (c === undefined) this.fail('premature end of char-class', start);
      if (c === ']' && !(first && this.src.indexOf(']', this.pos + 1) !== -1)) {
        if (first) this.fail('empty char-class', start);
        break;
      }
      first = false;
      if (this.src.startsWith('&&', this.pos)) {
        this.pos += 2;
        parts.push(items);
        items = [];
      } else if (c === '[') {
        items.push(this.parseNestedSet());
      } else {
        items.push(this.parseSetItem());
      }
    }
    this.pos++;
    if (parts.length === 0) return { k: 'set', t: 'character', neg, c: items };
    parts.push(items);
    const intersection: Node = {
      k: 'set',
      t: 'intersection',
      neg: false,
      c: parts.map((c): Node => ({ k: 'seq', c })),
    };
    return { k: 'set', t: 'character', neg, c: [intersection] };
  }

  private parseNestedSet(): Node {
    const posix = this.matchHere(/\[:(\^?)(\w+):\]/y);
    if (!posix) return this.parseSet();
    if (!POSIX_NAMES.has(posix[2]!)) this.fail('invalid POSIX bracket type');
    this.pos += posix[0].length;
    return { k: 'posix', s: posix[0] };
  }

  private parseSetItem(): Node {
    const start = this.parseSetChar();
    const isRangeStart = start.k === 'lit' || start.k === 'esc';
    if (!isRangeStart || this.peek() !== '-') return start;
    const after = this.src[this.pos + 1];
    if (after === ']' || after === '[' || this.src.startsWith('&&', this.pos + 1)) return start;
    this.pos++;
    const end = this.parseSetChar();
    if (end.k !== 'lit' && end.k !== 'esc') this.fail('char-class value at end of range');
    const low = codePointOf(start);
    const high = codePointOf(end);
    if (low !== undefined && high !== undefined && low > high) this.fail('empty range in char class');
    return { k: 'set', t: 'range', neg: false, c: [start, end] };
  }

  private parseSetChar(): Node {
    const c = this.peek()!;
    if (c === '\\') return this.parseEscape(true);
    this.pos += c.length;
    return { k: 'lit', s: c };
  }

  private parseEscape(inSet: boolean): Node {
    const start = this.pos;
    this.pos++;
    const c = this.peek();
    if (c === undefined) this.fail('too short escape sequence', start);
    this.pos += c.length;
    const raw = (): string => this.src.slice(start, this.pos);

    if (CLASS_ESCAPES.includes(c)) return { k: 'cls', s: raw() };
    if (c === 'b') return { k: inSet ? 'esc' : 'anchor', s: raw() };
    if (ANCHOR_ESCAPES.includes(c)) return { k: inSet ? 'esc' : 'anchor', s: raw() };
    if (c === 'p' || c === 'P') return this.parseProperty(start);
    if (c === 'x') return this.parseHexEscape(start);
    if (c === 'u') return this.parseUnicodeEscape(start);
    if (c === 'c') return this.parseControlEscape(start, 0);
    if (c === 'C' || c === 'M') return this.parseControlEscape(start, 1);
    if (c >= '0' && c <= '9') return this.parseDigitEscape(start, c, inSet);
    if (!inSet && c === 'k') return this.parseReference(start, 'backref');
    if (!inSet && c === 'g') return this.parseReference(start, 'call');
    return { k: 'esc', s: raw() };
  }

  private parseProperty(start: number): Node {
    const property = this.matchHere(/\{\^?([^}]*)\}/y);
    if (!property) return this.fail('invalid character property name {}', start);
    const name = property[1]!.toLowerCase().replace(/[_ -]/g, '');
    if (!PROPERTY_NAMES.has(name)) this.fail(`invalid character property name {${property[1]}}`, start);
    this.pos += property[0].length;
    return { k: 'prop', s: this.src.slice(start, this.pos) };
  }

  private parseHexEscape(start: number): Node {
    const hex = this.matchHere(/[0-9a-fA-F]{1,2}/y);
    if (!hex) return this.fail('invalid hex escape', start);
    this.pos += hex[0].length;
    return { k: 'esc', s: this.src.slice(start, this.pos) };
  }

  private parseUnicodeEscape(start: number): Node {
    const braced = this.matchHere(/\{\s*([0-9a-fA-F]+(?:\s+[0-9a-fA-F]+)*)\s*\}/y);
    const fixed = braced ?? this.matchHere(/[0-9a-fA-F]{4}/y);
    if (!fixed) return this.fail('invalid Unicode escape', start);
    const points = (braced ? braced[1]! : fixed[0]).split(/\s+/);
    if (points.some((point) => parseInt(point, 16) > MAX_CODE_POINT)) this.fail('invalid Unicode range', start);
    this.pos += fixed[0].length;
    return { k: 'esc', s: this.src.slice(start, this.pos) };
  }

  private parseControlEscape(start: number, dashes: 0 | 1): Node {
    if (dashes === 1) {
      if (this.peek() !== '-') this.fail('invalid control-code syntax', start);
      this.pos++;
    }
    const target = this.peek();
    if (target === undefined) this.fail('too short control sequence', start);
    this.pos += target.length;
    return { k: 'esc', s: this.src.slice(start, this.pos) };
  }

  private parseDigitEscape(start: number, first: string, inSet: boolean): Node {
    const octal = (): Node => {
      this.pos = start + 1;
      const digits = this.matchHere(/[0-7]{1,3}/y);
      this.pos += digits ? digits[0].length : 1;
      return { k: 'esc', s: this.src.slice(start, this.pos) };
    };
    if (inSet || first === '0') return first <= '7' ? octal() : { k: 'esc', s: this.src.slice(start, this.pos) };
    const digits = this.matchHere(/\d+/y);
    const text = first + (digits ? digits[0] : '');
    const number = Number(text);
    if (number > 9 && number > this.groupCount && first <= '7') return octal();
    this.pos = start + 1 + text.length;
    this.refs.push({ kind: 'backref', number, groupsBefore: this.groupCount, position: start });
    return { k: 'ref', s: this.src.slice(start, this.pos) };
  }

  private parseReference(start: number, kind: 'backref' | 'call'): Node {
    const reference = this.matchHere(/<([^>]*)>|'([^']*)'/y);
    if (!reference) return this.fail('invalid group name <>', start);
    const inner = reference[1] ?? reference[2] ?? '';
    this.pos += reference[0].length;
    if (inner === '') this.fail('group name is empty', start);
    const numeric = (kind === 'call' ? /^([-+]?\d+)$/ : /^([-+]?\d+)(?:[-+]\d+)?$/).exec(inner);
    const named = /^([\p{L}_][\p{L}\p{N}_]*)(?:[-+]\d+)?$/u.exec(inner);
    const ref: PendingRef = { kind, groupsBefore: this.groupCount, position: start };
    if (numeric) {
      const text = numeric[1]!;
      ref.number = Math.abs(Number(text));
      if (text.startsWith('-')) ref.relative = 'back';
      else if (text.startsWith('+')) ref.relative = 'forward';
    } else if (named) {
      ref.name = named[1]!;
    } else {
      this.fail('invalid group name <' + inner + '>', start);
    }
    this.refs.push(ref);
    return { k: kind === 'backref' ? 'ref' : 'call', s: this.src.slice(start, this.pos) };
  }

  private validateRefs(): void {
    const hasNamedGroups = this.names.size > 0;
    for (const ref of this.refs) {
      if (ref.name !== undefined) {
        if (!this.names.has(ref.name)) this.fail(`undefined name <${ref.name}> reference`, ref.position);
        continue;
      }
      let number = ref.number!;
      if (ref.relative === 'back') number = ref.groupsBefore - number + 1;
      if (ref.relative === 'forward') number = ref.groupsBefore + number;
      if (hasNamedGroups && number > 0) this.fail('numbered backref/call is not allowed. (use name)', ref.position);
      const lowest = ref.kind === 'call' ? 0 : 1;
      if (number < lowest || number > this.groupCount) this.fail('invalid backref number/name', ref.position);
    }
  }

  private checkLookbehind(children: Node[], position: number): void {
    const only = children[0];
    const branches = children.length === 1 && only!.k === 'alt' ? only!.c.map((b) => b.c) : [children];
    for (const branch of branches) {
      if (fixedWidth(branch) === null) this.fail('invalid pattern in look-behind', position);
    }
  }
}

function fold(branches: Node[][]): Node[] {
  if (branches.length === 1) return branches[0]!;
  return [{ k: 'alt', c: branches.map((c): Seq => ({ k: 'seq', c })) }];
}

function codePointOf(node: Node): number | undefined {
  if (node.k === 'lit') return node.s.codePointAt(0);
  if (node.k !== 'esc') return undefined;
  const body = node.s.slice(1);
  const simple = SIMPLE_ESCAPES[body];
  if (simple !== undefined) return simple;
  if (/^x[0-9a-fA-F]+$/.test(body)) return parseInt(body.slice(1), 16);
  if (/^u[0-9a-fA-F]{4}$/.test(body)) return parseInt(body.slice(1), 16);
  if (/^u\{\s*[0-9a-fA-F]+\s*\}$/.test(body)) return parseInt(body.slice(2, -1).trim(), 16);
  if (/^[0-7]{1,3}$/.test(body)) return parseInt(body, 8);
  if (/^[^a-zA-Z0-9]$/u.test(body)) return body.codePointAt(0);
  return undefined;
}

// null when Onigmo would reject the width inside a look-behind.
function fixedWidth(items: Node[]): number | null {
  let total = 0;
  for (const item of items) {
    const width = nodeWidth(item);
    if (width === null) return null;
    total += width;
  }
  return total;
}

function nodeWidth(node: Node): number | null {
  switch (node.k) {
    case 'lit':
    case 'esc':
    case 'prop':
    case 'posix':
    case 'set':
      return 1;
    case 'cls':
      return node.s === '\\R' || node.s === '\\X' ? null : 1;
    case 'anchor':
    case 'comment':
      return 0;
    case 'q': {
      if (node.max !== node.min) return null;
      const inner = nodeWidth(node.c[0]);
      return inner === null ? null : inner * node.min;
    }
    case 'group': {
      if (node.t === 'absence') return null;
      if (/lookahead|lookbehind|options_switch/.test(node.t)) return 0;
      const first = node.c[0];
      if (node.c.length === 1 && first!.k === 'alt') {
        const widths = first!.c.map((branch) => fixedWidth(branch.c));
        return widths.every((w) => w !== null && w === widths[0]) ? widths[0]! : null;
      }
      return fixedWidth(node.c);
    }
    default:
      return null;
  }
}

export function parse(source: string, flags = ''): Seq {
  return new Parser(source, flags).parse();
}
