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
    expect(renderSvg(parse('a'))).not.toContain('q10 0 10 -10');
    expect(renderSvg(parse('a?'))).toContain('q10 0 10 -10');
  });

  describe('paths and arrows', () => {
    const DOWN_ARROW = 'l5 -5m-5 5l-5 -5';
    const UP_ARROW = 'l5 5m-5 -5l-5 5';
    const arrows = (source: string) => renderSvg(parse(source)).match(/class="rail arrow"/g)?.length ?? 0;

    it('leaves the line flat before it bends, so the loop has no sharp corner', () => {
      const svg = renderSvg(parse('a+'));
      expect(svg).toMatch(/class="rail loop" d="M[\d.]+ [\d.]+q-10 0 -10 10v/);
      expect(svg).not.toMatch(/ [VQ]\d/);
    });

    it('points a greedy or possessive loop down and draws no other arrow', () => {
      for (const source of ['a+', 'a*', 'a++']) {
        const svg = renderSvg(parse(source));
        expect(svg, source).toContain(DOWN_ARROW);
        expect(svg, source).not.toContain(UP_ARROW);
        expect(arrows(source), source).toBe(1);
      }
    });

    it('points a lazy bypass up and draws no loop arrow', () => {
      const svg = renderSvg(parse('a*?'));
      expect(svg).toContain(UP_ARROW);
      expect(svg).not.toContain(DOWN_ARROW);
      expect(arrows('a*?')).toBe(1);
    });

    it('draws no arrow when nothing marks a preference', () => {
      for (const source of ['a', 'a?', 'a{1}', 'a+?']) expect(arrows(source), source).toBe(0);
    });

    it('puts the bypass arrow only on a lazy bypass', () => {
      expect(arrows('a?')).toBe(0);
      expect(arrows('a??')).toBe(1);
    });

    it('forks alternatives with corner curves and no cubic curve', () => {
      const svg = renderSvg(parse('a|b'));
      expect(svg).toContain('q10 0 10 ');
      expect(svg).not.toMatch(/d="[^"]*C/);
    });

    it('uses one stroke width and round joins for all lines', () => {
      const svg = renderSvg(parse('a+'));
      expect(svg).toContain('stroke-linejoin: round');
      expect(svg).not.toContain('.loop {');
      expect(svg).not.toContain('<marker');
    });
  });
});
