import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples.ts';
import { parse } from './parser/parser.ts';
import { decodeHash, encodeHash } from './url.ts';

describe('EXAMPLES', () => {
  it('has examples', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(5);
  });

  it.each(EXAMPLES.map((example) => [example.title, example] as const))('%s parses', (_title, { source, flags }) => {
    expect(() => parse(source, flags)).not.toThrow();
  });

  it.each(EXAMPLES.map((example) => [example.title, example] as const))(
    '%s survives the URL hash',
    (_title, { source, flags }) => {
      expect(decodeHash(encodeHash({ source, flags }))).toEqual({ source, flags });
    },
  );

  it('uses a unique title and a caption for each example', () => {
    expect(new Set(EXAMPLES.map((example) => example.title)).size).toBe(EXAMPLES.length);
    for (const example of EXAMPLES) expect(example.note.trim()).not.toBe('');
  });
});
