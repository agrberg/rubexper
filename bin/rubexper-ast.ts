// Reads a JSON array of {source, flags} from stdin and prints one result per entry:
// {ok: true, ast} or {ok: false, error, position}. spec/conformance_spec.rb drives this.
import { parse } from '../src/parser/parser.ts';
import { RegexSyntaxError } from '../src/parser/ast.ts';

interface Case {
  source: string;
  flags: string;
}

const cases: Case[] = JSON.parse(await new Response(process.stdin as unknown as ReadableStream).text());
const results = cases.map(({ source, flags }) => {
  try {
    return { ok: true, ast: parse(source, flags) };
  } catch (error) {
    if (error instanceof RegexSyntaxError) return { ok: false, error: error.message, position: error.position };
    throw error;
  }
});
console.log(JSON.stringify(results));
