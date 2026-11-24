import { describe, expect, it } from 'vitest';
import { decodeHash, encodeHash } from './url.ts';

describe('url hash', () => {
  it('round-trips a pattern that looks like a literal', () => {
    const input = { source: '/a/', flags: '' };
    expect(decodeHash(encodeHash(input))).toEqual(input);
  });

  it('round-trips flags and special characters', () => {
    const input = { source: '(?<n>a b)#\\k<n>%', flags: 'ix' };
    expect(decodeHash(encodeHash(input))).toEqual(input);
  });

  it('reads a /…/flags literal typed by hand', () => {
    expect(decodeHash('#/ab+/i')).toEqual({ source: 'ab+', flags: 'i' });
  });

  it('reads any other hash as the whole pattern with no flags', () => {
    expect(decodeHash('#a%2Bb')).toEqual({ source: 'a+b', flags: '' });
    expect(decodeHash('#/ab+/z')).toEqual({ source: '/ab+/z', flags: '' });
  });

  it('survives a malformed percent escape', () => {
    expect(decodeHash('#100%')).toEqual({ source: '100%', flags: '' });
  });
});
