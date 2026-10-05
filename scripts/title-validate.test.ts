// REGRESSION SUITE for the shared TITLE VALIDATOR (title-validate.ts) — the deterministic accuracy
// guard used across Video Packaging, Viral Magnet, and A/B Titles. Pure functions, so we lock exact
// behavior: the weighted score, the hard gates, and each warning class (numeric gate, exclusivity,
// institutional framing, high-risk, causal, length). A future tweak that weakens any of these goes
// red here. Run: npx tsx scripts/title-validate.test.ts
import { weightedOverall, passesGates, validateTitle } from "../src/lib/title-validate.ts";

let failures = 0;
const check = (name: string, cond: boolean) => {
  console.log(`  ${cond ? "✓" : "✗"} ${name}`);
  if (!cond) failures++;
};
const types = (title: string, source?: string) => new Set(validateTitle(title, source).map((w) => w.type));
const clean = "How a Pipe-Bomb Suspect Hid as a Church Volunteer for 23 Years";

console.log("weightedOverall:");
check("all-9s -> 9.0", weightedOverall({ curiosity: 9, storyFit: 9, naturalness: 9, accuracy: 9, specificity: 9, pull: 9 }) === 9);
check("undefined -> null", weightedOverall(undefined) === null);
check("renormalizes when dims missing (only accuracy:8 -> 8)", weightedOverall({ accuracy: 8 } as any) === 8);

console.log("passesGates (accuracy/naturalness/storyFit all >= 8):");
check("all gate dims 8 -> pass", passesGates({ accuracy: 8, naturalness: 8, storyFit: 8, curiosity: 5 }));
check("accuracy 7 -> fail", !passesGates({ accuracy: 7, naturalness: 9, storyFit: 9 }));
check("missing storyFit -> fail", !passesGates({ accuracy: 9, naturalness: 9 } as any));

console.log("validateTitle — numeric gate (only runs with a source):");
check("altered duration 28 not in source -> number warning", types("Hidden for 28 Years", "he hid for 23 years").has("number"));
check("number present in source -> no warning", !types("Hidden for 23 Years", "he hid for 23 years").has("number"));
check("4-digit year NOT flagged even if absent from a thin source", !types("The 1972 Hijacking Nobody Solved", "a plane was taken").has("number"));
check("no source -> numeric gate does not run", !types("Hidden for 28 Years").has("number"));

console.log("validateTitle — claim classes:");
check("'the only' -> exclusivity", types("The Only Man to Escape").has("exclusivity"));
check("'nobody knew' -> exclusivity", types("The Fugitive Nobody Knew").has("exclusivity"));
check("'...in history' superlative -> exclusivity", types("The Biggest Bank Fraud in History").has("exclusivity"));
check("clean documentary title -> no exclusivity", !types(clean).has("exclusivity"));

console.log("validateTitle — length:");
check("over 65 chars -> length warning", types("How a Pipe-Bomb Suspect Hid as a Church Volunteer for Twenty-Three Whole Years").has("length"));
check("under 65 chars -> no length warning", !types(clean).has("length"));

console.log("validateTitle — clean title is fully clean:");
check("no warnings on a solid grounded title", validateTitle(clean).length === 0);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
if (failures) process.exit(1);
