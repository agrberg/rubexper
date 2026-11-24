# Architecture

rubexper turns a Ruby regex into an SVG railroad diagram. It has no server and no runtime dependency. A Ruby spec checks the parser against the `regexp_parser` gem.

```
input (source + flags)
  → parser/parser.ts   recursive descent, throws RegexSyntaxError
  → AST (parser/ast.ts)
  → render/layout.ts   AST → Box tree (width, height, rail position, SVG fragment)
  → render/svg.ts      wraps the Box in <svg>, adds start and end circles and CSS
  → main.ts            inserts the SVG in the page
```

## Parser

`parser/parser.ts` has no separate lexer. The `Parser` class reads the source string with a position index and builds the AST in one pass. `parse(source, flags)` is the only export.

- The `x` flag changes parsing. Whitespace and `#` comments are skipped. The inline switches `(?x)` and `(?x:…)` change the mode for part of the pattern.
- Validation that Ruby does at compile time happens in the parser: range order, reference targets (`validateRefs`), and fixed width in lookbehind (`checkLookbehind`).
- `parser/properties.ts` lists every `\p{…}` name that Ruby accepts. It is generated. Do not edit it by hand. See "Generated files" below.
- Every error is a `RegexSyntaxError` with a `position`. The page shows the message and the position.

## AST

`parser/ast.ts` defines `Node` as a union with a short tag `k`. Fields are short on purpose, because the Ruby spec compares this JSON with the normalized `regexp_parser` tree.

| `k`                                                                      | Meaning                                                                             |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `seq`, `alt`                                                             | sequence and alternation                                                            |
| `lit`, `esc`, `cls`, `anchor`, `posix`, `prop`, `ref`, `call`, `comment` | leaf nodes, source text in `s`                                                      |
| `q`                                                                      | quantifier with `min`, `max`, `mode` (`greedy`, `lazy`, `possessive`) and one child |
| `group`                                                                  | all group and assertion kinds, subtype in `t`                                       |
| `set`                                                                    | character class, with `neg` and subtype in `t`                                      |
| `cond`                                                                   | conditional                                                                         |

The shape must match `spec/support/normalize.rb`. If you change one, change the other.

## Renderer

`render/layout.ts` builds a `Box` for each node: width, height, `mid` (the y position of the rail that enters and leaves the box), and an SVG string in local coordinates. Parents place child boxes with `<g transform>`. This keeps the code free of DOM calls, so tests and the Node CLI can run it.

- `Layout.seq` merges adjacent literals (`mergeLiterals`) and stacks boxes left to right.
- `alternation`, `quantified`, `group`, `conditional`, and `set` handle one node kind each.
- `render/labels.ts` holds all user-visible text, such as "word character" or "start of line".
- `render/svg.ts` holds the CSS and the outer `<svg>`. Colors and node classes (`literal`, `escape`, `class`, `anchor`, `charset`) live there.

Layout constants (`CHAR_W`, `ROW_H`, and others) are fixed numbers. Text width is an estimate (`CHAR_W` per character), so there is no font measurement.

## Page and URL

`main.ts` builds the page with `innerHTML`, re-renders on every `input` event, and writes the hash with `history.replaceState`. A `hashchange` event reads the hash back. `url.ts` converts between the hash and `{ source, flags }`. It always encodes a `/source/flags` literal, so a pattern that looks like `/a/` stays unambiguous.

`examples.ts` lists the example patterns under the diagram. Each one is a plain link to its own hash, so the `hashchange` listener loads it. `examples.test.ts` parses every example, so a broken example fails CI. The Ruby conformance corpus also holds each example.

SVG download uses a Blob. PNG download draws the SVG on a canvas at 2x scale.

## Conformance spec

`spec/conformance_spec.rb` is the proof that the TypeScript parser matches Ruby.

1. It reads `spec/corpus.txt` (valid patterns), `spec/corpus_x.txt` (valid patterns parsed with the `x` flag), and `spec/invalid.txt` (patterns that `Regexp.new` rejects).
2. It sends all patterns in one JSON batch to `bin/rubexper-ast.ts` on stdin. The CLI prints one `{ ok, ast | error }` result per entry.
3. For valid patterns, it compares the CLI AST with `Normalize.parse`, which converts the `regexp_parser` tree to the same shape.
4. For invalid patterns, it checks that Ruby raises `RegexpError` and the CLI returns `ok: false`.

Node runs the `.ts` CLI directly, so Node 24 must be on the path when you run `rspec`.

## Generated files

`bin/gen-properties.rb` writes `src/parser/properties.ts`. It tests every candidate name with `Regexp.new("\\p{name}")` on the local Ruby, so the output depends on the Ruby version. The file header records the version. Run the script again after a Ruby upgrade.

## Build and deploy

Vite builds to `dist/` with the base path `/rubexper/`. `deploy.yml` runs the tests, builds, and publishes `dist/` to GitHub Pages on each push to `main`. Changes that touch only `*.md`, `.gitignore`, or `.github/**` skip the deploy.
