export interface RegexInput {
  source: string;
  flags: string;
}

const LITERAL = /^\/(.*)\/([mixn]*)$/s;

/** Hash for a shareable link. Always a Ruby literal, so a pattern that itself looks like /a/ stays unambiguous. */
export function encodeHash({ source, flags }: RegexInput): string {
  return encodeURIComponent(`/${source}/${flags}`);
}

/** A /…/flags literal gives source and flags. Any other hash is the whole pattern source with no flags. */
export function decodeHash(hash: string): RegexInput {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let text: string;
  try {
    text = decodeURIComponent(raw);
  } catch {
    text = raw;
  }
  const literal = LITERAL.exec(text);
  return literal ? { source: literal[1]!, flags: literal[2]! } : { source: text, flags: '' };
}
