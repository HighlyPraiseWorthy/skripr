// CHECKLIST TEST for the chunked-generation refactor. The whole safety story of chunking is:
// when the section loop moves to the client, every silent-fix + safety pass must still run in
// finalizeScript on the ASSEMBLED whole script — if the split drops one, the guarantee breaks
// with no visible sign. This asserts each pass actually ran on an assembled body.
//   node --experimental-strip-types --loader ./scripts/alias-loader.mjs scripts/finalize.test.ts
//
// Inputs are crafted so NO LLM call fires (fully offline): no voiceProfile (voice pass skipped),
// a clean withholding hook (hook-rewrite guard false), a trailing tease that trips the
// deterministic cut but NOT endingTeasesWithoutLanding (the LLM ending-rewrite is skipped), and
// no repeated section-openers (anaphora rewrite skipped). Only the deterministic passes run.
import { finalizeScript, hookIsVague, hookDumpsPayoff, endingTeasesWithoutLanding, parseFactList, factIsUsed } from "../src/lib/ai/claude.ts";

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) { failures++; console.log("  ✗ " + name); } else { console.log("  ✓ " + name); }
}

// A withholding hook with no mechanism/money words and no vague windup — so the hook-rewrite
// guard stays false and no LLM call is made.
const HOOK = "For a while, the strangest part was how ordinary it all looked.";

// Assembled body (as if the client looped the sections and joined them). It deliberately carries:
//  - the hook as its opening (the re-stamp should keep it, first line intact)
//  - a stock narrator tic that must be stripped
//  - a person-guilt insinuation sentence that must be cut
//  - a mid-sentence paragraph break (after "U.S.") that format-repair must heal
//  - a real sourced closing beat, THEN a trailing cliffhanger paragraph that must be cut
const BODY = [
  `${HOOK} The building was plain, the paperwork was dull, and nobody looked twice at either.`,
  "Let that sink in.",
  "The payments moved on a schedule, quarter after quarter, exactly as the contract laid out. This is not the kind of thing you sign without asking questions about where the money comes from. On paper it was routine.",
  "By 2019 the arrangement had spread across the U.S.\n\nDepartment filings from that year describe the same pattern in three more states.",
  "In January 2024 he pleaded guilty, and the court ordered an $8,091,843.64 forfeiture.",
  "But the trail did not end with him. It was almost more surprising than the scheme itself.",
].join("\n\n");

// Guard sanity — confirm the offline assumptions hold, so a failure here explains a hang.
check("hook does not trip the vague-hook guard", !hookIsVague(HOOK));
check("hook does not dump the payoff", !hookDumpsPayoff(HOOK));
check("trailing tease does NOT trip the LLM ending-rewrite (deterministic cut handles it)",
  !endingTeasesWithoutLanding("But the trail did not end with him. It was almost more surprising than the scheme itself."));

const script: any = {
  title: "A quiet arrangement",
  hook: HOOK,
  fullScript: BODY, script: BODY, body: BODY, content: BODY,
  sections: [
    { title: "Open", content: `${HOOK} The building was plain, the paperwork was dull, and nobody looked twice at either.\n\nLet that sink in.` },
    { title: "Mechanism", content: "The payments moved on a schedule, quarter after quarter, exactly as the contract laid out. This is not the kind of thing you sign without asking questions about where the money comes from. On paper it was routine." },
    { title: "Close", content: "In January 2024 he pleaded guilty, and the court ordered an $8,091,843.64 forfeiture.\n\nBut the trail did not end with him. It was almost more surprising than the scheme itself." },
  ],
  sectionwise: true,
};

const input: any = { targetTopic: "a streaming scheme", targetNiche: "true crime" }; // no voiceProfile => no LLM

console.log("finalize runs every tail pass on the assembled script:");
const out: any = await finalizeScript(script, input, { startedAt: Date.now(), presetHook: HOOK });
const finalBody: string = out.fullScript || out.script || out.body || out.content || "";

// 1) HOOK RE-STAMP — the body still opens on the hook verbatim, hook field intact.
check("hook re-stamp: body opens with the hook", finalBody.trim().startsWith(HOOK));
check("hook re-stamp: hook field preserved", out.hook.trim() === HOOK);

// 2) TIC STRIP — the stock narrator tic is gone.
check("tic strip: 'Let that sink in' removed", !/let that sink in/i.test(finalBody));

// 3) FORMAT REPAIR — the mid-sentence break after 'U.S.' is healed (no paragraph split there).
check("format repair: mid-sentence break after 'U.S.' healed", /U\.S\.\s+Department/.test(finalBody));

// 4) INSINUATION SILENT CUT — the person-guilt sentence is gone, surrounding facts kept.
check("insinuation cut: 'not the kind of thing you sign' removed", !/not the kind of thing you sign/i.test(finalBody));
check("insinuation cut: surrounding sourced sentence kept", /payments moved on a schedule/i.test(finalBody));

// 5) TRAILING CLIFFHANGER SILENT CUT — the tease is gone; the script ends on the sourced beat.
check("cliffhanger cut: 'the trail did not end' removed", !/the trail did not end/i.test(finalBody));
check("cliffhanger cut: 'almost more surprising' removed", !/almost more surprising/i.test(finalBody));
check("cliffhanger cut: ends on the forfeiture beat", /\$8,091,843\.64 forfeiture\.?$/.test(finalBody.trim()));

// 6) _autoCuts INTERNAL RECORD — populated with BOTH the insinuation and the cliffhanger spans.
check("_autoCuts recorded", Array.isArray(out._autoCuts) && out._autoCuts.length >= 2);
check("_autoCuts names the insinuation", (out._autoCuts || []).some((c: string) => /not the kind of thing you sign/i.test(c)));
check("_autoCuts names the cliffhanger", (out._autoCuts || []).some((c: string) => /trail did not end|almost more surprising/i.test(c)));

// 7) The passes ran on the SECTIONS too (the last section's ending is cleaned; tic gone in sec 0).
const secLast: string = out.sections[out.sections.length - 1].content;
check("sections: trailing cliffhanger cut from the final section", !/the trail did not end/i.test(secLast));
check("sections: tic stripped from the opening section", !/let that sink in/i.test(out.sections[0].content));

// The four 20-min-build misses must be fixed IN finalize (wired, not just unit-tested), on the
// assembled body. A second assembled script exercising all four, still fully offline.
console.log("finalize applies the 20-min-build fixes on the assembled body:");
const dupPara = "The indictment makes explicit that the accounts existed only to trick royalty systems into paying on plays no human ever heard.";
const BODY2 = [
  `${HOOK} It looked like ordinary music distribution.`,
  dupPara,
  `${dupPara} That was the engine of the whole scheme.`,
  "Three years. That's how long this ran, or so the title would have you believe.",
  "His sentencing was scheduled for July 2026, where he faced twenty years.",
  "In January 2024 he pleaded guilty and the court ordered an $8,091,843.64 forfeiture.",
  "But the real story hasn't been told yet, and the answer is going to be more surprising than anything that came before.",
].join("\n\n");
const script2: any = {
  title: "3 Years of a quiet scheme", hook: HOOK,
  fullScript: BODY2, script: BODY2, body: BODY2, content: BODY2,
  sections: [{ title: "All", content: BODY2 }],
  sectionwise: true,
};
const out2: any = await finalizeScript(script2, { targetTopic: "a streaming scheme", targetNiche: "true crime" } as any, { startedAt: Date.now(), presetHook: HOOK });
const b2: string = out2.fullScript || "";
check("dedupe: the near-duplicate adjacent paragraph is collapsed to one", (b2.match(/trick royalty systems/g) || []).length === 1);
check("duration: the false 'that's how long this ran' claim is cut", !/how long this ran/i.test(b2));
check("stale-date: the past July 2026 sentencing sentence is cut", !/scheduled for July 2026/i.test(b2));
check("extended cliffhanger: 'hasn't been told yet / more surprising than anything' is cut", !/hasn'?t been told yet/i.test(b2) && !/more surprising than anything/i.test(b2));
check("ends on the sourced forfeiture beat", /\$8,091,843\.64 forfeiture\.?$/.test(b2.trim()));
check("_autoCuts tags the new fixes", (out2._autoCuts || []).some((c: string) => /^dedupe:/.test(c)) && (out2._autoCuts || []).some((c: string) => /^duration:/.test(c)) && (out2._autoCuts || []).some((c: string) => /^stale-date:/.test(c)));

// DE-REPETITION must run in finalize on the assembled body: an anchor drummed 4x collapses to the
// elaborated instances, bare restatements cut, recorded as repetition:. Fully offline.
console.log("finalize collapses a drummed anchor on the assembled body:");
const distinct = [
  "The streaming economy had grown into something few outsiders understood in any depth.",
  "Royalty pools split money by share of total plays, a design that assumes honest listening.",
  "Detection tools look for frantic spikes, not the patient, boring cadence this scheme kept.",
  "Independent musicians almost never see the machinery that decides what they are paid.",
];
const figE1 = "At its peak the operation pushed 661,440 streams a day, a number that against a working artist's real yearly total represents years of honest listening manufactured in a single afternoon.";
const figE2 = "That same 661,440 streams a day is why the royalty pool redistributed so much so quietly that no automated audit ever marked it as strange.";
const BODY3 = [
  `${HOOK} It began as ordinary distribution.`,
  figE1, distinct[0],
  "It was 661,440 streams a day.", distinct[1],
  "Again: 661,440 streams a day.", distinct[2],
  figE2, distinct[3],
  "In January 2024 he pleaded guilty and the court ordered an $8,091,843.64 forfeiture.",
].join("\n\n");
const script3: any = { title: "The quiet pipeline", hook: HOOK, fullScript: BODY3, script: BODY3, body: BODY3, content: BODY3, sections: [{ title: "All", content: BODY3 }], sectionwise: true };
const out3: any = await finalizeScript(script3, { targetTopic: "a streaming scheme", targetNiche: "true crime" } as any, { startedAt: Date.now(), presetHook: HOOK });
const b3: string = out3.fullScript || "";
const n3 = (b3.match(/661,440/g) || []).length;
check("drummed figure collapsed to 1-2 instances in finalize", n3 >= 1 && n3 <= 2);
check("the elaborated instances survive", /single afternoon|no automated audit ever marked/.test(b3));
check("a bare restatement is cut", !/It was 661,440 streams a day\./.test(b3) || !/Again: 661,440 streams a day\./.test(b3));
check("_autoCuts tags the repetition fix", (out3._autoCuts || []).some((c: string) => /^repetition/.test(c)));
check("the sourced closing beat is untouched", /\$8,091,843\.64 forfeiture/.test(b3));

// SOURCE-LEAK + ROLE-INSINUATION must run in finalize on the assembled body.
console.log("finalize cuts a source-leak and a role-based insinuation:");
const BODY4 = [
  `${HOOK} It looked like ordinary distribution.`,
  "The accounts streamed around the clock to inflate the counts.",
  "It's almost like that Project Blitz situation from the sneaker world.",
  "The CEO of the unnamed distributor had every reason not to look too hard at the numbers.",
  "In January 2024 he pleaded guilty and the court ordered an $8 million forfeiture.",
].join("\n\n");
const script4: any = { title: "Quiet distribution", hook: HOOK, fullScript: BODY4, script: BODY4, body: BODY4, content: BODY4, sections: [{ title: "All", content: BODY4 }], sectionwise: true };
const out4: any = await finalizeScript(
  script4,
  { targetTopic: "a streaming scheme", targetNiche: "true crime", sourceEntities: ["Project Blitz", "Nike"], sourceMaterial: "The scheme used bot accounts to inflate streams. The DOJ traced the money and won a forfeiture." } as any,
  { startedAt: Date.now(), presetHook: HOOK },
);
const b4: string = out4.fullScript || "";
check("source-leak: 'Project Blitz' sentence is cut", !/Project Blitz/.test(b4));
check("role-insinuation: 'reason not to look too hard' is cut", !/reason not to look too hard/i.test(b4));
check("the on-topic + sourced sentences survive", /streamed around the clock/.test(b4) && /\$8 million forfeiture/.test(b4));
check("_autoCuts tags source-leak", (out4._autoCuts || []).some((c: string) => /^source-leak:/.test(c)));

// REMATCH regressions must be fixed IN finalize on the assembled body: repeated title collapsed,
// orphan fragments merged, the title-leaked bare duration cut. Fully offline.
console.log("finalize fixes the chunked regressions on the assembled body:");
const title5 = "How He Stole Millions in 8 Years";
const BODY5 = [
  `${HOOK} It began as ordinary distribution.`,
  "Fifty-two years old.",
  "The man behind it had spent a quiet career in music before any of this.",
  "The charges were announced by the Complex Frauds and Cybercrime Unit, which laid out years of evidence and the full mechanics of the fraud in detail.",
  "The Complex Frauds and Cybercrime Unit. The Complex Frauds and Cybercrime Unit ran point on it.",
  "The scheme ran from 2017 to 2024, roughly seven years inside the royalty system.",
  "Eight years. Undetected.",
  "In January 2024 he pleaded guilty and the court ordered an $8 million forfeiture.",
].join("\n\n");
const script5: any = { title: title5, hook: HOOK, fullScript: BODY5, script: BODY5, body: BODY5, content: BODY5, sections: [{ title: "All", content: BODY5 }], sectionwise: true };
const out5: any = await finalizeScript(script5, { targetTopic: "a streaming scheme", targetNiche: "true crime" } as any, { startedAt: Date.now(), presetHook: HOOK });
const b5: string = out5.fullScript || "";
check("seam: 'Fifty-two years old.' is no longer a standalone paragraph", !/\n\nFifty-two years old\.\n\n/.test("\n\n" + b5 + "\n\n"));
check("duration: the title-leaked 'Eight years.' is cut", !/Eight years\./.test(b5));
check("duration: the sourced date range survives", /2017 to 2024/.test(b5));
check("de-repetition: the bare 'Complex Frauds and Cybercrime Unit.' restatements are reduced", (b5.match(/Complex Frauds and Cybercrime Unit/g) || []).length <= 2);
check("the sourced closing beat is intact", /\$8 million forfeiture/.test(b5));

// UTILIZATION: the unused-fact detection that drives the fact-aware length expansion. A bug here
// (marking every fact "used") would silently disable the fix, so lock the deterministic core.
console.log("unused-fact detection (drives fact-aware expansion):");
const factsBlob = [
  "- In a February 2024 email he boasted of 4 billion streams and $12 million since 2019 (source: justice.gov)",
  "- CC-3 supplied roughly 10,000 files per month to the operation.",
  "- Smith transferred about $1.3 million to an entity called SMH Entertainment.",
  "- The scheme relied on 1,040 bot accounts.",
].join("\n");
const parsed = parseFactList(factsBlob);
check("parseFactList strips bullets and source tags", parsed.length === 4 && !/source:/i.test(parsed[0]) && !/^-/.test(parsed[0]));
// A body that used only the headline bot count -> the other three read as UNUSED.
const bodyUsedOne = "the operation ran on 1,040 bot accounts streaming around the clock.".toLowerCase();
check("the used headline fact reads as used", factIsUsed(parsed[3], bodyUsedOne) === true);
check("an unused quoted-email fact reads as unused", factIsUsed(parsed[0], bodyUsedOne) === false);
check("an unused named-entity fact ($1.3M / SMH Entertainment) reads as unused", factIsUsed(parsed[2], bodyUsedOne) === false);
check("an unused figure fact (10,000 files) reads as unused", factIsUsed(parsed[1], bodyUsedOne) === false);
// Once the body incorporates them, they read as used (so the expander stops).
const bodyUsedAll = ("he boasted of 4 billion streams and $12 million. cc-3 supplied 10,000 files per month. he moved $1.3 million to smh entertainment. 1,040 bot accounts ran it.").toLowerCase();
check("a fact becomes used once the body walks it", factIsUsed(parsed[0], bodyUsedAll) && factIsUsed(parsed[2], bodyUsedAll));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
