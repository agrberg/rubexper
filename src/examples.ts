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
    title: 'Split text on any line break',
    source: '\\R',
    flags: '',
    note: '\\R matches \\n, \\r\\n, and \\r. Use it for text from a textarea, where the line ending depends on the browser.',
  },
];
