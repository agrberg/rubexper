import { describe, expect, it } from 'vitest';
import { parse } from '../parser/parser.ts';
import { renderSvg } from './svg.ts';

const PATTERNS = [
  'abc',
  'a|b|c',
  '(a|b)c',
  'a*',
  'a+?',
  'a?',
  'a{2,4}',
  '(?>a++)',
  '(?<year>\\d{4})-(?<month>\\d{2})',
  '(?<=\\$)\\d+(?:\\.\\d\\d)?',
  '[^a-c&&[^b]]',
  '[[:alpha:]\\p{Han}]',
  '(a)(?(1)b|c)',
  '(?~ab)\\K\\G',
  '\\A[\\w+\\-.]+@[a-z\\d\\-]+(\\.[a-z\\d\\-]+)*\\.[a-z]+\\z',
];

describe('renderSvg', () => {
  it.each(PATTERNS)('draws %s', (source) => {
    expect(renderSvg(parse(source))).toMatchSnapshot();
  });

  it('escapes markup in labels', () => {
    const svg = renderSvg(parse('<b>&"\''));
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&#60;b&#62;');
  });

  it('draws different output for different patterns', () => {
    expect(renderSvg(parse('a'))).not.toBe(renderSvg(parse('b')));
  });

  it('draws a loop only for repeats above one and a bypass only when zero is allowed', () => {
    expect(renderSvg(parse('a+'))).toContain('class="rail loop"');
    expect(renderSvg(parse('a?'))).not.toContain('class="rail loop"');
    expect(renderSvg(parse('a{1}'))).not.toContain('class="rail loop"');
    expect(renderSvg(parse('a'))).not.toContain('Q8 8');
  });
});
