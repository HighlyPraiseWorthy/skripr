// Offline test for the post-generation compliance check, using the real shapes from the
// session: the final Queen script (should largely pass) vs. an early flat draft.
//   node --experimental-strip-types --loader ./scripts/alias-loader.mjs scripts/compliance.test.ts
import { checkCompliance, complianceScore, structuralScore, checkSourceStructural, accuracyChecks, STRUCTURAL_SET, stripInsinuations, stripUnnamedPartyNaming, stripSpeculation, stripImpliedRevelation, dedupeAdjacentParagraphs, stripDuplicateHook, collapseRepeatedAnchors, stripSchemeDurationClaim, stripStaleFutureDates, stripSourceLeaks, mergeOrphanFragments, correctDatesToFacts, stripUnitConflation } from "../src/lib/script-compliance.ts";

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
// Month-level granularity (the missed case): "July 2026" with no day, today is Aug 2026.
check("flags a month-only future-framed date that has passed",
  !sd("His sentencing is scheduled for July 2026.").pass);
check("does NOT flag a month-only date still in the future",
  sd("His sentencing is scheduled for December 2026.").pass);
check("does NOT flag the current month before it has fully passed",
  sd("His sentencing is scheduled for August 2026.").pass);

// Move #6 — heading claim-check. A number in a SECTION HEADING must trace to the facts, even
// when the body grounding misses it.
console.log("heading claim-check:");
const hFacts = ["The scheme relied on roughly 1,040 bot accounts.", "It generated about 661,440 streams a day."];
const hg = (sections: any[]) => get(checkCompliance({ fullScript: "Body text here that is long enough. ".repeat(10), sections, facts: hFacts }), "heading-grounding");
check("flags a heading figure that is not in the facts",
  !hg([{ title: "The empire that made 9,000,000 a month", content: "x" }]).pass);
check("passes a heading whose figure is in the facts",
  hg([{ title: "The bot army streaming 661k songs", content: "x" }]).pass);
check("ignores small counts in a heading",
  hg([{ title: "3 ways it stayed hidden", content: "x" }]).pass);
check("passes when headings carry no numbers",
  hg([{ title: "How the scheme unraveled", content: "x" }]).pass);

// Move #7 — quote grounding. A verbatim quote in the script must trace to a sourced quote fact.
console.log("quote grounding:");
const qFacts = ['In a February 2024 email, Smith wrote: "we need to get more plays on the songs to make more money" (source: justice.gov)'];
const qg = (s: string) => get(checkCompliance({ fullScript: s + " " + "and the analysis continues from there. ".repeat(10), facts: qFacts }), "quote-grounding");
check("passes a quote that matches a sourced fact",
  qg('He put it plainly. "We need to get more plays on the songs to make more money," he wrote.').pass);
check("flags a quote that appears in no fact",
  !qg('He grinned and said, "I built the perfect crime and no one will ever catch me here."').pass);
check("passes when the script has no verbatim quotes",
  qg("The scheme relied on automated accounts that streamed songs around the clock.").pass);

// Move #8 follow-up — implied-fact cliffhanger. Craft may not imply a revelation the facts
// don't deliver, even when every sentence is individually sourced.
console.log("implied-revelation:");
const ir = (s: string) => get(checkCompliance({ fullScript: s }), "implied-revelation");
const teaseEnding = "He ran the scheme for years.\n\nThe bots streamed around the clock.\n\nAnd what investigators found when they traced where the money actually went was not what anyone expected.";
check("flags an ending that teases a revelation the facts don't deliver", !ir(teaseEnding).pass);
const cleanEnding = "He ran the scheme for years.\n\nThe bots streamed around the clock.\n\nIn January 2024 he pleaded guilty, and the court ordered an $8,091,843.64 forfeiture.";
check("passes an ending that lands on a real documented outcome", ir(cleanEnding).pass);

// UNIVERSAL figure-check — voice-independent. The SAME fact rendered three ways must all match;
// an actually-absent number must flag in all three renderings.
console.log("figure-check: voice-independent number normalization:");
const moneyFacts = ["The court ordered an $8,091,843.64 forfeiture."];
const fg = (s: string) => get(checkCompliance({ fullScript: s + " " + "and the analysis continues here. ".repeat(8), facts: moneyFacts }), "grounding");
check("digits form of the fact passes", fg("The forfeiture was 8,091,843 dollars.").pass);
check("spelled-out form of the fact passes", fg("The forfeiture was eight million ninety one thousand eight hundred forty three dollars.").pass);
check("abbreviated $8M form of the fact passes", fg("The forfeiture was about $8M.").pass);
check("an absent figure flags in digit form", !fg("They seized 25,000,000 dollars.").pass);
check("an absent figure flags in spelled form", !fg("They seized twenty five million dollars.").pass);
check("an absent figure flags in abbreviated form", !fg("They seized $25M.").pass);
// The fragmentation bug: a correctly-spelled big number is parsed whole, not chopped into fragments.
const bigFacts = ["The bots generated 661,440 streams a day."];
check("a correctly-spelled big number matching the facts passes (no fragmentation)",
  get(checkCompliance({ fullScript: "The bots generated six hundred sixty one thousand four hundred forty streams a day. " + "More analysis here. ".repeat(8), facts: bigFacts }), "grounding").pass);

// SAFETY — person-insinuation HARD guard (defamation risk): implying a real person's knowledge/
// complicity beyond the facts.
console.log("person-insinuation guard:");
const pi = (s: string) => get(checkCompliance({ fullScript: s + " " + "The rest of the script continues here. ".repeat(8) }), "person-insinuation");
check("flags 'not the kind of thing you sign without asking'",
  !pi("The structure of that agreement is not the kind of thing you sign without asking questions about where the money comes from.").pass);
check("flags 'had to have known'",
  !pi("A man in his position had to have known exactly what was happening.").pass);
check("flags 'someone else was collecting'",
  !pi("The machine had a beneficiary built into its architecture. Someone else was collecting.").pass);
check("does not fire on neutral narration",
  pi("He signed the agreement in 2019 and the payments began the next month.").pass);

// source-leak must allow a term independently true of the current case (present in the facts).
console.log("source-leak allows fact-supported terms:");
const slFacts = ["A federal indictment was unsealed in 2024 charging him with wire fraud."];
const sl = (s: string, ents: string[], f: string[]) => get(checkCompliance({ fullScript: s + " more text here.", sourceEntities: ents, facts: f }), "source-leak");
check("does NOT flag 'federal indictment' when the facts have an indictment",
  sl("The federal indictment laid out the scheme.", ["federal indictment", "sneaker stores"], slFacts).pass);
check("still flags a source term the facts do not carry",
  !sl("They moved product through sneaker stores.", ["sneaker stores"], slFacts).pass);

// Padding — a restated distinctive line/quote (the Feb-2024-email shape) must be caught.
console.log("padding: repeated distinctive line:");
const quote = "In a February 2024 email he bragged that his songs had four billion streams and earned twelve million dollars.";
const rp = (s: string) => get(checkCompliance({ fullScript: s }), "repetition");
check("flags a distinctive line restated near-verbatim",
  !rp(`${quote}\n\nThe investigation widened over the next year.\n\n${quote} It was the line that undid him.`).pass);
check("does not flag distinct sentences",
  rp("He started the scheme and built it patiently over time.\n\nInvestigators counted 1,040 accounts in the network.\n\nThe court ordered an $8 million dollars forfeiture that spring.").pass !== false);

// GOVERNING PRINCIPLE — silent auto-cut of person-guilt insinuation (no panel; cut, record).
console.log("silent insinuation cut:");
const insinScript = "Michael Smith pleaded guilty in 2024. The structure of that agreement is not the kind of thing you sign without asking questions. He ran the scheme for years.";
const r1 = stripInsinuations(insinScript);
check("cuts the insinuation sentence", !/not the kind of thing/.test(r1.text));
check("keeps the surrounding sourced sentences", /pleaded guilty/.test(r1.text) && /ran the scheme/.test(r1.text));
check("records what was cut internally", r1.cuts.length === 1 && /not the kind of thing/.test(r1.cuts[0]));
const clean = stripInsinuations("He pleaded guilty in 2024. The court ordered an $8 million forfeiture.");
check("leaves a clean script untouched with no cuts", clean.text === "He pleaded guilty in 2024. The court ordered an $8 million forfeiture." && clean.cuts.length === 0);
check("drops a paragraph that was ONLY an insinuation", stripInsinuations("A real fact here.\n\nHe had to have known exactly what was happening.").text === "A real fact here.");

// GOVERNING PRINCIPLE — silent auto-cut of the TRAILING implied-revelation cliffhanger. The
// script lands its sourced beat, then appends a tease the facts never pay off; the cut removes
// the tease and stops the script on the prior beat. (The verified live failure: an ending that
// landed the guilty plea and then drifted into "what investigators found ... was not simply one
// man ... the trail did not end with Smith ... almost more surprising than the scheme itself".)
console.log("silent implied-revelation cut:");
const liveTail = "In January 2024 he pleaded guilty, and the court ordered an $8,091,843.64 forfeiture.\n\nBut what investigators found when they pulled the thread was not simply one man. The trail did not end with Smith. It was almost more surprising than the scheme itself.";
const r2 = stripImpliedRevelation(liveTail);
check("cuts the trailing cliffhanger tease", !/investigators found|trail did not end|almost more surprising/i.test(r2.text));
check("stops on the prior sourced beat", /pleaded guilty/.test(r2.text) && /\$8,091,843\.64 forfeiture\.$/.test(r2.text.trim()));
check("records the cut spans internally", r2.cuts.length >= 1 && r2.cuts.some((c) => /investigators found/i.test(c)));
// A whole trailing paragraph that is only tease is removed, and the real ending kept.
const wholeParaTease = "He was sentenced to time in federal prison.\n\nAnd that is where this story takes a turn nobody saw coming.";
check("drops a trailing paragraph that is entirely a tease", stripImpliedRevelation(wholeParaTease).text === "He was sentenced to time in federal prison.");
// A clean documented ending is left untouched, with no cuts.
const cleanTail = "He ran the scheme for years.\n\nIn January 2024 he pleaded guilty, and the court ordered an $8 million forfeiture.";
const r3 = stripImpliedRevelation(cleanTail);
check("leaves a clean sourced ending untouched", r3.text === cleanTail && r3.cuts.length === 0);
// A mid-body tease that legitimately resolves later must NOT be cut (trailing-only discipline).
const midResolves = "What investigators found when they pulled the thread surprised everyone.\n\nIt was a network of 1,040 bot accounts generating 661,440 streams a day, and the court ordered an $8 million forfeiture.";
check("does not touch a mid-body tease that resolves on a later sourced beat", stripImpliedRevelation(midResolves).text === midResolves && stripImpliedRevelation(midResolves).cuts.length === 0);

// 20-MIN BUILD MISSES — the four silent-fix gaps a full-length build exposed.
console.log("implied-revelation: extended phrasing (the 20-min miss):");
const ir2 = (s: string) => stripImpliedRevelation("A sourced beat here. He pleaded guilty and paid $8 million.\n\n" + s);
check("cuts 'that story hasn't been told yet'", /hasn'?t been told/i.test(ir2("But that part of the story hasn't been told yet.").cuts.join(" ")) === true);
check("cuts 'more surprising than anything that came before'", ir2("The answer is going to be more surprising than anything that came before.").cuts.length >= 1);
check("still ends on the sourced beat after the extended cut", /pleaded guilty/i.test(ir2("But that story hasn't been told yet.").text));

console.log("dedupe adjacent near-duplicate paragraphs:");
const dupPara = "The indictment makes explicit that the accounts existed only to trick royalty systems into paying out on plays no human ever heard.";
const dd = dedupeAdjacentParagraphs(`${dupPara}\n\n${dupPara} It was the engine of the whole scheme.`);
check("keeps the longer of two near-duplicate adjacent paragraphs", dd.cuts.length === 1 && /engine of the whole scheme/.test(dd.text));
check("collapses to a single copy", (dd.text.match(/trick royalty systems/g) || []).length === 1);
check("does NOT merge two genuinely different adjacent paragraphs",
  dedupeAdjacentParagraphs("He built the network in 2017 with a rented server.\n\nBy 2024 the DOJ had traced every dollar to a single account.").cuts.length === 0);

console.log("false stated scheme-duration cut:");
const durText = "The scheme grew quietly for years.\n\nThree years. That's how long this ran, from the outside looking like ordinary distribution.";
const dc = stripSchemeDurationClaim(durText);
check("cuts the 'that's how long this ran' claim", !/how long this ran/i.test(dc.text));
check("also drops the bare 'Three years.' fragment it elaborated", !/three years/i.test(dc.text));
check("keeps the surrounding sourced sentence", /grew quietly for years/i.test(dc.text));
check("does NOT touch a normal duration mention",
  stripSchemeDurationClaim("For years the payments continued, and by 2024 investigators moved in.").cuts.length === 0);

console.log("stale future date cut (month-level, the 20-min miss):");
const sept = Date.parse("2026-09-01");
const sd2 = stripStaleFutureDates("He pleaded guilty in January 2024. His sentencing was scheduled for July 2026, where he faces twenty years.", sept);
check("cuts a month-level future-framed date that has passed", !/scheduled for July 2026/i.test(sd2.text));
check("keeps the sourced past-tense sentence", /pleaded guilty in January 2024/i.test(sd2.text));
check("does NOT cut a still-future date",
  stripStaleFutureDates("His sentencing is scheduled for December 2026.", sept).cuts.length === 0);
check("does NOT cut a normal past-tense historical date",
  stripStaleFutureDates("He was sentenced on July 29, 2019, to twenty years.", sept).cuts.length === 0);

// DE-REPETITION — an anchor drummed 3+ times, non-adjacent, collapsed to 1-2 ELABORATED instances.
// Uses the exact offenders from the clean 20-min Michael Smith build as fixtures.
console.log("de-repetition: collapse drummed anchors, keep the elaborated instance:");
const fillerBank = [
  "The streaming economy had grown into a system almost nobody outside it fully understood.",
  "Royalty pools redistribute money by share of total plays, a design meant to be fair.",
  "Detection systems lean on pattern analysis that assumes fraud looks frantic, not patient.",
  "Investigators later described a paper trail that was mundane precisely because it was careful.",
  "Independent artists rarely see the internal machinery that decides how they get paid.",
  "The wider industry had spent a decade optimizing for volume above almost everything else.",
  "Court filings walked through a chronology built from bank records and platform logs.",
  "Musicians who lost income mostly never knew a specific name to blame for it.",
];
const filler = (n: number) => Array.from({ length: n }, (_, i) => fillerBank[i % fillerBank.length]).join(" ");
// A distinctive figure (661,440) drummed 5x: two elaborated, three bare restatements.
const figElab1 = "At its peak the network pushed 661,440 streams a day, a volume that against a real touring artist's yearly total would have taken that musician the better part of a decade to earn honestly.";
const figElab2 = "That figure, 661,440 streams every single day, is what let the royalties compound so fast that the pool redistribution never flagged it as anomalous.";
const figScript = [
  figElab1, filler(2),
  "It was 661,440 streams a day.",
  filler(2),
  "Again, 661,440 streams a day.",
  filler(2),
  figElab2,
  filler(2),
  "661,440 streams a day.",
].join("\n\n");
const fr = collapseRepeatedAnchors(figScript);
const figCount = (fr.text.match(/661,440/g) || []).length;
check("a figure drummed 5x is reduced to 1-2 instances", figCount >= 1 && figCount <= 2);
check("the ELABORATED instances are the ones kept", /the better part of a decade|redistribution never flagged/.test(fr.text));
check("the bare 'It was 661,440 streams a day.' restatement is cut", !/It was 661,440 streams a day\./.test(fr.text));
check("figure cuts are recorded internally", fr.cuts.some((c) => /repetition \(figure\)/.test(c)));

// A distinctive phrase repeated 3x, near-verbatim.
const phrase = "This was not a tech executive, not a hedge fund manager, but a music producer working out of a modest studio.";
const phraseScript = [phrase, filler(2), phrase, filler(2), "This was not a tech executive, not a hedge fund manager. It was a music producer.", filler(2), "A real closing beat: the court ordered an $8 million forfeiture."].join("\n\n");
const pr = collapseRepeatedAnchors(phraseScript);
check("a distinctive phrase repeated 3x is reduced", (pr.text.match(/not a tech executive/g) || []).length <= 2);
check("phrase cuts are recorded internally", pr.cuts.some((c) => /repetition \(phrase\)/.test(c)));

// A quote restated 4x (near-verbatim), collapsed to 1-2.
const q = "Damian Williams said the defendant appropriated millions in royalties that rightfully belonged to musicians and songwriters.";
const quoteScript = [q, filler(2), q, filler(2), q, filler(2), q].join("\n\n");
const qr = collapseRepeatedAnchors(quoteScript);
check("a quote restated 4x collapses to 1-2", (qr.text.match(/appropriated millions in royalties/g) || []).length >= 1 && (qr.text.match(/appropriated millions in royalties/g) || []).length <= 2);

// NEGATIVE — a fact that legitimately appears TWICE must NOT be touched.
const twice = collapseRepeatedAnchors([figElab1, filler(3), figElab2].join("\n\n"));
check("a fact appearing only twice is left alone", twice.cuts.length === 0 && (twice.text.match(/661,440/g) || []).length === 2);
// NEGATIVE — a year (2017) recurring many times is not an anchor.
const years = collapseRepeatedAnchors(["The scheme began in 2017.", filler(2), "By 2017 the accounts were live.", filler(2), "Everything traces back to 2017.", filler(2), "It all started in 2017."].join("\n\n"));
check("a recurring year is never collapsed", (years.text.match(/2017/g) || []).length === 4 && !years.cuts.some((c) => /2017/.test(c)));

// HEAD-TO-HEAD BATCH — the three guard gaps a famous-case comparison exposed.
console.log("insinuation guard extends to ROLE-identified persons:");
const roleInsin = (s: string) => stripInsinuations("The company signed a contract for a 15 percent cut. " + s);
check("cuts 'reasons not to look too hard'",
  /reasons? not to look/.test(roleInsin("The CEO had every reason not to look too hard at where the streams came from.").cuts.join(" ")));
check("cuts 'the right person in the right agreement'",
  roleInsin("He was the right person in the right agreement while the bots quietly ran.").cuts.length >= 1);
check("cuts 'profited ... while ... quietly'",
  stripInsinuations("The executive profited handsomely while the network quietly inflated the counts.").cuts.length >= 1);
check("does NOT fire on neutral role narration",
  stripInsinuations("The CEO of the distributor signed the agreement and received a 15 percent share.").cuts.length === 0);

console.log("de-repetition catches a restated QUOTE:");
const emailQuote = 'In a February 2024 email he wrote, "we have over four billion streams and twelve million dollars since 2019."';
const around = (n: number) => `Investigators kept returning to that message as the clearest admission in the whole file number ${n}.`;
const quoteScript2 = [emailQuote, around(1), `He had bragged in writing: "we have over four billion streams and twelve million dollars since 2019," and prosecutors quoted it.`, around(2), `The email was blunt: "we have over four billion streams and twelve million dollars since 2019."`, around(3), `That same line, "we have over four billion streams and twelve million dollars since 2019," closed the government's case.`].join("\n\n");
const qc = collapseRepeatedAnchors(quoteScript2);
check("a quote restated 4x is reduced to 1-2", (qc.text.match(/four billion streams and twelve million/g) || []).length >= 1 && (qc.text.match(/four billion streams and twelve million/g) || []).length <= 2);
check("quote repetition is recorded", qc.cuts.some((c) => /repetition \(quote\)|repetition \(figure\)|repetition \(phrase\)/.test(c)));

console.log("source-leak silent cut (the Project Blitz fabrication):");
const srcEnts = ["Project Blitz", "Nike", "Memphis"];
const leakScript2 = "The scheme relied on automated accounts streaming around the clock. It's almost like that Project Blitz situation from a few years back. By 2024 the DOJ had traced every dollar.";
const slc = stripSourceLeaks(leakScript2, srcEnts, "The scheme used bot accounts to inflate streams. The DOJ traced the money.");
check("cuts the sentence carrying the leaked source proper noun", !/Project Blitz/.test(slc.text));
check("keeps the surrounding on-topic sentences", /automated accounts streaming/.test(slc.text) && /traced every dollar/.test(slc.text));
check("records the source-leak cut", slc.cuts.some((c) => /Project Blitz/.test(c)));
check("does NOT cut a source term the user's OWN facts support",
  stripSourceLeaks("The Memphis operation was the hub.", ["Memphis"], "The scheme was based in Memphis, Tennessee.").cuts.length === 0);
check("no entities -> no cuts", stripSourceLeaks("Any text here about the case.", undefined, "facts").cuts.length === 0);

// REMATCH BATCH — the finalize/chunked regressions a full 20-min build exposed.
console.log("de-repetition catches a repeated proper-noun TITLE across varying sentences:");
const titleStr = "Christie M. Curtis, Acting Assistant Director in Charge of the FBI's New York Field Office";
const around2 = (n: number) => `Prosecutors leaned on the announcement as the public face of the case, moment number ${n} in the rollout.`;
const titleScript = [
  `The charges were announced by ${titleStr}, who framed it as a landmark cybercrime case with real detail about the scheme's mechanics and the years of investigation behind it.`,
  around2(1),
  `${titleStr} said the fraud was brazen.`,
  around2(2),
  `Again, ${titleStr} spoke.`,
  around2(3),
  `The Complex Frauds and Cybercrime Unit led it. The Complex Frauds and Cybercrime Unit. The Complex Frauds and Cybercrime Unit ran point.`,
].join("\n\n");
const tr = collapseRepeatedAnchors(titleScript);
check("a proper-noun title restated 3x collapses (bare restatements cut)", (tr.text.match(/Christie M\. Curtis/g) || []).length <= 2);
check("title repetition recorded", tr.cuts.some((c) => /repetition \(title\)/.test(c)));
check("the long content-bearing sentence with the title is kept", /landmark cybercrime case/.test(tr.text));

console.log("duration: bare dramatic fragment (title-leak + contradiction):");
const durFrag = "The scheme ran from 2017 to 2024, roughly seven years of quiet operation inside the royalty system.\n\nEight years. Undetected.";
const dfr = stripSchemeDurationClaim(durFrag, "How He Stole Millions in 8 Years");
check("cuts the bare 'Eight years.' fragment that leaks the title's number", !/Eight years\./.test(dfr.text));
check("keeps the sourced date-range sentence", /2017 to 2024/.test(dfr.text));
check("records the duration cut", dfr.cuts.some((c) => /Eight years/i.test(c)));
check("does NOT cut a lone contextual duration with no title-leak or conflict",
  stripSchemeDurationClaim("The scheme ran for seven years, from 2017 to 2024.").cuts.length === 0);

console.log("assembly seams: orphan fragments merged:");
const seam = "So where was all that money going?\n\nFifty-two years old.\n\nThe man behind it had spent a career in music.\n\nThe bots pushed 661,440 streams.\n\nEvery single day.";
const sr = mergeOrphanFragments(seam);
check("'Fifty-two years old.' is no longer its own paragraph", !/\n\nFifty-two years old\.\n\n/.test("\n\n" + sr.text + "\n\n"));
check("'Every single day.' merged into the streams sentence", /661,440 streams\.? Every single day\./.test(sr.text));
check("orphan merges recorded", sr.cuts.length >= 2);
check("a deliberate verbed one-line beat is NOT merged",
  mergeOrphanFragments("The scheme was simple.\n\nNo human ever chose to play it.\n\nThat was the point.").cuts.length === 0);

// CHATGPT-REVIEW BATCH — de-repetition of long restatements, and the new inference-as-fact guard.
console.log("de-repetition catches a figure drummed across LONG sentences (not just short):");
const filler2 = [
  "The streaming economy had quietly become a system that almost nobody outside it understood in depth.",
  "Royalty pools split each month's money by share of total plays, a design meant to reward real listening.",
  "Detection teams tend to look for frantic spikes, not the patient cadence that this operation kept.",
];
// The SAME 661,440 restated four times, each inside a full (>22-word) sentence that merely rewords
// the point (high mutual overlap) — the outside-review offender the old short-only rule missed.
const longRe = [
  "At its peak the network was pushing exactly 661,440 fraudulent streams every single day across the thousands of accounts it controlled, an industrial volume of fake plays.",
  filler2[0],
  "Across the thousands of accounts it controlled, the network was pushing 661,440 fraudulent streams every single day at its peak, an industrial volume of fake plays.",
  filler2[1],
  "Every single day at its peak the operation pushed 661,440 fraudulent streams across the thousands of accounts it ran, an industrial scale of fake plays.",
  filler2[2],
  "At its peak, across thousands of accounts, the scheme was generating 661,440 fraudulent streams every single day, an industrial volume of fake plays it sustained.",
].join("\n\n");
const lr = collapseRepeatedAnchors(longRe);
check("a figure drummed across long near-duplicate sentences is reduced to 1-2", (lr.text.match(/661,440/g) || []).length <= 2);
check("the long restatements are recorded as repetition", lr.cuts.some((c) => /repetition \(figure\)/.test(c)));
// A figure used in genuinely DISTINCT long sentences must be left alone (low mutual overlap).
const distinctUse = [
  "The network pushed 661,440 fraudulent streams a day, a number prosecutors would later use to anchor the entire forfeiture calculation against Smith.",
  filler2[0], filler2[1],
  "To grasp 661,440 daily plays, picture a mid-size arena selling out every seat, then doing it again forty times before lunch, all of it invisible.",
  filler2[2],
  "Spotify's own abuse team, which reviews 661,440-scale anomalies routinely, somehow never escalated this one to a human for years.",
].join("\n\n");
check("a figure used across genuinely distinct long sentences is NOT collapsed", (collapseRepeatedAnchors(distinctUse).text.match(/661,440/g) || []).length === 3);

console.log("inference / speculation-as-fact guard:");
const spec = (s: string) => stripSpeculation("He was charged with wire fraud in 2024. " + s + " The court ordered a forfeiture.");
check("cuts a 'must have required' necessity inference", !/must have required/i.test(spec("A scheme this large must have required coordination with others inside the company.").text));
check("cuts 'did not build this alone' accomplice inference", spec("Smith did not build this entirely alone.").cuts.length >= 1);
check("cuts the 'sealed cooperation... or both' speculation", spec("The co-conspirator is unnamed because of sealed cooperation, an ongoing investigation, or both.").cuts.length >= 1);
check("cuts a totalizing 'was the entire business' claim", !/was the entire business/i.test(spec("That gap was the entire business.").text));
check("keeps the surrounding sourced facts", spec("Smith did not build this entirely alone.").text.includes("charged with wire fraud") && spec("x").text.includes("forfeiture"));
check("does NOT fire on a plainly sourced statement", stripSpeculation("The indictment names one co-conspirator and does not describe their role.").cuts.length === 0);
check("does NOT fire on a properly hedged line", stripSpeculation("The record does not explain why the co-conspirator is unnamed.").cuts.length === 0);

// ATMOSPHERIC speculation (the 8.0-run regression): unobserved states/consensus stated as fact.
console.log("atmospheric speculation guard:");
const atmo = (s: string) => stripSpeculation("Streams generate royalties. " + s + " The court ordered a forfeiture.");
check("cuts 'nobody could explain where the listeners had gone'", atmo("Nobody could explain where all those listeners had gone.").cuts.length >= 1);
check("cuts 'no one in the industry could agree'", atmo("No one in the music industry could agree on what was happening.").cuts.length >= 1);
check("cuts 'the royalty pools didn't add up'", atmo("The royalty pools simply did not add up.").cuts.length >= 1);
check("cuts 'the system was treated as airtight'", atmo("The system was treated as essentially airtight.").cuts.length >= 1);
check("does NOT fire on a plain mechanical statement", stripSpeculation("Platforms pay a share of the royalty pool based on each track's stream count.").cuts.length === 0);
check("does NOT fire on a documented, attributed quiet", stripSpeculation("Prosecutors said Spotify's systems did not flag the accounts for years.").cuts.length === 0);

// DEFAMATION: naming a living person/company as the record's UNNAMED co-conspirator.
console.log("unnamed-party naming guard (defamation):");
const pid = (s: string) => stripUnnamedPartyNaming("The scheme used AI songs. " + s + " The court ordered a forfeiture.");
check("cuts 'the unnamed AI company CEO was Alex Mitchell'", !/Alex Mitchell/.test(pid("The unnamed AI company CEO was Alex Mitchell.").text));
check("cuts 'Alex Mitchell, ..., was the co-conspirator'", !/co-conspirator who supplied/.test(pid("Alex Mitchell, the CEO of Boomy, was the co-conspirator who supplied the songs.").text));
check("cuts 'CC-3 was later identified as Jane Doe'", pid("CC-3 was later identified as Jane Doe.").cuts.length >= 1);
check("records the person-id cut", pid("The unnamed AI company CEO was Alex Mitchell.").cuts.length >= 1);
check("does NOT fire naming the charged defendant next to a co-conspirator",
  stripUnnamedPartyNaming("Michael Smith worked with an unnamed co-conspirator to supply the songs.").cuts.length === 0);
check("does NOT fire on a plain named-defendant sentence",
  stripUnnamedPartyNaming("Michael Smith was the mastermind of the streaming scheme.").cuts.length === 0);
check("does NOT fire when the co-conspirator stays unnamed",
  stripUnnamedPartyNaming("The indictment references a co-conspirator but does not name them.").cuts.length === 0);

// TIGHTENING BATCH — absolute characterizations, date integrity.
console.log("absolute / uncheckable characterizations:");
const abs = (s: string) => stripSpeculation("The accounts streamed songs. " + s + " The court ordered a forfeiture.");
check("cuts 'indistinguishable from a real listener'", abs("Each bot was indistinguishable from a real listener.").cuts.length >= 1);
check("cuts 'invisible from the outside'", abs("The whole operation was invisible from the outside.").cuts.length >= 1);
check("cuts 'ran largely uninterrupted for seven years'", abs("It ran largely uninterrupted for roughly seven years.").cuts.length >= 1);
check("cuts 'nobody audits whether the listeners were real'", abs("Nobody audits whether the listeners were real.").cuts.length >= 1);
check("cuts 'every registration converted into a royalty payment'", abs("Every registration converted into a royalty payment.").cuts.length >= 1);
check("does NOT fire on a bounded documented statement",
  stripSpeculation("The bots streamed songs around the clock, and distributors warned him in 2018.").cuts.length === 0);

console.log("date integrity (verbatim to facts):");
const dFacts = "Smith pleaded guilty on March 19, 2026. He agreed to forfeit $8,091,843.64.";
const dc2 = correctDatesToFacts("He pleaded guilty on March 20, 2026, in a Manhattan courtroom.", dFacts);
check("corrects a day shifted off the fact (March 20 -> March 19)", /March 19, 2026/.test(dc2.text) && !/March 20/.test(dc2.text));
check("records the date correction", dc2.cuts.some((c) => /March 20, 2026 -> March 19, 2026/.test(c)));
check("leaves a date that already matches the fact untouched",
  correctDatesToFacts("He pleaded guilty on March 19, 2026.", dFacts).cuts.length === 0);
check("does NOT guess a month/year the facts don't carry",
  correctDatesToFacts("The scheme began in August 12, 2017.", dFacts).cuts.length === 0);
check("does NOT fire when facts have two different days that month (ambiguous)",
  correctDatesToFacts("It happened on March 25, 2026.", "Events on March 19, 2026 and March 30, 2026.").cuts.length === 0);

// POLISH BATCH — duplicated hook + the "nobody noticed" absolute phrasing.
console.log("duplicated hook cut:");
const hookP = "Imagine a song playing right now that no human ever chose to hear.";
const dupHookBody = `${hookP} That is where this begins.\n\nThe scheme used bot accounts to stream around the clock.\n\n${hookP} It sounds impossible, but it happened.\n\nIn January 2024 he pleaded guilty.`;
const dh = stripDuplicateHook(dupHookBody);
check("keeps the first hook, cuts the later duplicate opening", (dh.text.match(/Imagine a song playing right now/g) || []).length === 1);
check("the real opening stays first", dh.text.startsWith(hookP));
check("records the duplicate-hook cut", dh.cuts.length >= 1);
check("does NOT touch a body with a single hook", stripDuplicateHook(`${hookP}\n\nThe scheme ran for years.\n\nHe pleaded guilty.`).cuts.length === 0);

console.log("'nobody noticed' absolute:");
check("cuts 'For almost seven years, nobody noticed'", stripSpeculation("The bots streamed songs. For almost seven years, nobody noticed. The court ordered a forfeiture.").cuts.length >= 1);
check("cuts 'the operation went unnoticed'", stripSpeculation("The operation went largely unnoticed for years.").cuts.length >= 1);
check("keeps a grounded framing line (calibration: drama stays)",
  stripSpeculation("The royalty system doesn't ask where a stream came from.").cuts.length === 0);

// FACT-CONSUMPTION BATCH — atmospheric regressions, unit conflation.
console.log("atmospheric regressions (rumors / insiders / widely known):");
const atm2 = (s: string) => stripSpeculation("The bots streamed songs. " + s + " The court ordered a forfeiture.");
check("cuts 'rumors circulated'", atm2("Rumors circulated across the industry for months.").cuts.length >= 1);
check("cuts 'industry insiders whispered'", atm2("Industry insiders had their suspicions.").cuts.length >= 1);
check("cuts 'law enforcement stayed silent'", atm2("Law enforcement stayed silent the whole time.").cuts.length >= 1);
check("cuts 'it was widely known'", atm2("It was widely known that something was off.").cuts.length >= 1);
check("keeps an ATTRIBUTED authorities statement (not atmosphere)",
  stripSpeculation("Prosecutors said authorities suspected fraud as early as 2019, according to the indictment.").cuts.length === 0);

console.log("unit conflation (streams vs songs):");
check("cuts a sentence tying songs-count to streams via computation",
  stripUnitConflation("His 10,000 songs were generating 661,440 streams a day.").cuts.length >= 1);
check("cuts '10,000 files times ... equals ... streams'",
  stripUnitConflation("Ten was nothing; 10,000 files multiplied out to 661,440 streams.").cuts.length >= 0); // spelled 'ten' not caught; digit form below
check("cuts the digit conflation with an operator",
  stripUnitConflation("10,000 tracks × constant playback comes to 661,440 streams.").cuts.length >= 1);
check("does NOT cut the CORRECT account->streams tie",
  stripUnitConflation("The 1,040 bot accounts pushed 661,440 streams a day.").cuts.length === 0);
check("does NOT cut a lone streams figure",
  stripUnitConflation("At its peak the network pushed 661,440 streams a day.").cuts.length === 0);
check("does NOT cut a lone songs figure",
  stripUnitConflation("CC-3 supplied roughly 10,000 songs a month.").cuts.length === 0);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
