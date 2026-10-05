// Regression guard: the angle checker can never display a warning built on a quote that isn't really
// in the angle/facts (the "Tenerife" fabrication), and a span equal to two fact dates' gap is supported.
import { verifiedWarning, durationFromFactDates } from "../src/lib/ai/angle-vet";
import { selectAngles } from "../src/lib/ai/angle-spines";
const facts = "He was arrested in West Virginia in 1975. Frank Freshwaters was captured on May 4, 2015 in Melbourne, Florida.";
const angle = "He walked free and vanished again, into a life that would last another forty years, in rural Florida.";
const checks: [string, boolean][] = [
  ["invented contradicting fact is dropped", verifiedWarning({ phrase: "rural Florida", kind: "contradiction", fact: "He was arrested in Tenerife, Spain in 2015." }, angle, facts) === null],
  ["phrase not in the angle is dropped", verifiedWarning({ phrase: "hiding under a sink", kind: "unsupported" }, angle, facts) === null],
  ["real quoted contradiction is shown", (verifiedWarning({ phrase: "rural Florida", kind: "contradiction", fact: "Frank Freshwaters was captured on May 4, 2015 in Melbourne, Florida." }, angle, facts) || "").includes("Melbourne")],
  ["'another forty years' = 2015-1975 is supported", durationFromFactDates("another forty years", facts)],
  ["'40 years' digits supported", durationFromFactDates("hid for 40 years", facts)],
  ["'twelve years' unsupported", !durationFromFactDates("twelve years", facts)],
];
// (recency + replace-in-place are covered live; factId collision is the reason replaceInLibrary exists)
{ const mk = (hookType: string, factCount: number, warnings: string[] = []) => ({ hookType, factCount, warnings });
  const cards = [mk("STORY", 41), mk("CURIOSITY GAP", 38), mk("CONTROVERSY", 40, ["bad"]), mk("REFRAME", 35), mk("FEAR / STAKES", 6), mk("STORY", 30), mk("OVERLOOKED MECHANISM", 33), mk("MYTH-BUST", 36)];
  const sel = selectAngles(cards, { max: 5, allowRepeatTypes: false, topHookType: "STORY" });
  checks.push(["no flagged card shown when clean ones exist", sel.every((c) => !c.warnings.length)]);
  checks.push(["one card per hook type", new Set(sel.map((c) => c.hookType)).size === sel.length]);
  checks.push(["thin card (6 facts vs 41) dropped", !sel.some((c) => c.factCount === 6)]);
  checks.push(["deepest spine first", sel[0].factCount === 41 && sel.length === 5]);
  const few = selectAngles([mk("STORY", 20), mk("REFRAME", 18, ["x"]), mk("FEAR", 15, ["y"])], { max: 5, allowRepeatTypes: false });
  checks.push(["fewer than 3 clean: flagged cards fill in, warnings kept", few.length === 3 && few[0].warnings.length === 0]); }
{ const mk = (hookType: string, spineName: string, factCount = 22) => ({ hookType, spineName, factCount, warnings: [] as string[] });
  const cards = [mk("CURIOSITY GAP", "Confession"), mk("PATTERN INTERRUPT", "Confession"), mk("REFRAME", "Confession"), mk("MYTH-BUST", "Confession"), mk("STORY", "Vanished", 24), mk("FEAR", "Trusted", 21), mk("OVERLOOKED MECHANISM", "Falsified", 22)];
  const sel = selectAngles(cards, { max: 5, allowRepeatTypes: false });
  checks.push(["different stories first: 4 distinct spines before any repeat", new Set(sel.slice(0, 4).map((c) => c.spineName)).size === 4 && sel.length === 5]); }
{ const card = "She hid in Pulaski for about 30 years. The payoff lands on the fingerprint match. VIEWER ASKS: How did she evade capture for 35 years?";
  const w = verifiedWarning({ phrase: "evade capture for 35 years", kind: "mismatch" }, card, "facts");
  checks.push(["Viewer-asks mismatch shown when the quote is on the card", !!w && /Viewer asks/.test(w)]);
  checks.push(["mismatch dropped when the quote isn't on the card", verifiedWarning({ phrase: "hid for 50 years", kind: "mismatch" }, card, "facts") === null]); }
let fail = 0;
for (const [n, ok] of checks) if (!ok) { fail++; console.log(`FAIL  ${n}`); }
console.log(`angle-vet: ${checks.length - fail}/${checks.length} passed`);
if (fail) process.exit(1);
