// Regression guard: legacy hook labels map onto the 8 user-facing types, and the ranking measures
// SHARE OF WINNERS (not raw views, which mostly track channel size).
import { toHookFamily, rankHookFamilies } from "../src/lib/hook-families";
const checks: [string, boolean][] = [
  ["Scene-Setter -> STORY", toHookFamily("Scene-Setter") === "STORY"],
  ["Teaser -> CURIOSITY GAP", toHookFamily("Teaser") === "CURIOSITY GAP"],
  ["Bold Claim -> CONTROVERSY", toHookFamily("Bold Claim") === "CONTROVERSY"],
  ["exact UI type passes through", toHookFamily("FEAR/STAKES") === "FEAR/STAKES" && toHookFamily("Myth-Bust") === "MYTH-BUST"],
  ["unknown label -> null", toHookFamily("Banana") === null],
];
const rows = [
  ...Array(6).fill({ hook_type: "STORY", source_views: 1e6 }),
  ...Array(3).fill({ hook_type: "PATTERN INTERRUPT", source_views: 9e9 }), // few hooks, giant views
  ...Array(2).fill({ hook_type: "REFRAME", source_views: 5e6 }),          // below minN
];
const r = rankHookFamilies(rows);
checks.push(["most-used by winners ranks first, not biggest views", r[0]?.type === "STORY"]);
checks.push(["types under minN are not ranked", !r.some((x) => x.type === "REFRAME")]);
checks.push(["share computed over all labeled hooks", Math.abs((r[0]?.share ?? 0) - 6 / 11) < 1e-9]);
let fail = 0;
for (const [n, ok] of checks) if (!ok) { fail++; console.log(`FAIL  ${n}`); }
console.log(`hook-families: ${checks.length - fail}/${checks.length} passed`);
if (fail) process.exit(1);
