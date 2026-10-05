// Regression guard: mined primary docs must mention the case's distinctive token (surname / core
// entity name), never a first name, so an unrelated doc (Carlson v. Carlson, judge "Frank") is dropped.
import { caseAnchorToken as a, docMentionsAnchor as m, offTopicSourceFacts, sanitizeCaseLabel, groundCandidates, quotedPhrases, cleanQuoteFormatting } from "../src/lib/research";
const checks: [string, boolean][] = [
  ["Freshwaters anchor", a("Frank Freshwaters — fugitive manhunt") === "Freshwaters"],
  ["surname not first name (Wright)", a("George Edward Wright") === "Wright"],
  ["surname not first name (Jimenez)", a("Arnoldo Jimenez") === "Jimenez"],
  ["O.J. Simpson -> Simpson", a("O.J. Simpson murder case") === "Simpson"],
  ["entity core name (Hansa)", a("The Hansa Market takedown") === "Hansa"],
  ["Carlson facts rejected", !m("The Bankruptcy Judge who authored the opinion is Frank R. Alley, III.\nThe Plaintiff is Sherryl Carlson.", "Freshwaters")],
  ["real doc accepted", m("Freshwaters was reported missing on Sept. 30, 1959.", "Freshwaters")],
  ["no anchor -> never blocks", m("anything", null)],
];
const lib = [
  ...["Carlson v. Carlson, Adversary Proceeding No. 02-6006-fra.", "The opinion is dated 12/15/2002.", "The Bankruptcy Judge is Frank R. Alley, III."].map((fact) => ({ fact, source: "orb.pdf" })),
  { fact: "Freshwaters was captured on May 4, 2015.", source: "wiki" },
  { fact: "The alias was William Harold Cox.", source: "wlwt" }, // 1 fact, no anchor: kept (too small to judge)
];
const off = offTopicSourceFacts(lib, "Freshwaters").map((f) => f.source);
checks.push(["cached unrelated doc (3 facts, no anchor) dismissed", off.length === 3 && off.every((s) => s === "orb.pdf")]);
const F = ["Frank Freshwaters was captured on May 4, 2015 in Melbourne, Florida.", "He was reported missing from an Ohio honor camp on Sept. 30, 1959."];
const bad = sanitizeCaseLabel("Frank Freshwaters — Ohio fugitive captured in Morocco", "He walked away in 1959. He was captured in Morocco.", F);
checks.push(["memory label with unsupported place loses descriptor", bad.name === "Frank Freshwaters" && bad.removed.includes("Morocco")]);
checks.push(["unsupported summary sentence dropped, supported kept", bad.summary === "He walked away in 1959."]);
const good = sanitizeCaseLabel("Frank Freshwaters — Ohio fugitive manhunt", "Captured in Melbourne, Florida in 2015.", F);
checks.push(["supported label untouched", good.name === "Frank Freshwaters — Ohio fugitive manhunt" && good.removed.length === 0]);
checks.push(["research quote parser finds curly-quoted phrase", quotedPhrases("culminated “the longest manhunt in the history” of the service").join() === "the longest manhunt in the history"]);
checks.push(["single-word scare quotes ignored", quotedPhrases('a so-called "ghost" lived there').length === 0]);
checks.push(["nested quotes + stray 'he said' cleaned", cleanQuoteFormatting(`per Goodyear, "he said he hadn't seen that guy," then "'You got me.'"`) === `per Goodyear, "he hadn't seen that guy," then "You got me."`]);
checks.push(["vague 'abroad' in a label is caught", sanitizeCaseLabel("X — case", "He was apprehended abroad in 2015.", ["He was arrested in Florida in 2015."]).removed.includes("abroad")]);
checks.push(["same case under two labels -> same anchor", a("Frank Freshwaters · 1957-2015") === a("Frank Freshwaters — fugitive manhunt")]);
{ const cands = [
    { name: "D.B. Cooper", summary: "The title does not clearly point to a documented case; the better-documented real case is the unsolved D.B. Cooper hijacking and later suspect speculation involving Arthur Gerald Jones." },
    { name: 'Arthur Gerald Jones — identity of the man behind the "D.B. Cooper" hijacking suspect composite', summary: "Arthur Gerald Jones was identified by some researchers and family members as a strong candidate for the unsolved 1971 D.B. Cooper skyjacking. The FBI has never officially confirmed any suspect." },
  ];
  const facts = ["Arthur Gerald Jones, a Chicago commodities broker, vanished in 1979 and lived as Joseph Richard Sandelli in Las Vegas.", "Jones was arrested July 19, 2011 by a Nevada DMV investigator on identity-theft charges.", "The record clearly shows Arthur Gerald Jones as a real person tied to a documented identity-fraud case."];
  const g = groundCandidates(cands, "Arthur Gerald Jones", facts, "Identity-fraud case.");
  checks.push(["name-only topic: the D.B. Cooper card is dropped", g.length === 1 && g[0].name.startsWith("Arthur Gerald Jones")]);
  checks.push(["unsupported Cooper label + summary stripped from the Jones card", !/cooper/i.test(g[0].name + g[0].summary)]);
  const t = groundCandidates([{ name: "Christopher Boyce", summary: "Sold satellite secrets." }, { name: "William Kampiles", summary: "Sold the KH-11 manual." }], "The Hunt for the Man Who Sold America's Satellites", [], "");
  checks.push(["a title-style topic keeps every card", t.length === 2]); }
{ const g = groundCandidates([{ name: "Arthur Gerald Jones", summary: "Former Chicago commodities broker who disappeared in 1979 and was found in Las Vegas." }, { name: "Arthur Gerald Jones — identity unknown or insufficiently documented", summary: "No documented historical case named Arthur Gerald Jones is retrievable with confidence." }], "Arthur Gerald Jones", [], "");
  checks.push(["'identity unknown' placeholder card dropped beside the real case", g.length === 1 && !/unknown/.test(g[0].name)]); }
{ const g = groundCandidates([{ name: "Arthur Gerald Jones — identity unknown or insufficiently documented", summary: "No documented historical case named Arthur Gerald Jones is retrievable with confidence." }], "Arthur Gerald Jones", [], "A real person tied to a documented identity-fraud case.");
  checks.push(["placeholder-only case keeps the name, loses 'identity unknown'", g.length === 1 && g[0].name === "Arthur Gerald Jones" && g[0].summary.startsWith("A real person")]); }
{ const g = groundCandidates([{ name: "Arthur Gerald Jones — identity unclear or multiple individuals", summary: "Could refer to several people." }], "Arthur Gerald Jones", [], "A documented identity-fraud case.");
  checks.push(["name-only topic: label is the bare name, whatever the placeholder wording", g[0].name === "Arthur Gerald Jones"]); }
let fail = 0;
for (const [n, ok] of checks) if (!ok) { fail++; console.log(`FAIL  ${n}`); }
console.log(`research-relevance: ${checks.length - fail}/${checks.length} passed`);
if (fail) process.exit(1);
