// Offline tests for the fact library's pure logic and the voice fingerprint.
//   node --experimental-strip-types --loader ./scripts/alias-loader.mjs scripts/library-voice.test.ts
import { factId, topicKey, activeFacts } from "../src/lib/fact-library.ts";
import { measureVoice, findHouseTics, voiceChecks, readProhibitions, stripStandaloneTics } from "../src/lib/voice-metrics.ts";
import { checkCompliance } from "../src/lib/script-compliance.ts";
import { buildSectionPlan } from "../src/lib/ai/claude.ts";

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) { failures++; console.log("  ✗ " + name); } else { console.log("  ✓ " + name); }
}

console.log("fact library:");
check("near-duplicate phrasings collapse to one id",
  factId("Meta reported $135.0 billion in advertising revenue in 2023.") === factId("Meta reported $135 billion in advertising revenue in 2023"));
check("different facts get different ids",
  factId("Meta made $135 billion.") !== factId("Queen spent 28 months undercover."));
check("topic key ignores filler words",
  topicKey("Why Social Media is FANTASTIC") === topicKey("social media fantastic"));

const lib = {
  facts: [
    { id: "a", fact: "Retrieved fact A", source: "https://a.com" },
    { id: "b", fact: "Retrieved fact B", source: "https://b.com" },
    { id: "c", fact: "My own pasted fact", source: null, manual: true },
  ],
  dismissed: ["b"],
};
const active = activeFacts(lib as any);
check("hidden facts are excluded from what generation uses", !active.some((f) => f.id === "b"));
check("hiding never deletes — the fact is still in the library", lib.facts.some((f) => f.id === "b"));
check("the user's own pasted facts rank first", active[0].id === "c");

console.log("voice metrics:");
const punchy = "You know this. You do. Short sentence. Another one here now.\n\nIt lands hard.";
const flowing = "The operation continued for a considerable period of time, during which the agent maintained an identity that required constant vigilance and a great deal of careful preparation across many months.";
const p = measureVoice(punchy);
const f = measureVoice(flowing);
check("punchy voice measures shorter sentences than flowing", p.avgSentenceWords < f.avgSentenceWords);
check("punchy voice registers a high fragment rate", p.fragmentRate > 0.3);
check("direct address is measured", p.secondPersonRate > 0);

console.log("house tics:");
const ticky = "Pause on that for a second. That's not a metaphor. That's biology. Let that sink in.";
const tics = findHouseTics(ticky);
check("detects the stock narrator constructions", tics.length >= 2);
check("clean prose has no tics", findHouseTics("The gun came down. The Mongols kept believing in him.").length === 0);
const vc = voiceChecks(ticky);
check("voice check fails on a ticky script", !vc.find((c) => c.id === "house-tics")!.pass);
check("voice check names the offending phrase", /pause on that|metaphor|sink in/i.test(vc.find((c) => c.id === "house-tics")!.detail));

// A creator's NEVER-DOES outranks the generic craft rules. Fern's real profile text.
console.log("voice prohibitions:");
const fern = `NEVER-DOES
Never uses rhetorical questions to open. Never addresses the viewer as "you." Never editorializes with adjectives.`;
const proh = readProhibitions(fern);
check("detects 'never addresses the viewer as you'", proh.noSecondPerson === true);
check("detects 'never uses rhetorical questions'", proh.noRhetoricalQuestions === true);
const chatty = `PERSON AND ADDRESS\nSpeaks directly to the viewer as "you" constantly, very personal.`;
check("a you-heavy voice is NOT flagged as forbidding it", readProhibitions(chatty).noSecondPerson === false);
check("empty profile forbids nothing", readProhibitions("").noSecondPerson === false);
// The panel must not mark a correctly-voiced Fern script wrong.
const fernScript = "Scott is fourteen years old and he has just seen a demon.\n\n" + "The room is quiet. ".repeat(60);
const withProh = checkCompliance({ fullScript: fernScript, topicKind: "explainer", voiceProhibitions: proh });
check("direct-address check stands down when the voice forbids 'you'", !withProh.some((c) => c.id === "direct-address"));
const withoutProh = checkCompliance({ fullScript: fernScript, topicKind: "explainer" });
check("direct-address check still runs for other voices", withoutProh.some((c) => c.id === "direct-address"));

// Deterministic tic removal — the guaranteed fix that runs even when the LLM pass skips.
console.log("standalone tic strip:");
const withTic = "We are giving more of our hours to a feed than to the actual humans in our lives. Read that again. We spend more time performing connection than having it.";
const stripped = stripStandaloneTics(withTic);
check("removes 'Read that again.' entirely", !/read that again/i.test(stripped));
check("leaves the surrounding sentences intact and joined", /humans in our lives\. We spend more time/.test(stripped));
check("no doubled spaces left behind", !/ {2,}/.test(stripped));
check("removes 'Pause on that for a second.'", !/pause on that/i.test(stripStandaloneTics("The number is fifty. Pause on that for a second. It funds everything.")));
check("removes 'Let that sink in.'", !/sink in/i.test(stripStandaloneTics("Fifty-four arrests. Let that sink in. Fifty-three convictions.")));
check("a tic at the start of a paragraph is removed cleanly",
  stripStandaloneTics("Read that again. The circuitry lights up.").trim() === "The circuitry lights up.");
check("real content is never touched", stripStandaloneTics("The gun came down. The Mongols kept believing.") === "The gun came down. The Mongols kept believing.");
check("no tics detected in the stripped output", findHouseTics(stripped).filter((t) => /read that/i.test(t)).length === 0);

// A voice profile's CTA style must not become an asset the creator doesn't have.
console.log("invented assets:");
const patreonScript = "The operation ended in 2000.\n\nThanks to our patrons on Patreon and everyone in our Discord for making this possible.";
const pa = checkCompliance({ fullScript: patreonScript }).find((c) => c.id === "invented-assets")!;
check("catches an invented Patreon/Discord", !pa.pass);
check("names what it found", /patron|discord/i.test(pa.detail));
const sponsorScript = "This video's sponsor is a company that sells socks. Use code SKRIPR.";
check("catches an invented sponsor read", !checkCompliance({ fullScript: sponsorScript }).find((c) => c.id === "invented-assets")!.pass);
const cleanCta = "If this story got you, subscribe. Drop a comment with what surprised you.";
check("a normal subscribe/comment CTA passes", checkCompliance({ fullScript: cleanCta }).find((c) => c.id === "invented-assets")!.pass);

console.log("section plan:");
// A source whose third section is the long one (the "expanded" peak).
const structure = [
  { section: "Hook", timestamp: "0:00", purpose: "open on a stat" },
  { section: "Steelman", timestamp: "1:00", purpose: "make the case for it" },
  { section: "The turn", timestamp: "2:00", purpose: "the mechanism that flips it" },
  { section: "Close", timestamp: "8:00", purpose: "land the paradox" },
];
const trigs = [
  { trigger: "Open loop", example: "and it has a price tag", timestamp: "0:20" },
  { trigger: "Subverted expectation", example: "the number is fifty dollars", timestamp: "3:10" },
];
const plan = buildSectionPlan(structure, trigs, 1500);
check("a section is produced for every source section", plan.length === 4);
check("word budgets sum to about the target", Math.abs(plan.reduce((a, b) => a + b.targetWords, 0) - 1500) < 200);
check("the source's longest section is marked the peak", plan[2].isPeak === true);
check("the peak gets the biggest budget", plan[2].targetWords === Math.max(...plan.map((p) => p.targetWords)));
check("the shape is preserved, not flattened", plan[2].targetWords > plan[1].targetWords * 2);
check("triggers land in the section they occurred in", plan[0].triggers.length === 1 && plan[2].triggers.length === 1);
check("a trigger carries the source's own example", /price tag/.test(plan[0].triggers[0]));
check("section purpose is carried through", plan[1].purpose.includes("case for it"));
// Scaling to a longer target keeps the proportions.
const long = buildSectionPlan(structure, trigs, 3000);
check("doubling the target keeps the same shape", Math.abs(long[2].targetWords / long[1].targetWords - plan[2].targetWords / plan[1].targetWords) < 0.1);
check("no usable timestamps yields no plan (falls back to one pass)", buildSectionPlan([{ section: "a" }, { section: "b" }] as any, [], 1500).length === 0);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
