/**
 * Gate logic tests. Run with:  npx tsx src/content/gate.test.ts
 * (or build with esbuild and run with node).
 *
 * These cover the structural triggering gate's decisions under the conservative
 * "only prompt when claim-like" posture. They exercise pure logic only — the
 * live DOM reads (compose text, forwarded marker) are not unit-testable here and
 * are verified manually on WhatsApp Web.
 */
import { decide } from './gate';

interface Case {
  text: string;
  forwarded: boolean;
  expect: boolean;
  label: string;
}

const cases: Case[] = [
  { text: 'ok', forwarded: false, expect: false, label: 'trivial ack' },
  { text: 'see you at 6', forwarded: false, expect: false, label: 'casual short' },
  { text: 'meeting at 3pm', forwarded: false, expect: false, label: 'numeric but too short' },
  { text: '👍', forwarded: false, expect: false, label: 'emoji only' },
  { text: 'Good morning everyone how are you all', forwarded: false, expect: false, label: 'long-ish, no claim signals' },
  { text: 'Putin has a net worth of $250bn', forwarded: false, expect: true, label: 'terse numeric claim' },
  { text: 'The vaccine causes autism in 1 of 3 children', forwarded: false, expect: true, label: 'substantial + numerals' },
  { text: 'check this https://example.com/news', forwarded: false, expect: true, label: 'contains a link' },
  { text: 'Drinking very cold water right after a heavy meal is widely said to cause serious health problems and even cancer over many years in a great number of people, according to messages doctors keep warning about', forwarded: false, expect: true, label: 'very long even without numerals' },
  { text: 'any forwarded chain message', forwarded: true, expect: true, label: 'forwarded bonus' },
];

let passed = 0;
let failed = 0;
for (const c of cases) {
  const d = decide(c.text, c.forwarded);
  const ok = d.prompt === c.expect;
  ok ? passed++ : failed++;
  // eslint-disable-next-line no-console
  console.log(
    `${ok ? 'PASS' : 'FAIL'} | prompt=${d.prompt} want=${c.expect} | ${d.reason} | ${c.label}`,
  );
}
// eslint-disable-next-line no-console
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  // Make CI / a runner notice.
  throw new Error(`${failed} gate test(s) failed`);
}
