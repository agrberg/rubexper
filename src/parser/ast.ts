export type QuantifierMode = 'greedy' | 'lazy' | 'possessive';

export interface Seq {
  k: 'seq';
  c: Node[];
}

export interface Alt {
  k: 'alt';
  c: Seq[];
}

// Must match the shape built by spec/support/normalize.rb.
export type Node =
  | Seq
  | Alt
  | { k: 'lit' | 'esc' | 'cls' | 'anchor' | 'posix' | 'prop' | 'ref' | 'call' | 'comment'; s: string }
  | { k: 'q'; min: number; max: number | null; mode: QuantifierMode; c: [Node] }
  | { k: 'group'; t: string; s: string; c: Node[] }
  | { k: 'set'; t: 'character' | 'intersection' | 'range'; neg: boolean; c: Node[] }
  | { k: 'cond'; t: 'open'; c: Node[] }
  | { k: 'cond'; t: 'condition'; s: string; c: [] };

export class RegexSyntaxError extends Error {
  readonly position: number;

  constructor(message: string, position: number) {
    super(message);
    this.name = 'RegexSyntaxError';
    this.position = position;
  }
}
