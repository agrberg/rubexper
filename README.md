# rubexper

Railroad diagrams for Ruby (Onigmo) regular expressions. Live site: <https://agrberg.github.io/rubexper/>.

[regexper](https://gitlab.com/javallone/regexper-static) parses only JavaScript syntax. rubexper parses Ruby syntax, so possessive quantifiers, atomic groups, `\h`, `\K`, `\R`, `\G`, conditionals, and `\g<name>` calls draw correctly. Unsupported or invalid patterns show an error message and no diagram. The site never draws a wrong diagram.

The page runs in the browser. The pattern stays in the URL hash, so the host never receives it.

## Share a pattern

The URL hash holds the pattern as a Ruby literal: `#<encodeURIComponent("/source/flags")>`. Flags are any of `m`, `i`, `x`, `n`. If the hash is not a `/…/flags` literal, the whole hash is the pattern with no flags.

Click **Copy link as comment** to copy `# https://…#…`, ready to paste above a regex in Ruby code.

Example: <https://agrberg.github.io/rubexper/#%2F(%3F%3Ea%2B%2B)%5Ch%7B2%7D%2Fx>

## Develop

Requirements: Node 24 (see `.tool-versions`). Ruby and Bundler are only necessary for the conformance spec.

```bash
npm ci
npm run dev           # dev server
npm test              # vitest
npm run lint          # oxlint
npm run format:check  # prettier
npm run build         # type-check and production build into dist/
bundle install && bundle exec rspec   # conformance spec against regexp_parser
```

CI runs `format:check`, `lint`, `test`, and `build`, plus `bundle exec rspec` in a second job. Every push to `main` deploys to GitHub Pages after the tests pass.

## More

- [ARCHITECTURE.md](ARCHITECTURE.md): how the parser, renderer, and conformance spec fit together.
- [CLAUDE.md](CLAUDE.md): guidance for Claude Code.
- [Design spec](docs/superpowers/specs/2026-11-24-rubexper-design.md): original goals and decisions.
