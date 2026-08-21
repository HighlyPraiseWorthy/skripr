// Offline test for the mid-sentence paragraph-break repair. Run:
//   node --experimental-strip-types --loader ./scripts/alias-loader.mjs scripts/format-repair.test.ts
import { healMidSentenceBreaks, restampHook, hookIsVague, hookDumpsPayoff, endingTeasesWithoutLanding, isUsableRewrite, chooseRewrite, repeatedOpeners } from "../src/lib/ai/claude.ts";

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

// Move #9 fix #2 — deterministic DETECTION (conservative: under-fire) and the two GUARDS.
console.log("hook/callback detection (conservative):");
check("flags the vague windup opener", hookIsVague("For seven years, something was quietly draining millions from the pool."));
check("flags 'few noticed at first'", hookIsVague("Few people noticed at first."));
check("flags the Run-2 slip 'something strange was moving'", hookIsVague("Something strange was moving through Spotify's servers."));
check("does NOT flag a concrete paradox hook", !hookIsVague("A song no human has ever chosen to play is streaming right now, over and over."));
check("does NOT flag a cold-scene hook", !hookIsVague("In a Miami warehouse, 1,040 phones lit up at once."));
check("ending tease without landing fires", endingTeasesWithoutLanding("But what happened to the people who assembled it is more consequential than the conviction itself."));
check("ending that lands on a real fact does NOT fire", !endingTeasesWithoutLanding("In January 2024 he pleaded guilty, and the court ordered an $8,091,843 forfeiture."));

console.log("rewrite GUARDS (deterministic):");
// Guard (a): a passing hook is never sent to the rewriter — detection returns false.
check("a good hook is not detected as vague (so no rewrite is attempted)", hookIsVague("A song no one ever chose to play is streaming right now.") === false);
// Guard (b): fallback to original on any unusable rewrite.
check("empty rewrite falls back to the original", chooseRewrite("original hook here", "") === "original hook here");
check("whitespace rewrite falls back to the original", chooseRewrite("original hook here", "   \n ") === "original hook here");
check("a refusal falls back to the original", chooseRewrite("original hook here", "I can't help with that request.") === "original hook here");
check("an oversized rewrite falls back to the original", chooseRewrite("original hook here", "word ".repeat(80)) === "original hook here");
check("a good rewrite is used", chooseRewrite("original hook here", "A song no one ever chose to play is streaming right now.") === "A song no one ever chose to play is streaming right now.");
check("isUsableRewrite rejects empty/refusal/oversized, accepts a good line",
  !isUsableRewrite("") && !isUsableRewrite("Sorry, I cannot.") && !isUsableRewrite("x ".repeat(90)) && isUsableRewrite("A stark concrete image opens the video."));

// Move #9 fix #2 refinements — withholding hook, extended callback detection, anaphora.
console.log("withholding hook detection:");
check("flags a fact-dump hook (bots + $10M in the opening)",
  hookDumpsPayoff("Ten thousand bot accounts streamed his music and he collected more than $10 million."));
check("flags a hook that names the mechanism (AI fraud)",
  hookDumpsPayoff("This was an AI streaming fraud scheme run through a shell company."));
check("does NOT flag a withholding paradox hook",
  hookDumpsPayoff("A song no human ever chose to hear is playing right now. It has millions of streams and not one fan.") === false);
check("a fact-dump hook triggers a rewrite (vague-or-dump)",
  hookIsVague("Ten thousand bot accounts...") || hookDumpsPayoff("Ten thousand bot accounts streamed his music and he collected $10 million."));
check("extended callback detection catches the 'takes a turn the documents don't explain' tease",
  endingTeasesWithoutLanding("And that is where this case takes a direction the charging documents don't explain."));

console.log("anaphora guard:");
const anaParas = [
  "The story starts in 2017.",
  "Ten thousand accounts. That number comes directly from the indictment, and it is the spine of the case.",
  "The detection systems were blind to it for years.",
  "Ten thousand accounts. That number comes directly from the indictment, and it is worth sitting with.",
];
check("detects a repeated section-opening figure/line", repeatedOpeners(anaParas).includes(3));
check("does not flag distinct openers", repeatedOpeners(["First, the setup here.", "Second, the mechanism.", "Third, the fallout."]).length === 0);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
