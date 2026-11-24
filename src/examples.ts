import type { RegexInput } from './url.ts';

export interface Example extends RegexInput {
  title: string;
  note: string;
}

export const EXAMPLES: readonly Example[] = [
  {
    title: 'Email format check',
    source: '\\A[^@\\s]+@[^@\\s]+\\.[a-z]{2,}\\z',
    flags: 'i',
    note: 'In Ruby, ^ and $ match at every line, but \\A and \\z match only at the start and end of the string. A value with a newline can pass a ^…$ check, so Rails format validations require \\A and \\z.',
  },
  {
    title: 'URL slug with possessive quantifiers',
    source: '\\A[a-z0-9]++(?:-[a-z0-9]++)*+\\z',
    flags: '',
    note: 'A possessive quantifier (++ or *+) never backtracks. A bad slug fails fast and cannot cause a slow match.',
  },
  {
    title: 'UUID in a route constraint',
    source: '\\A\\h{8}-\\h{4}-\\h{4}-\\h{4}-\\h{12}\\z',
    flags: 'i',
    note: '\\h is a hex digit. This is Ruby syntax. In JavaScript, \\h means the letter h.',
  },
  {
    title: 'Log line with named groups and the x flag',
    source: '(?<verb>GET|POST|PUT|PATCH|DELETE) \\s+ (?<path>/\\S*) \\s+ (?<status>\\d{3}) # request line',
    flags: 'x',
    note: 'The x flag ignores spaces and allows # comments. Group names become keys, as in match[:verb].',
  },
  {
    title: 'Markdown front matter at the top of a file',
    source: '\\A---\\R(?<front_matter>.*?)^---$',
    flags: 'm',
    note: '\\A matches only at the start of the whole string, so a --- later in the file does not start front matter. ^ and $ match at every line, so the closing --- can sit on any line. The m flag makes . match newlines, which JavaScript calls the s flag. \\R matches any line break.',
  },
];
