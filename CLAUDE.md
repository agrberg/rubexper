# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static site that draws Ruby (Onigmo) regex as railroad diagrams. See [README.md](README.md) for use and [ARCHITECTURE.md](ARCHITECTURE.md) for the design. The original spec is `docs/superpowers/specs/2026-11-24-rubexper-design.md`. Where the spec and the code differ, the code is correct (the parser has no separate lexer, and the AST kinds are shorter).

## Commands

```bash
npm ci
npm run dev                          # dev server, base path /rubexper/
npm test                             # all vitest tests
npx vitest run src/url.test.ts       # one test file
npx vitest run -t "round-trips"      # tests by name
npm run lint                         # oxlint
npm run format                       # prettier --write
npm run format:check
npm run build                        # tsc -b, then vite build
bundle exec rspec                    # conformance spec (needs Ruby and node)
bundle exec rspec -e "a|b|c"         # one conformance example by name
```

Before you finish a change, run `format:check`, `lint`, `test`, and `build`. CI runs the same four commands, plus `bundle exec rspec`.

## Rules that need more than one file to see

- **The AST has two producers.** `src/parser/parser.ts` builds it, and `spec/support/normalize.rb` rebuilds it from the `regexp_parser` gem. The shapes must stay equal. If you add or change a node kind in `src/parser/ast.ts`, change `normalize.rb` and run `bundle exec rspec`.
- **Add a parser feature by adding corpus lines.** Put valid patterns in `spec/corpus.txt` (or `spec/corpus_x.txt` for the `x` flag). Put patterns that Ruby rejects in `spec/invalid.txt`. Every corpus line must be valid Ruby, and every invalid line must raise `RegexpError`. The spec checks both.
- **Never draw a wrong diagram.** If the parser does not support a construct, it must throw `RegexSyntaxError`. Do not guess.
- **Do not edit `src/parser/properties.ts`.** Run `ruby bin/gen-properties.rb`. The output depends on the local Ruby version.
- **`src/render/` must not use the DOM.** The renderer returns strings so that tests and the Node CLI can call it. DOM code belongs in `src/main.ts`.
- **SVG output is snapshot tested.** `src/render/__snapshots__/svg.test.ts.snap` changes when layout or CSS changes. Read the snapshot diff, then run `npx vitest run -u` only if the change is on purpose.
- **Keep the URL format stable.** Links live in code comments for years. `src/url.ts` always encodes `/source/flags`, and it still reads a bare pattern.

## Conventions

- TypeScript imports use the `.ts` extension (`import … from './ast.ts'`). Node runs `bin/rubexper-ast.ts` directly.
- Prettier: single quotes, 120 columns.
- Node version is in `.tool-versions`. CI reads it from there.
- Comments explain a reason, not an action. Recent history prunes comments to the ones that carry a reason.
