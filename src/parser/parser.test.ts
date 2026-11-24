import { describe, expect, it } from 'vitest';
import { RegexSyntaxError } from './ast.ts';
import { parse } from './parser.ts';

const items = (source: string, flags = '') => parse(source, flags).c;

describe('parse', () => {
  it('treats a quantifier after an interval as a nested repeat, as Ruby does', () => {
    const [outer] = items('a{2,3}+');
    expect(outer).toMatchObject({ k: 'q', min: 1, max: null, mode: 'greedy' });
    expect((outer as { c: unknown[] }).c[0]).toMatchObject({ k: 'q', min: 2, max: 3 });
  });

  it('accepts a quantifier after an anchor or look-around, as Ruby does', () => {
    for (const source of ['^*', '(?=a)*', '\\b*']) expect(() => parse(source)).not.toThrow();
  });

  it('reads a leading ] in a class as a member, as Regexp.new does', () => {
    expect(items('[]a]')).toEqual([
      {
        k: 'set',
        t: 'character',
        neg: false,
        c: [
          { k: 'lit', s: ']' },
          { k: 'lit', s: 'a' },
        ],
      },
    ]);
  });

  it('ends the extended mode of an inline (?x:…) group at its closing paren', () => {
    expect(items('(?x: a ) b')).toHaveLength(3);
    expect(items('(?x: a ) b').map((n) => n.k)).toEqual(['group', 'lit', 'lit']);
  });

  it('does not skip whitespace without the x flag', () => {
    expect(items('a b').map((n) => n.k)).toEqual(['lit', 'lit', 'lit']);
  });

  it('reports the position of the unmatched group opener', () => {
    expect(() => parse('ab(c')).toThrow(expect.objectContaining({ name: 'RegexSyntaxError', position: 2 }));
  });

  it('rejects numbered references when named groups exist', () => {
    expect(() => parse('(?<n>a)(b)\\2')).toThrow(RegexSyntaxError);
  });

  it('allows alternatives of different widths at the top of a look-behind only', () => {
    expect(() => parse('(?<=a|bc)d')).not.toThrow();
    expect(() => parse('(?<=(?:a|bc))d')).toThrow(RegexSyntaxError);
  });
});
