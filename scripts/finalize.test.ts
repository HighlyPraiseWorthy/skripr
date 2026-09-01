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
import { finalizeScript, hookIsVague, hookDumpsPayoff, endingTeasesWithoutLanding } from "../src/lib/ai/claude.ts";

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

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
