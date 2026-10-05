// Regression guard for self-review protected lines: a sentence repeated 3+ times verbatim is a
// deliberate refrain ("Your one page.") and must be locked; 2 repeats or unique lines are not.
import { findRefrains } from "../src/lib/ai/claude";
const s = ["Your one page.", "Write it down.", "your one page", "Ten.", "Your one page!", "Write it down.", "The bills will wait."];
const got = [...findRefrains(s)].sort((a, b) => a - b);
const checks: [string, boolean][] = [
  ["3x refrain locked (case/punctuation-insensitive)", JSON.stringify(got) === JSON.stringify([0, 2, 4])],
  ["2x repeat not locked", !got.includes(1) && !got.includes(5)],
  ["unique lines not locked", !got.includes(3) && !got.includes(6)],
];
let fail = 0;
for (const [n, ok] of checks) if (!ok) { fail++; console.log(`FAIL  ${n} (got ${JSON.stringify(got)})`); }
console.log(`voice-guards: ${checks.length - fail}/${checks.length} passed`);
if (fail) process.exit(1);
