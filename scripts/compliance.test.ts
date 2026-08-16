// Offline test for the post-generation compliance check, using the real shapes from the
// session: the final Queen script (should largely pass) vs. an early flat draft.
//   node --experimental-strip-types --loader ./scripts/alias-loader.mjs scripts/compliance.test.ts
import { checkCompliance, complianceScore, structuralScore, checkSourceStructural, accuracyChecks, STRUCTURAL_SET } from "../src/lib/script-compliance.ts";

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) { failures++; console.log("  ✗ " + name); } else { console.log("  ✓ " + name); }
}
const get = (checks: any[], id: string) => checks.find((c) => c.id === id);

const facts = [
  `A Mongols member put a handgun to his head and asked, "You a cop?"`,
  "Queen grew close to a Mongol named Tiny.",
];

// The shipped Queen script: quote-led open, early defer, callback, ends on the quote.
const goodScript = `You a cop? The gun is already at his head before the question finishes. The guy on the receiving end of that barrel has a long goatee, a Harley, and a name that isn't his. He goes by Billy St. John.

But getting to that moment took a long time. It involved a small bag, a flat surface, and a question with only one acceptable answer. We'll get there. First, you have to understand how a man ends up in that room at all.

Billy Queen started as a North Carolina police officer. He bought a Harley and let the goatee grow long. He worked his way into the San Fernando Valley chapter as a hang-around.

And then a Mongols member put a handgun to Billy Queen's head and asked him if he was a cop. Whatever Billy St. John said in that moment, it worked. The gun came down.

When Queen's identity came out, Tiny found out who Billy St. John actually was. What Tiny said, according to Queen, was this: 'You could have been my brother.'`;

const goodSections = [
  { title: "Hook", content: "x ".repeat(120) },
  { title: "Setup", content: "x ".repeat(140) },
  { title: "The scene", content: "x ".repeat(420) }, // the peak, weighted
  { title: "Resolution", content: "x ".repeat(130) },
];

console.log("Good script (final Queen shape):");
const good = checkCompliance({ fullScript: goodScript, sections: goodSections, facts, targetWords: 150, sourceHookType: "quote" });
check("section weighting passes (peak dominates)", get(good, "section-weighting").pass);
check("quote-led hook passes", get(good, "quote-hook").pass);
check("early open loop passes", get(good, "early-loop").pass);
check("no sourcing leak", get(good, "sourcing-leak").pass);
check("ends on its strongest line", get(good, "ends-on-line").pass);

// The failure modes seen across the session.
console.log("Flat draft (the failures this session):");
const flatSections = [
  { title: "a", content: "x ".repeat(200) },
  { title: "b", content: "x ".repeat(210) },
  { title: "c", content: "x ".repeat(205) },
  { title: "d", content: "x ".repeat(195) },
];
const flatScript = `Billy Queen was an ATF agent who went undercover with the Mongols. He spent nearly two years inside.

The operation ended in 2000 with dozens of arrests. What the facts establish is that he came out the other side.

Queen later wrote a memoir about the experience. He described the cost of the work. That is what this work actually looks like, and the record does not say more.`;
const flat = checkCompliance({ fullScript: flatScript, sections: flatSections, facts, targetWords: 400, sourceHookType: "quote" });
check("catches the flat section weighting", !get(flat, "section-weighting").pass);
check("catches the unused available quote", !get(flat, "quote-hook").pass);
check("catches the missing early open loop", !get(flat, "early-loop").pass);
check("catches the sourcing leak", !get(flat, "sourcing-leak").pass);
check("catches the short length", !get(flat, "length").pass);

const s = complianceScore(flat);
check("score reports a mix, not all-pass", s.passed < s.total);

// Explainer (Kurzgesagt) form is judged on different moves than a documentary.
console.log("explainer form:");
const kurz = `You have about 150 people you can really know. That is one village.

Now scale it up. A city of one million runs on the same instinct, but the instinct was never built for it. Stack that to one billion and the mismatch stops being imaginable. That's about as many people as you could meet, one per second, for thirty years without sleeping.

Nobody knows yet whether the effect holds at that size. The models disagree.`;
const kurzChecks = checkCompliance({ fullScript: kurz, topicKind: "explainer", targetWords: 60 });
const kget = (id: string) => kurzChecks.find((c) => c.id === id);
check("scale ladder detected", kget("scale-ladder").pass);
check("big numbers made physical", kget("numbers-physical").pass);
check("speaks to the viewer", kget("direct-address").pass);
check("no system intent", kget("no-system-intent").pass);

const preachy = `The algorithm wants your attention and it is designed to trick you into scrolling. Social media companies decided that engagement mattered more than people.`;
const preachyChecks = checkCompliance({ fullScript: preachy, topicKind: "explainer" });
const pget = (id: string) => preachyChecks.find((c) => c.id === id);
check("catches intent assigned to a system", !pget("no-system-intent").pass);
check("catches the missing scale ladder", !pget("scale-ladder").pass);

// Documentary topics must NOT be judged on explainer moves.
check("explainer checks do not run on an event script", !checkCompliance({ fullScript: goodScript, topicKind: "event", facts }).some((c) => c.id === "scale-ladder"));

// GROUNDING — the check that measures truth to the research, not shape.
console.log("grounding check:");
const socialFacts = [
  "Meta reported $135.0 billion in advertising revenue in 2023, approximately $50 per user per year.",
  "A 2016 Psychological Science fMRI study found receiving likes activates reward-related brain regions.",
];
const grounded = `Meta made $135 billion in 2023. That works out to about $50 per user per year. A 2016 study found likes activate reward-related regions.`;
const gChecks = checkCompliance({ fullScript: grounded, facts: socialFacts });
check("passes when every figure traces to the facts", gChecks.find((c) => c.id === "grounding")!.pass);

const ungrounded = `Meta made $135 billion in 2023. The average adult spends 2 hours 23 minutes a day on social media, against 1 hour 30 minutes in person. A 2019 review found a 27 percent increase.`;
const uChecks = checkCompliance({ fullScript: ungrounded, facts: socialFacts });
const gr = uChecks.find((c) => c.id === "grounding")!;
check("catches figures that are NOT in the facts", !gr.pass);
check("names the unsupported figures", /23|27|percent/.test(gr.detail));
check("does not flag the supported $135 billion", !/135/.test(gr.detail));
check("grounding check is skipped when there are no facts", !checkCompliance({ fullScript: ungrounded }).some((c) => c.id === "grounding"));

// The reviewer's exact misses: prose quantities and proportion claims the digit scan can't see.
console.log("grounding — prose quantities & proportions:");
const proseUngrounded = `Meta made $135 billion. There are three billion of them, and more than half of the time people spend online socializing now happens on platforms.`;
const pg = checkCompliance({ fullScript: proseUngrounded, facts: socialFacts }).find((c) => c.id === "grounding")!;
check("catches a spelled-out 'three billion' not in facts", !pg.pass && /three billion/i.test(pg.detail));
check("catches a 'more than half' proportion claim with no proportion fact", /more than half/i.test(pg.detail));
const proseGrounded = `Meta made $135 billion, about $50 per user per year.`;
check("does not flag when the supported figure is spelled or formatted", checkCompliance({ fullScript: proseGrounded, facts: socialFacts }).find((c) => c.id === "grounding")!.pass);

// Repetition / padding: the same figure four times = thin facts stretched to length.
console.log("repetition / padding:");
const padded = `Meta made $135 billion. ${"The $135 billion funds it. ".repeat(3)}`;
check("flags a figure repeated 4+ times", !checkCompliance({ fullScript: padded }).find((c) => c.id === "repetition")!.pass);
check("a figure used once or twice is fine", checkCompliance({ fullScript: "Meta made $135 billion. That $135 billion funds the whole thing." }).find((c) => c.id === "repetition")!.pass);
// Conceptual repetition: the same explanation restated a few paragraphs apart.
const receptorPara = "Nicotine molecules bind directly to nicotinic acetylcholine receptors scattered throughout the brain, activating those receptors and prompting the neurons to fire signals downstream through the cortex.";
const dupScript = `${receptorPara}\n\n${"Different filler content about history and context and background here entirely. ".repeat(6)}\n\nNicotine molecules bind directly onto the nicotinic acetylcholine receptors scattered throughout the brain, activating those receptors and prompting the neurons downstream to fire signals through the cortex again.`;
check("catches an explanation restated a few paragraphs apart", !checkCompliance({ fullScript: dupScript }).find((c) => c.id === "repetition")!.pass);
check("does not flag two genuinely different paragraphs", checkCompliance({ fullScript: `${receptorPara}\n\n${"Meanwhile the tobacco industry pursued marketing strategies aimed at teenagers across several decades of television advertising campaigns everywhere. ".repeat(3)}` }).find((c) => c.id === "repetition")!.pass);

// The two panel bugs from the social-media run.
console.log("panel bug fixes:");
const deferScript = `Social media runs on ranking. And it has a price tag. A very specific one.

${"filler ".repeat(60)}

The number is fifty dollars.`;
check("explainer-style deferral counts as an open loop", checkCompliance({ fullScript: deferScript }).find((c) => c.id === "early-loop")!.pass);
const noGarble = checkCompliance({ fullScript: `You open the app each morning.\n\n${"middle words here ".repeat(40)}\n\nYou close the app, and the morning is gone.` }).find((c) => c.id === "callback")!;
check("callback detail is a real phrase, not junk tokens", !/\(between|minutes\)/.test(noGarble.detail));

console.log("stat-hook mechanics:");
const srcHook = "Alcohol is the most harmful substance on Earth. Every year it kills more people than terrorism, wars, homicides and car accidents combined.";
// The strong version: superlative + stacked comparison, short.
const strongHook = "Alcohol is the deadliest drug on Earth. It kills more people than terrorism, wars and car accidents combined.";
const sh = (script: string) => checkCompliance({ fullScript: script, sourceHookType: "Controversy", sourceHookText: srcHook }).find((c) => c.id === "hook-archetype")!;
check("passes a superlative + stacked-comparison hook", sh(strongHook).pass);
// A number with no superlative and no comparison must now FAIL (old check passed this).
const weakHook = "Every single day, the average adult hands over 2 hours and 23 minutes of their life to social media. That is a system worth 135 billion dollars a year that profits from your attention.";
check("fails a hook that has a number but no superlative or comparison", !sh(weakHook).pass);
check("names the missing engine", /superlative|stacked comparison/i.test(sh(weakHook).detail));
// A superlative claim proved by a single big figure (no stacked comparison available) still passes.
const superlativeOnly = "Social media is the most precisely engineered attention system ever built, worth 135 billion dollars a year to a single company.";
check("passes a superlative proved by the biggest figure", sh(superlativeOnly).pass);
// Too long fails even with the mechanics present — the first two sentences themselves run long.
const longHook = "Alcohol is the most harmful and most quietly devastating substance ever produced by human beings across the whole of recorded history, worse than nearly anything else you could name. It kills far more people every single year than terrorism and wars and homicides and car accidents all added together and then some, which is genuinely difficult to fully take in when you sit with the sheer scale of it.";
check("fails a hook that is far longer than the source's", !sh(longHook).pass);

console.log("hook matches script:");
const hk = "Your attention is worth about fifty dollars a year.";
check("passes when the body starts with the hook",
  checkCompliance({ fullScript: hk + " Last year that added up to billions.", hook: hk }).find((c) => c.id === "hook-matches-script")!.pass);
check("catches a hook that differs from the opening",
  !checkCompliance({ fullScript: "Social media is fantastic. Genuinely, unironically fantastic.", hook: hk }).find((c) => c.id === "hook-matches-script")!.pass);
check("check is skipped when there is no hook field",
  !checkCompliance({ fullScript: "Some script text here." }).some((c) => c.id === "hook-matches-script"));

// Open loop — the check must catch SEMANTIC deferrals, not just explicit "we'll get
// there" phrasing. These three shapes are real generated open loops the old string-match
// called missing, which made the check fail on nearly every script.
console.log("open loop — semantic deferrals:");
const loopEx = (open: string) =>
  get(checkCompliance({ fullScript: open + " " + "and then the rest of the story unfolds from there. ".repeat(6) }), "early-loop");
check("catches a promised-but-unquantified consequence",
  loopEx("That assumption is going to cost the United States something it can never fully account for.").pass);
check("catches promised specificity ('a very specific one')",
  loopEx("Every scroll has a price. And it has a price tag. A very specific one.").pass);
check("catches a promised mechanism reveal ('go through exactly how it worked')",
  loopEx("What Smith actually built was simpler than anyone expected. So let us go through exactly how it worked.").pass);
// It must still NOT pass an opening that makes no promise at all.
check("does not flag an opening with no open loop",
  !loopEx("The weather was mild that morning and the streets were quiet and ordinary in every way.").pass);

// FIDELITY SCORING — a FIXED per-kind denominator (so scores are comparable across runs)
// and the source video scored against the same set.
console.log("fidelity scoring:");
// The denominator must not move between two different event scripts, regardless of
// whether facts/quotes are present (the old count moved run to run).
const eventA = structuralScore(checkCompliance({ fullScript: goodScript, sections: goodSections, facts, targetWords: 150, sourceHookType: "quote" }), "event");
const eventB = structuralScore(checkCompliance({ fullScript: flatScript, sections: flatSections }), "event");
check("event fidelity denominator is fixed across runs", eventA.total === eventB.total && eventA.total === STRUCTURAL_SET.event.length);
check("fidelity score omits accuracy checks (structure only)", eventA.items.every((c) => c.kind === "structure"));
const kindExp = structuralScore(checkCompliance({ fullScript: kurz, topicKind: "explainer", targetWords: 60 }), "explainer");
check("explainer fidelity denominator matches its pinned set", kindExp.total === STRUCTURAL_SET.explainer.length);
// The source video, scored on the same structural set. Self-referential checks (length,
// weighting) are forced to pass; the real signal is open-loop / callback / closing.
const srcChecks = checkSourceStructural({ sourceText: goodScript, topicKind: "event" });
check("source scoring forces length to pass (source defines its own length)", srcChecks.find((c) => c.id === "length")!.pass);
const srcScore = structuralScore(srcChecks, "event");
check("source is scored over the same fixed set", srcScore.total === STRUCTURAL_SET.event.length);
// Accuracy checks are retrievable as their own group for the safety row.
check("accuracy checks are separable for the safety row",
  accuracyChecks(checkCompliance({ fullScript: goodScript, facts })).every((c) => c.kind === "accuracy"));

// SOURCE CONTENT LEAK — a distinctive term from the source video's story appearing in a
// remix on a different topic, without a supporting fact, is copied content.
console.log("source content leak:");
const sourceEntities = ["Nike", "Memphis", "shipping labels", "sneaker stores"];
const leakScript = "The fraud ran through sneaker stores in Memphis, moving product with forged shipping labels.";
const leakChk = (s: string, f: string[] = []) => get(checkCompliance({ fullScript: s, sourceEntities, facts: f }), "source-leak");
check("flags source content that leaked into the remix", !leakChk(leakScript).pass);
check("names the leaked terms", /Memphis|sneaker stores|shipping labels/i.test(leakChk(leakScript).detail));
check("does NOT flag a term the user's own facts support",
  leakChk("The Memphis operation was the center of it.", ["The scheme was based in Memphis, Tennessee."]).pass);
check("passes a clean remix that borrows only structure",
  leakChk("A Spotify playlist scheme inflated streams for tracks nobody heard.").pass);

// STALE DATE — a future-framed event whose date has already passed.
console.log("stale date:");
const nowRef = Date.parse("2026-08-16");
const sd = (s: string) => get(checkCompliance({ fullScript: s, now: nowRef }), "stale-date");
check("flags a 'scheduled for' date that has already passed",
  !sd("His sentencing is scheduled for July 29, 2026, where he faces twenty years.").pass);
check("does NOT flag a future pending date",
  sd("His sentencing is scheduled for December 1, 2026.").pass);
check("does NOT flag a normal past-tense historical date",
  sd("He was sentenced on July 29, 2019, to twenty years.").pass);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
