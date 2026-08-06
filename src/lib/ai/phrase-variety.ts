// Phrase variety for script generation.
//
// WHY THIS EXISTS: the old approach banned the obvious clichés ("Here's the
// thing", "Let that sink in") and replaced them with a FIXED menu of ~9
// alternatives per slot, injected identically into every generation, under the
// instruction "use these SLOT ALTERNATIVES". Two things went wrong:
//
//   1. Telling a model to pick from a list makes it pick from the list. The
//      replacements became the new tic, one level up from the clichés they
//      replaced.
//   2. Models do not sample a list evenly. They favor the first few entries, so
//      across many scripts a channel converged on the same handful of lines
//      ("the part nobody talks about", "the real story is simpler than you
//      think", "what actually happens is").
//
// Reader feedback on a batch of finished scripts flagged exactly those phrases,
// which is how the fixed menu was traced as the cause.
//
// WHAT CHANGED:
//   - Pools are much larger (roughly 15 to 20 per slot instead of 9) and vary in
//     grammatical shape (imperatives, fragments, questions, declaratives), since
//     repeated SENTENCE CONSTRUCTION is its own tell even when the words differ.
//   - Each generation sees a small RANDOM SAMPLE, so consecutive scripts are not
//     calibrated against the same lines.
//   - The framing changed from "use these" to "this is the register, write your
//     own", which is the part that actually stops the copying.
//   - No em dashes anywhere. The old phrases ended in them ("That single habit
//     determines—") while a separate rule banned em dashes, so the post-process
//     de-dasher converted them to a trailing comma and shipped broken grammar.
//   - Phrases already burnt by overuse were retired into the banned list.

// Openers that became recognizable tics in shipped scripts. Retired, not
// recycled: once an audience can predict a line, it stops doing work.
const RETIRED = [
  "The real story",
  "The real story is simpler than you think",
  "The part nobody talks about",
  "Nobody talks about",
  "What actually happens is",
  "Here's what actually happened",
  "The official story",
  "What most people miss is",
  "The data tells a different story",
];

const BANNED = [
  "Here's the thing", "But here's the thing", "Here's the deal", "Here's what's crazy",
  "Wait until you see this", "You won't believe what happens next",
  "And that's where it gets interesting", "Now here's where it gets good",
  "The truth is", "The reality is", "At the end of the day",
  "Think about it", "Let that sink in", "That's right", "You heard that correctly",
  "Mind-blowing", "Game-changer", "This changes everything", "This is huge",
  "Stick around", "Stay with me", "Bear with me", "Trust me on this one",
];

// Metaphors that recurred often enough across scripts to read as a signature.
// Reach for a fresh image instead of these.
const OVERUSED_METAPHORS = ["machine", "lever", "architecture", "costume", "blueprint", "playbook"];

type Slot = { name: string; when: string; pool: string[] };

const SLOTS: Slot[] = [
  {
    name: "PIVOT INTO THE REAL SUBJECT",
    when: "turning from the setup to what the video is actually about",
    pool: [
      "That is not what the record shows.",
      "The order of events matters more than it sounds.",
      "Start with who benefited.",
      "There is a detail everyone skips.",
      "The paperwork says otherwise.",
      "It began somewhere else entirely.",
      "One assumption is doing all the work here.",
      "The timeline does not line up.",
      "Look at what changed first.",
      "The answer sits one layer down.",
      "Two things happened at once, and only one got reported.",
      "Ask who wrote the rule.",
      "The cause is older than the problem.",
      "Something else was already in motion.",
      "The explanation is boring, and that is why it worked.",
      "Nobody planned it. That is the unsettling part.",
      "Strip out the language and it is simpler than that.",
      "Follow it back far enough and it stops making sense.",
    ],
  },
  {
    name: "RAISE THE TENSION",
    when: "escalating from one beat to a bigger one",
    pool: [
      "It gets worse.",
      "That was the small version.",
      "Then the numbers moved.",
      "This is where it stops being an accident.",
      "That was before anyone was watching.",
      "And then it scaled.",
      "The next decision is the one that mattered.",
      "Hold onto that number.",
      "It did not stay contained.",
      "That is where the incentives take over.",
      "The pressure had nowhere to go.",
      "Give it a decade.",
      "The same choice got made again, bigger.",
      "Nothing about that was reversible.",
      "It compounds from here.",
      "What came next was avoidable.",
      "That is the point where the floor gives out.",
    ],
  },
  {
    name: "COUNTERINTUITIVE REVEAL",
    when: "overturning what the viewer assumed",
    pool: [
      "The opposite happened.",
      "Flip the question.",
      "That logic has a hole in it.",
      "Most people have the arrow pointing the wrong way.",
      "It works, just not for the reason given.",
      "The correlation runs backwards.",
      "Being right did not help.",
      "The fix caused it.",
      "It was designed to do this.",
      "Success was the problem.",
      "The cheaper option won, and it was worse.",
      "Doing nothing would have been better.",
      "That assumption breaks under its own weight.",
      "The intended effect never arrived. Something else did.",
      "It is not broken. This is the output.",
      "The measure became the target.",
      "Everyone involved was behaving rationally.",
    ],
  },
  {
    name: "INTRODUCE AN EXAMPLE",
    when: "grounding an abstract point in a specific case",
    pool: [
      "Take [X].",
      "[X] is the clean version of this.",
      "Look at what happened in [X].",
      "In [X], the same thing played out faster.",
      "[X] tried it first.",
      "Consider [X].",
      "[X] found this out the hard way.",
      "One example makes it concrete. [X].",
      "This already ran as an experiment in [X].",
      "[X] is where you can watch it happen in real time.",
      "The [X] version is smaller and easier to see.",
      "Put [X] next to it.",
      "[X] is the exception that proves the rule.",
      "There is a case for this. [X].",
    ],
  },
  {
    name: "CONSEQUENCE AND STAKES",
    when: "showing what it costs and who pays",
    pool: [
      "Here is the cost.",
      "That lands on someone.",
      "Multiply it out.",
      "Over a decade that is a different country.",
      "The bill comes later, and not to them.",
      "That gap does not close on its own.",
      "It shows up in the next generation.",
      "The people who pay for this never voted on it.",
      "That is a small number until you scale it.",
      "The damage is quiet, which is why it continues.",
      "It costs you something you cannot see.",
      "Every year it runs, it gets harder to undo.",
      "Nobody loses their job over this. That is part of it.",
      "Someone absorbs that, and it is not the people who chose it.",
    ],
  },
  {
    name: "PIVOT TO THE SOLUTION",
    when: "turning from diagnosis to what would actually work",
    pool: [
      "The fix is smaller than the problem.",
      "One change moves most of it.",
      "The answer is not more of the same.",
      "Start upstream.",
      "Change what gets counted.",
      "Fix the incentive and the behavior follows.",
      "Remove the reward and it stops.",
      "It requires giving something up.",
      "The cheap version of this actually works.",
      "Nobody has to invent anything new here.",
      "The solution exists. It is just unpopular.",
      "Stop measuring it and it loses its power.",
      "Undo the thing that started it.",
    ],
  },
  {
    name: "PROOF AND CREDIBILITY",
    when: "citing evidence, only for evidence that is genuinely in the source material",
    pool: [
      "The research agrees on this much:",
      "This has been studied repeatedly.",
      "The pattern repeats across countries.",
      "Independent studies land in the same place.",
      "The data is not ambiguous here.",
      "Even the people who built it say so.",
      "The people closest to it have been saying this for years.",
      "It is not a fringe position anymore.",
      "The numbers are public.",
      "Two separate reviews reached the same conclusion.",
      "Nobody seriously disputes this part.",
    ],
  },
  {
    name: "CALL TO ACTION",
    when: "asking the viewer to do one thing",
    pool: [
      "Try one piece of this.",
      "Start with the smallest version.",
      "You can test this this week.",
      "Pick the part you can do today.",
      "One change is enough to start.",
      "Do the easy one first.",
      "You do not need permission for this part.",
    ],
  },
  {
    name: "CLOSE",
    when: "landing the ending",
    pool: [
      "That is the whole picture.",
      "Now you know where to look.",
      "The pattern is the useful part.",
      "You will notice it everywhere now.",
      "That is how it actually works.",
      "The next time this comes up, you will recognize it.",
      "Once you can see it, it is hard to stop seeing it.",
    ],
  },
];

function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

/**
 * Build the per-generation variety block. Call this fresh for every request:
 * the randomized sample is the whole point, so a cached or hoisted result
 * reintroduces the fixed-menu problem this module exists to solve.
 *
 * @param perSlot how many calibration examples to show per slot (default 5)
 */
export function buildVarietyBlock(perSlot = 5): string {
  const slotLines = SLOTS.map((s) => {
    // Show at most a third of a pool, so a SMALL pool still rotates meaningfully
    // instead of showing nearly all of it every time (the CTA and close pools are
    // naturally narrower than the mid-script ones). Floor of 3 keeps enough
    // signal to calibrate the register.
    const cap = Math.max(3, Math.min(perSlot, Math.ceil(s.pool.length / 3)));
    const shown = sample(s.pool, cap);
    return `${s.name} (${s.when}):\n${shown.map((p) => `  ${p}`).join("\n")}`;
  }).join("\n\n");

  return `VARIETY AND FRESH PHRASING (critical)

NEVER use any of these worn-out phrases:
${BANNED.map((b) => `"${b}"`).join(", ")}.

Also retired, because they have been used too often already and now read as a formula:
${RETIRED.map((b) => `"${b}"`).join(", ")}.

Do NOT lean on these metaphors, they have become a signature: ${OVERUSED_METAPHORS.join(", ")}. Invent a fresh image instead.

HOW TO HANDLE TRANSITIONS: below are examples of the REGISTER to write in at each moment of a script, grouped by the job the line does. They are calibration, NOT a menu. Your default is to write your OWN line that fits this specific script, its subject, and its voice. Reach for one of these examples only when you cannot write something better. A transition that could be dropped into any video on any topic is a weak transition: the best ones name something concrete from THIS story.

${slotLines}

Vary the GRAMMAR of your transitions, not just the words. If one is a short declarative, make the next an imperative, a question, or a fragment. Never reuse a transition inside a single script, and never open two sections the same way.`;
}
