// Offline test for the mid-sentence paragraph-break repair. Run:
//   node --experimental-strip-types --loader ./scripts/alias-loader.mjs scripts/format-repair.test.ts
import { healMidSentenceBreaks, restampHook } from "../src/lib/ai/claude.ts";

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) { failures++; console.log("  ✗ " + name); } else { console.log("  ✓ " + name); }
}

console.log("healMidSentenceBreaks:");

// The exact bug from the Queen script.
const bug = "He started as a North Carolina police officer. After that, U.S.\n\nBorder Patrol. The path was practical.";
const fixed = healMidSentenceBreaks(bug);
check("rejoins the U.S. / Border Patrol split", fixed.includes("U.S. Border Patrol"));
check("removes the stray blank line", !/U\.S\.\n\n/.test(fixed));

// Other abbreviations.
check("rejoins after Mr.", healMidSentenceBreaks("She met Mr.\n\nQueen later.").includes("Mr. Queen"));
check("rejoins after a lone initial", healMidSentenceBreaks("His name was J.\n\nEdgar Hoover.").includes("J. Edgar"));

// A torn clause with no terminal punctuation.
check("rejoins a torn clause continuing lowercase", healMidSentenceBreaks("He rode the Harley\n\nand never looked back.").includes("Harley and never"));

// Must NOT damage legitimate paragraph breaks.
const good = "He complied. He kept his cover.\n\nThink about what that decision cost.";
check("leaves a real paragraph break intact", healMidSentenceBreaks(good) === good);
const goodQuote = "Tiny said: 'You could have been my brother.'\n\nIf this story got you, subscribe.";
check("leaves a break after a quote intact", healMidSentenceBreaks(goodQuote) === goodQuote);
const goodQuestion = "Was he a cop?\n\nThe gun came down.";
check("leaves a break after a question intact", healMidSentenceBreaks(goodQuestion) === goodQuestion);

// HOOK RE-STAMP — the body must OPEN on the hook verbatim after every pass.
console.log("hook re-stamp:");
const hook = "You a cop? The gun is already at his head.";
check("replaces a paraphrased opening with the hook verbatim",
  restampHook("Was he a cop? A gun was pointed at him. The rest of the story follows.", hook)
    === "You a cop? The gun is already at his head. The rest of the story follows.");
check("is a no-op when the body already opens on the hook",
  restampHook(hook + " And then it got worse.", hook) === hook + " And then it got worse.");
check("keeps the body's later paragraphs intact",
  restampHook("Totally different opener here. Second sentence.\n\nA whole second paragraph.", "Real hook line.")
    === "Real hook line. Second sentence.\n\nA whole second paragraph.");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
