# Research-quality spec — the "zero-edit" reframe

Status: moves #1–#3 SHIPPED TO PRODUCTION and live-proven on Michael Smith (2026-08-16). Move #5 (honest length) open.

## The bar

**The angle page must be publishable with zero edits by someone who knows nothing about the case.**

Test it that way: generate for a case you know cold, then count how many corrections a naive
user would need. For Michael Smith (Spotify streaming fraud) this session it was four
(wrong case suggested, `$10M` superseded number, stale age `52`, missing mechanism). Target: zero.

## Root cause (one sentence)

**The pipeline gathers, but never adjudicates.** It has no step that ranks candidates by
authority, no step that supersedes stale facts, and no step that notices a hole. Every
failure this session is a missing adjudication step. The shipped checks (claim, padding,
source-leak, stale-date) all run *after* bad facts exist — you cannot check your way to
good research.

## The four failure points (mapped to code)

### 1. Wrong case on the confirm card — `resolveSubjects` (src/lib/research.ts:378)
- Resolution is a **single `claude-sonnet-4-6` call at temperature 0, from training memory
  only** — no web search, no verification, no ranking (deliberate; see comment at research.ts:382).
- **"Best match first" is literally Claude's output order.** `normalizeCandidates`
  (research.ts:186) only truncates/dedupes/slices to 4; it never re-ranks by authority.
  Nothing asks "which candidate has DOJ / major-outlet coverage," so Michael Smith losing
  to a Chilean musician (Ferreira) has nothing behind it to catch the miss.
- **The living-person / company guard does not run here at all** — so DistroKid-in-a-fraud-headline
  and an unnamed private individual reach the confirm card unflagged.
- Ruled out: saturation does **not** feed the candidate list. `case-saturation.ts` is fetched
  separately in the confirm-screen effect, *after* candidates exist, purely as decoration.

### 2. Superseded `$10M` / stale age survive — `reviewDeepenedFacts` (src/lib/research.ts:688)
- This is the only reconciliation-ish pass. It classifies each fact `keep/drop/conflict/temporal`
  but **"conflict" only flags for the user to resolve; it never supersedes.** No authority or
  recency ranking, so nothing knows "$8M forfeiture supersedes $10M alleged" or "age from a
  2-year-old indictment is stale." The "editor who knows the case" role is empty.
- **Accumulation makes it permanent.** Once a number enters the cache
  (`getCachedFactSet` short-circuit, research.ts:873) or the per-user library
  (`addToLibrary`, union-only, never removes), it is *preferred* on every later run and never
  replaced. The accumulate fix and reconciliation are two halves of one change; the dangerous
  half shipped first (see Safety gate below).

### 3. Generic "thousands of bots," missing `661,440` — `deepenCaseFacts` (src/lib/research.ts:775)
- The question generator asks for motive, access, aftermath, quotes, a vivid scene — but
  **never specifically demands the quantified mechanism.**
- `length-drives-research` (the extra-rounds loop) triggers on fact-**count** vs word-count,
  so a case with "enough" vague facts for the runtime never digs for the real numbers.
  **The trigger is wrong:** it should fire on "thin, conflicting, *or* a mechanism section with
  no numbers" — not only on long videos.

## Sequence

0. **Safety gate — SHIPPED.** `CACHE_TTL_MS` (20h) in `src/lib/case-cache.ts`: a stale cached
   set can no longer short-circuit fresh research (`getCachedFactSet`) or dominate the union
   (`getBestAcrossVersions`), so the pipeline re-checks the web at least daily and the current
   number is fetched and present alongside the stale one. **Scope limit:** this bounds the
   CACHE only. The per-user LIBRARY (`topic_fact_library`) still union-accumulates; its shed is
   move #2. Until then a superseded number can still ride in the library union — but it now
   coexists with the fresh number rather than replacing it silently.

1. **Canonical resolution + authority ranking + living-person guard — SHIPPED.**
   `rankAndGuardCandidates` (src/lib/research.ts): after Claude names candidates, one Perplexity
   pass **ranks the existing candidates** by authoritative coverage (DOJ/court/major-outlet =
   high) so the DOJ-documented case sorts to the top; runs the living-person/company guard at
   suggestion time; can prepend a confidently-canonical case Claude omitted. Confirm card shows
   a ◆/△ authority badge + ⚠ guard line. Perplexity-absent or error → candidates untouched (no
   regression). **Rank, don't re-run** — one call over ≤4 candidates, not a re-research.
   PROVEN live: Michael Smith surfaced on top with the ◆ badge instead of a hallucinated
   "Manuel Ferreira" case.

2. **Reconciliation / supersession pass — SHIPPED.** `reconcileFacts` (src/lib/research.ts)
   runs over the facts about to be returned — including the LIBRARY set — and drops the loser
   of a genuine supersession ($8M forfeiture beats $10M allegation; current age beats an
   indictment-era age), preserving temporal pairs. Adjudicates the held facts; no new web
   calls. Applied at both the cache-hit and fresh return paths, so a superseded number never
   reaches the angle page even if the library accumulated it earlier. Folded in the
   **in-voice attribution** texture: `attributionFor` maps an authoritative source to a named
   ACTOR ("the DOJ", "the court", "The New York Times") and the generator is nudged to
   attribute to that actor — never to the machinery ("the record"), which the voice rules ban.
   The safety-gate TTL can relax once a live run confirms supersession fires; left in place
   until then.

3. **Generic-section self-detection → targeted retrieval — SHIPPED.** `mechanismIsGeneric`
   (src/lib/research.ts) detects a "how" that names the machinery but carries no numbers
   ("thousands of bot accounts"); when true, a targeted dig fetches the specific quantities
   FIRST ("how many bots, at what rate") before anything else. Separately, the depth loop's
   **trigger was fixed**: it now runs on "thin (below a MIN_FACTS floor OR below the length
   target) OR conflicting," not only on long videos — so a case with enough vague facts for
   the runtime still digs. Same caps as before (≤2 extra rounds, 60s guard, stop-early on no
   new facts) to respect retrieval gravity. New facts from the dig are then adjudicated by
   move #2 before return.

4. Existing checks (claim, padding, source-leak, stale-date) stay as the safety net behind all that.

## Status: moves #1–#3 shipped to production and PROVEN

Live click-through on Michael Smith (2026-08-16, `vercel --prod` → skripr.app) confirmed three
of the four corrections happen with zero human intervention:
- **#1 right case** — Michael Smith surfaced on top with the ◆ Well documented badge. PASS.
- **#2 $10M→$8M** — angle page shows the $8,091,843.64 forfeiture; $10M appears nowhere. PASS.
- **#4 mechanism** — auto-dug "~1,040 bot accounts, 661,440 streams/day, $1,207,128/year"
  without the user pasting it. PASS.
- **#3 stale age** — age 52 remained, but reframed "when he was charged" (accurate: he was 52
  when charged in 2024), so left as-is. Known limit: `reconcileFacts` supersession only fires
  on a conflicting PAIR; a lone stale fact with no fresher counterpart passes through. Deemed
  acceptable given the framing.

The cache-TTL safety gate can now relax (supersession confirmed firing), at the team's
discretion.

## Move #5 — honest length (SHIPPED to branch; live result PENDING)

Built in `src/lib/research.ts` + the deepen route + the viral-brief confirm/angle step:
- **(a) Per-minute budget.** `FACTS_PER_MINUTE = 2.5`, `factBudgetForMinutes(min)` → ~25 facts
  for 10 min, 50 for 20 (capped at `MAX_FACTS = 60`, floored at 6). The old client formula
  (`min(12, minutes*150/180)`) is gone; the client now sends `targetMinutes` and the server
  derives the budget. The deepen fact cap was raised from a flat 12 to `factCap` (budget-aware).
- **(b) Research-to-budget.** The depth loop now targets the budget, not a flat 12 (same ≤2
  rounds / 60s / stop-early guards).
- **(c) Contextual-fact expansion.** When the core case is tapped but the budget is unmet, a
  capped context loop fetches real surrounding context (how the system works, how detection
  works, prior cases), marks it `context: true`, and runs it through `reconcileFacts` (#2) like
  any other fact. Never padding — sourced, adjudicated, honest minutes.
- **(d) Honesty ceiling.** `DeepenResult` now carries `factCount / honestMinutes /
  requestedMinutes / budget / contextCount`. When even with context the facts support less than
  ~85% of the ask, the confirm/angle step shows: "This case honestly supports about N minutes,
  not M … padding is where invented facts come from," with a one-click "Set the target to N
  minutes." Mirrors the existing "angles suppressed" honesty line. The message IS the feature.

`tsc`-clean; new pure-helper tests (`factBudgetForMinutes`, `honestMinutes`) green.

**Live result: PROVEN on preview (both bugs fixed).** Michael Smith / Spotify at 20 min: the
ceiling fired ("supports about 7 minutes, not 20"; 17 facts ≈ 7 min), it did NOT pad, and after
the Bug 1 fix the "Set the target to 7 minutes" button re-targets, rebuilds the angle page at 7,
and clears the ceiling. Bug 1 (`4354c91`): the button updated only `brief.targetMinutes` while
the ceiling reads `honesty.requestedMinutes`, so it was a dead click; now it re-targets both and
rebuilds via `fetchAngles` with the existing facts (no re-deepen). Promotion to production pending
a `vercel --prod` (ships the whole working tree, not move #5 in isolation).

Known follow-up → **move #6 (fact consistency)**: run-to-run retrieval variance means the
known-best facts (the $8,091,843.64 forfeiture, the 1,040-bots/661,440-streams mechanism) are not
reliably re-surfaced. See the move #6 section below.

### Original write-up (for reference)

Answer to "enough facts for any 10–20 min script." **Do NOT build "guarantee enough facts for
20 min"** — forcing length onto thin evidence reintroduces the exact padding/fabrication the
checks were built to catch. Length is an OUTPUT of the evidence, not an input. Build "honest
length" instead:

a) **Per-minute fact budget.** ~2–3 load-bearing facts per narrated minute (name, number,
   date, turn of events, quote). So 10 min ≈ 25–30 facts, 15 min ≈ ~40, 20 min ≈ 50–60.
   Make the budget explicit and per-minute; wire move #4's `targetFacts` to it.

b) **Research-to-budget** — already built in #4/#3 (dig until budget met; ≤2 rounds, 60s guard,
   stop-early on no new facts). Point the target at the per-minute budget.

c) **Contextual-fact expansion.** When the CORE case is tapped out but the budget isn't met,
   don't pad — fetch real surrounding context (how the royalty system works, how bot detection
   normally operates, prior similar cases, why "first of its kind"). Sourceable, adds honest
   minutes, adjudicated by #2 like any other fact. Mark it as context, not case fact.

d) **Honesty ceiling.** If even with context the case can't fill the target, tell the user the
   real supportable length ("this case honestly supports ~12 min; 20 means padding") and let
   them choose shorter-but-solid or a richer case. Same behavior as the existing
   "2 angles suppressed — not enough sourced material to build them honestly" line, applied to
   length. **This message IS the feature.**

One-line rule: never force length onto thin evidence — fill with more real facts (case, then
context), and when you can't, tell the truth about the supportable length. Test: ask the
Michael Smith case for 20 minutes and see whether it pads or says "this supports ~12."

## Move #7 — verbatim quote hunting (SHIPPED to branch; live result PENDING)

Built:
- **Deepen brief (v3).** The quote target is now the HIGHEST-value ask, with 2 dedicated
  questions actively hunting primary-source lines by TYPE: the subject's own words (email/post/
  interview), plea/courtroom statements, indictment language, and named-official statements —
  each returned with its speaker and source. `RESEARCH_BRIEF_VERSION` bumped 2→3 so cached cases
  re-derive with quote hunting.
- **Quotes are pinned.** `isHighValueFact` now flags a verbatim quote, so move #6's `capFacts`
  keeps it and the honest-length math counts it like any other fact.
- **Quote grounding check.** New `quote-grounding` compliance check: a verbatim quotation in the
  script must trace to a sourced quote in the facts, else it is flagged as invented/paraphrased.
- **Generation.** A "quote then analyze" nudge (reusing move #2 `attributionFor`) tells the
  writer to drop a real sourced quote, attribute it to the speaker, then interpret it — never
  invent or paraphrase into quotation marks.

`tsc`-clean; new tests (`isHighValueFact` quote case, `quote-grounding`) green. Live proof
PENDING: the Michael Smith case should surface ≥1 real quoted primary-source line (his own email,
the plea, or the U.S. Attorney's statement) with a source, and the honest-length number should
rise vs the current ~13 min because real quotable material was added. No fabricated quotes.

### Original write-up (for reference)

Source of the idea: three reference scripts Anton flagged as the quality bar (a Miami-influencer
true-crime piece, a Carl Jung explainer, and Brew's "How 1 Man Ruined Airports"). A shared reason
they read as authoritative is **reproduced primary-source quotes, then analysis** — e.g. a
defendant's own courtroom words, a subject's own email/post, an official's statement — quoted
verbatim and immediately interpreted.

Add **"pull direct quotes / primary-source lines" as an explicit research target** in the deepen
question set (`deepenCaseFacts`), alongside the mechanism/quantity targets. The pipeline should
actively retrieve quotable primary-source lines (court statements, indictment language, the
subject's own words, named-official statements) and carry them as facts with their source, so the
generator can drop a real quote and analyze it. Same discipline as everything else: only real,
sourced quotes — never fabricated or paraphrased-into-quotes. Michael Smith example: his own
February 2024 email boast is exactly this kind of quotable primary line.

(Deferred / not building now: "certainty-labeling as a first-class texture" — grading
allegedly/unconfirmed/one-outlet by source tier. The pieces exist via move #2 attribution; left
out of scope per Anton.)

## Move #8 — length through craft + context (SHIPPED to branch; live result PENDING)

Built:
- **(1) Two-tier, craft-credited length.** The research budget still gathers generously at ~2.5
  facts/min (case + context), but the honest-length math now credits storytelling craft at
  `HONEST_FACTS_PER_MINUTE = 1.6`, so the ceiling counts context facts AND the fact that a skilled
  writer stretches each fact into scene/stakes/mechanism. `honestMinutes` divides by 1.6, not 2.5,
  so the ceiling is a last resort instead of a tripwire.
- **(2) Aggressive contextual research** (heavy upgrade of #5c). When the core case is tapped, up
  to 3 time-guarded rounds gather real sourced context across six categories: how the system
  works, history/precedent (prior similar cases), the broader moment, stakes/impact, detection/
  regulation, and what makes it a first. Marked `context: true`, adjudicated by #2.
- **(3) Storytelling craft in generation (the core).** A new `5b` prompt block tells the writer to
  reach length by rendering each fact as a scene with stakes, explaining the mechanism patiently,
  using the context facts as connective tissue, building a controlling thesis, and running the
  retention playbook (open loop in 30s, escalation, one section carries the weight, ending
  callback) — with a hard line: expand a sourced fact = required; invent a new case fact or quote
  = forbidden (the claim/quote-grounding/source-leak checks stay as the net).
- **(4) Ceiling = last resort** — emergent from (1)+(2): for a well-documented case at 20 min it
  should no longer fire.
- **Follow-ups folded in:** the grounded-on-title path already surfaces the honest-length ceiling
  (`groundAndAngles` sets the honesty state); and `findResearch` now ALWAYS runs `resolveSubjects`
  and prefers Claude's deterministic `kind` over Perplexity's flapping live-search classification.

`tsc`-clean; honest-length tests updated for the 1.6 rate; all six suites green. Live proof
PENDING: Michael Smith at 20 min must reach ~20 min via facts + real context + craft, read like
the reference scripts (scene/stakes/thesis, not a flat list), and stay clean on the claim + quote
+ source-leak checks. Benchmark vs ChatGPT: match length/engagement, beat on accuracy.

### Original write-up (for reference)

**The correction:** earlier framing ("length is an output of the evidence; take the honest
9 minutes") drew the line in the wrong place. It conflated **padding** (repeating a fact,
inventing a fact) with **storytelling craft** and **real sourced context** — which are NOT
padding and are exactly how honest long-form reaches 20+ minutes. The honest-length ceiling
currently counts only CASE-facts, so it is far too pessimistic: it says "22 facts = 9 minutes"
for Michael Smith, when a skilled writer (or ChatGPT) reaches 20 minutes on the same facts
without fabricating anything.

**Proof it's achievable:** the three reference scripts Anton flagged as the quality bar — a
Miami-influencer true-crime piece, a Carl Jung explainer, and Brew's "How 1 Man Ruined Airports"
(30+ min). Each is built on a MODEST core of real facts and reaches full length through (a)
storytelling craft — scene, tension, stakes, patient mechanism explanation, a controlling
thesis, open loops, escalation, callbacks — and (b) real sourced CONTEXT (how PETN works, the
security-theater history, industry implications). Most of the airports runtime is craft +
context, not case facts. The viewer stays AND learns something. **That is the target: take
researched facts and tell them as a story that holds retention and teaches.**

**The line, hardened:**
- ✅ ALLOWED and REQUIRED: storytelling craft (expand a fact into narrative/scene/stakes) +
  real sourced context (royalty-pool mechanics, how fraud detection works, prior cases like the
  Bulgarian playlist fraud, the AI-music moment, artist impact).
- ❌ BANNED: fabricating case facts, fake quotes, invented specifics (the ungrounded-angles bug).
  The distinction: **expansion** adds narrative/framing/explanation AROUND a sourced fact;
  **invention** adds a new unsourced fact. Claim check / quote-grounding / source-leak enforce
  the invention boundary and stay as the net.

**Four parts to build:**
1. **Two-tier fact budget — case-facts + context-facts.** A 20-min target is not ~50 case facts;
   it's ~22 case facts + ~25–30 real sourced CONTEXT facts. The honest-length math counts both.
   The ceiling only fires when case + context + craft genuinely cannot reach the target — which,
   for a well-documented case, should almost never happen at 20 min.
2. **Aggressive contextual research (upgrade move #5c).** Actively gather substantial real
   background WITH sources: how the system works, history/precedent, the broader moment,
   stakes/impact. Marked `context: true`, adjudicated by #2, sourced like every other fact. Much
   heavier than #5c does today.
3. **Storytelling expansion in generation (the core).** The writer must render each fact as
   narrative — scene, tension, patient causal mechanism, stakes, a thesis, open loops,
   escalation, callbacks (the retention playbook the reference scripts use) — WITHOUT inventing
   case facts. The existing framework-fidelity checks (open-loop-in-30s, ending-callback,
   escalation, one-section-carries-weight) already target this; wire them to DRIVE the writing,
   not merely grade it after.
4. **Ceiling becomes a true last resort.** Fires only when facts + real context + craft can't
   honestly fill the target (a genuinely obscure subject), not when case-facts alone fall short.

**Bar update:** the bar is no longer only "publishable with zero edits" (accuracy). It's ALSO
"engaging and informative — the viewer stays and learns something" (retention). Both: accurate
AND engaging. A tight-but-flat 9-minute recitation fails the second bar; a padded/fabricated
20-minute script fails the first. The target hits both.

**Test:** build Michael Smith / Spotify at 20 min. Expected: (a) reaches ~20 min honestly via
case facts + real sourced context + craft; (b) reads like the reference scripts — story format,
mechanism explained vividly, stakes, a thesis — not a flat fact list; (c) zero fabricated case
facts / fake quotes (claim + quote-grounding clean). Benchmark: match what ChatGPT produces on
the same topic for length and engagement, and BEAT it on accuracy (ChatGPT slips in unsourced
elaboration; Skripr must not).

## Move #8 — first live read (10-min Michael Smith build) + three follow-ups

First real script read (built at 10-12 min because the 20-min build times out — see follow-up 1).
**The good:** Move #8 craft works — the script tells a real story with sourced context (royalty-pool
explanation woven in), a controlling thesis ("no lock was cut… he read the rules more carefully
than the system expected"), patient mechanism, escalation. Prose is tighter than ChatGPT's. And
the accuracy moat is visible: benchmarked ChatGPT invented a named co-conspirator ("Jonathan Hay")
and a likely-fabricated U.S. Attorney quote from memory; Skripr invented no names, every fact
traced to a source. That edge is the product.

**Three follow-ups before Move #8 beats ChatGPT:**
1. **20-min generation timeout (blocker).** The heavier Move #8 generation drops the connection
   ("connection dropped while generating") on a 20-min build, reproducibly. Fix: chunked /
   section-by-section streaming generation so no single request runs past the function time limit
   (raising `maxDuration` alone won't scale as scripts grow). Until fixed, no length parity with
   ChatGPT.
2. **Enforce the retention scaffolding in generation, not just grade it.** The 10-min script scored
   framework-fidelity 2/5 — missing (a) an open loop in the first 30 seconds (the hook stated facts
   instead of teasing-then-jumping) and (b) an ending callback. ChatGPT nailed both. The
   open-loop-in-30s and ending-callback checks must DRIVE the writer (hook must defer a payoff;
   ending must return to a cold-open thread) and the callback must close on a REAL sourced fact
   (the $8M forfeiture / guilty plea), not a teased phantom.
3. **NEW guardrail: craft may not imply facts not in evidence.** The script ended on
   "what investigators found when they traced where the remaining money actually went was not what
   anyone following this case had expected to find" — an unresolved cliffhanger implying a hidden
   money-trail revelation that does NOT exist in the facts (the $60k-vs-$8M gap is mundane: $60k is
   Spotify's slice, $8M is all-platform). No individual sentence is unsourced, so the claim check
   passed it — the INVENTED thing is the narrative implication. Add a check: a teased loop /
   "investigators found X" / "was not what anyone expected" framing must resolve on a sourced fact
   or not be opened. This is the risk Move #8's storytelling expansion introduces — invented
   *narrative*, not invented *facts*.

Also recurring: the "seven years" count flag (rule: give 2017–2024, never state a count) still
trips; the body should state the span, never the number.

## Move #9 — match structure, exceed on hook/callback/climax craft (SHIPPED to branch; live PENDING)

Built (items 1–3 of the consolidated sequence; #1 timeout stays last):
- **Move #9 best-practice checks.** The fidelity panel now holds `early-loop` (open loop in 30s)
  and `callback` (ending callback) to BEST PRACTICE, not source parity: for those two it drops the
  `SOURCE ✗` marker and the "the source doesn't do this either, may not be worth chasing" line, and
  shows a `BEST PRACTICE` tag + "worth writing even if the source skipped them." The hook prompt
  already demands an open loop that defers the payoff (tease-then-jump), and `5b` stages the peak.
  Match the source's skeleton, write better muscle.
- **#4 duration HARD replacement.** `stripComputedDurations` (claude.ts) runs last in generation and
  overwrites a computed span with the sourced date range — but ONLY when the count equals the span
  between the earliest and latest year the text states (so "ran for seven years" with 2017+2024 →
  "from 2017 to 2024", while "five years in prison" is left alone). First hit → full range, later
  hits → "since START". Prompt-only had failed 5×; this is deterministic like the hook re-stamp.
- **Context DEPTH.** The Move #8 context loop is deeper: 8 distinct, specific categories (system
  mechanics, NAMED prior cases, detection tech, named victims + losses, the full LE/regulatory
  response, the broader trend, where the money went, expert commentary) and up to 4 time-guarded
  rounds — so the writer gets genuinely NEW sourced material instead of restating five numbers.
- **#1 20-min timeout** stays LAST (scoped in the follow-ups section): request-splitting, only once
  context depth means there is enough distinct material to fill 20 min honestly.

`tsc`-clean; new `stripComputedDurations` tests green; all six suites green. Live proof PENDING:
the ~11-min Michael Smith build should now open on a deferred-payoff hook, end on a real callback
(forfeiture/plea), say "2017 to 2024" not "seven years", and recycle fewer numbers because the
context research brought more distinct facts.

### Original write-up (for reference)

**The problem, exact:** the framework-fidelity checks grade Skripr against the SOURCE video's
structure, and for the hook/callback they say "SOURCE ✗ — the source video doesn't do this
either, so it may not be worth chasing." That caps Skripr's hook quality at the source's ceiling.
The Nike source has a flat hook → Skripr writes a flat hook → the check tells the writer not to
improve it. This is why the benchmarked ChatGPT script felt more engaging: ChatGPT wasn't
handcuffed to a source's mediocre hook, it just wrote the best cold-open it could ("Imagine
opening Spotify and discovering one of the biggest artists in the world… except there is no
superstar").

**The principle refined:** "copy structure, not content" still holds for MOST of the remix, but
split it:
- **Structure + pacing = copy the source** (section count, running order, peak placement, peak
  length, escalation rhythm). This is the proven part; keep matching it.
- **High-craft moments — hook, ending callback, climax staging = best-in-class, NOT source-
  parity.** No reason to cap the highest-leverage retention beats at whatever the source did.
  One line: **match the source's skeleton, write better muscle.**

**What changes:**
1. The **open-loop-in-30s and ending-callback checks become always-on best-practice targets** —
   drop the "source didn't do it, so skip it" deprioritization FOR THESE TWO. A hook must open a
   loop; an ending must call back — regardless of the source. (This subsumes the reopened Move #8
   follow-up #2: those two checks were still failing; this is the fix.)
2. The **hook generator aims for a cold-open that defers the payoff** — tease the mystery and jump
   away BEFORE resolving it, instead of the current "here's the mystery, here's the answer two
   sentences later" (the 11-min build resolved its hook with "The charge was fraud. The mechanism
   was arithmetic" immediately).
3. **Keep everything else source-matched** — don't lose the proven pacing/structure.

Contained prompt-and-check change (no heavy refactor) → sequence HIGH, most visible engagement gain.

### Sharper framing (after reading the actual source, "After 5 Years Nike Finally Caught Them")

The source's hook is NOT flat — it's a strong open loop with a real callback. Its cold open leads
on the RAIDS ("12 charged, $2M stolen, Cool Kicks raided on livestream"), then "nobody knew why…
law enforcement stayed silent… then the indictment gave answers," and it lands the ending on a
concrete object: "the answer was sitting on the box the whole time — a shipping label."

The critical insight: **the source's hook works because it resolves a spectacle the audience
personally witnessed** (sneakerheads SAW the Cool Kicks livestream raid). "You watched this happen
and nobody explained it — here's the explanation." Michael Smith has NO equivalent witnessed
spectacle. So when Skripr copies the source's hook *treatment* ("something was quietly happening…
silence… then the indictment"), it falls flat — the emotional engine (resolve-a-thing-you-saw)
has nothing to grab. That is *why* Skripr's hook is weak: it's faithfully matching a device that
cannot fire on this case.

**So Move #9 is not "write a better hook" — it's "select the best hook DEVICE for THIS case's own
facts, don't transplant the source's."** Menu of devices: resolve-a-witnessed-spectacle (Nike),
paradox (Smith), cold-scene-drop (Brew's date-stamped openings), ticking clock, etc. For Smith the
right device is the **paradox** — "billions of streams, zero real fans" — which is exactly what the
benchmarked ChatGPT used AND which is **already in Skripr's own researched facts**: its paragraph 2
literally says "royalty payments flowing into accounts attached to songs that had no listeners, no
cultural history, no presence of any kind." The hook material was there; the generator buried it in
para 2 because it was busy copying the source's "silence then answers" opening. The fix is
surfacing and placing the strongest image as the cold open, not inventing anything.

Two craft points confirmed by the source:
- **The callback returns to a concrete OBJECT.** The source orbits one physical thing — the
  shipping label — and lands on it at the end. Skripr's callback is abstract ("the calculation on
  a spreadsheet"). Stronger: plant a concrete image in the hook (the spreadsheet; "a song no human
  ever chose to play is streaming right now") and return to THAT.
- **Structure-copying is already working, maybe too literally.** Skripr's "investigators didn't
  follow the royalty payments, they followed the songs" is a near-verbatim lift of the source's
  "investigators didn't follow the labels, they followed the shoes." Skeleton copy = correct; the
  gap is ONLY the hook/callback craft layer — exactly where #9 says stop imitating, start improving.

Net: match the source's skeleton; for the hook, pick the device the case's facts best support and
lead with the strongest concrete image; for the callback, return to that image. The material is
usually already in the researched facts — surface and place it, don't invent it.

### How Voice Match interacts with Move #9 (keep these two axes separate)

Voice Match and hook/callback craft are **orthogonal** and must not be conflated:
- **Structure/craft (Move #9)** = WHAT happens and WHEN — which hook device, where the loop opens,
  where the callback lands, where the peak sits. Case- and framework-driven.
- **Voice Match** = HOW it's said — diction, sentence rhythm, register, signature phrases. Creator-
  driven (Brew, J Wisdom, etc.).

The same paradox hook should be renderable in any voice: Brew states it forensically ("A song is
playing on Spotify right now. No one has ever chosen to hear it."), J Wisdom states it clinically,
a hype voice states it with energy. So **Move #9 must specify the hook as a STRUCTURAL INSTRUCTION
(device + which fact/image + defer-the-payoff), then let Voice Match phrase it** — never bake a
specific voice's wording into the hook logic, or you get the earlier bug where a J Wisdom /
Kurzgesagt voice fought the case (psychology voice on a mechanism story). Order of operations:
pick device from facts → draft hook as structure → Voice Match renders the wording → hook re-stamp.

Caveats where voice legitimately constrains craft:
- Some voices ban a device: J Wisdom "never opens on a rhetorical question"; Brew avoids second-
  person. Move #9's device menu must respect the selected voice's NEVER-DOES list (pick a device
  the voice allows).
- A voice may carry its own opening signature (Brew's date-stamp cold-drop). When it does, treat
  that as the device for that voice, still applied to the case's strongest fact/image.
- Voice must never be allowed to WEAKEN the loop/callback requirement — those stay always-on
  best-practice (§ above); voice changes the words, not whether the loop opens or the callback lands.

## Consolidated next sequence (after the 11-min Move #8 read)

Ordered by leverage, not by number:

1. **Move #9 — hook/callback/climax craft** (above). Highest visible engagement gain; contained.
   Fixes the two retention checks that still fail.
2. **Move #8 follow-up #4 — duration-count HARD replacement.** Prompt-only enforcement FAILED (the
   11-min build still said "seven years" 5× and still tripped the safety flag). Make it a
   deterministic post-pass that replaces computed spans ("seven years") with the sourced date
   range ("2017 to 2024" / "since 2017"), like the hook re-stamp overwrites rather than asks.
   Small, contained; do alongside #9.
3. **Context-expansion DEPTH — the real lever for beating ChatGPT.** The 11-min build padded by
   repetition: "$1.2M" appeared 4+ times, and it recycled the same five numbers ($1.2M / 661,440 /
   10,000 bots / seven years / $10M) across every section while still coming in UNDER target
   (1,513 vs 1,650 words). Even at 11 min there isn't enough DISTINCT sourced material, so the
   writer stretches by restating. ChatGPT filled 20 min with genuinely new material (victims,
   AI-future implications, the co-conspirator) — some sourced, some invented; Skripr must bring
   the SOURCED version of that breadth. Move #8's context-expansion (#5c upgrade) is not gathering
   enough distinct facts. **This jumps AHEAD of the timeout refactor** — chunked 20-min generation
   on a thin fact base just yields 20 minutes of the same five numbers.
4. **Move #8 follow-up #1 — 20-min timeout refactor (LAST).** `maxDuration` is already 300s, so
   this is request-splitting: `mode:"section"` (write one section <30s) + `mode:"finalize"`
   (assemble body, run voice/tic-strip/format-repair/hook-restamp, then ALL safety checks on the
   assembled script) + client loops the section plan with progress, one finalize call. Heavy,
   multi-file, only verifiable live — do it in a focused session AFTER context-depth, so there's
   actually enough distinct material to fill 20 min without padding.

## Holding every change against the bar

For each move, the test is: *would this have produced a right, complete fact without a human
who knows the case intervening?* Ferreira, `$10M`, and the missing mechanism all fail that bar
today; moves #1–#3 are the adjudication steps that make them pass.

## Move #6 — fact consistency (SHIPPED to branch; live result PENDING)

Problem: run-to-run retrieval variance. The identical case/title surfaces different fact sets
across runs — one run had the $8,091,843.64 forfeiture AND the 1,040-bots/661,440-streams
mechanism; the next lost both and $10M reappeared. Neither is false, but unstable quality breaks
the zero-edit bar. Four fixes, same "adjudicate/floor, don't fabricate" discipline:

1. **Stable cache key.** `deepenCaseFacts` keyed the cache on `caseKey(canonicalCaseName)`, which
   drifts run to run; now it keys on the STABLE `topicAnchor` (the remix title) when present, like
   the per-user library, so cache hits are as reliable as library hits and the known-best set is
   re-surfaced instead of re-rolled.
2. **High-value pin.** `isHighValueFact` tags money/forfeiture/settlement figures and quantified
   mechanisms; `capFacts` pins them to the front of every cap so the `factCap` slice can never
   silently drop them. This floors them at the CASE level (the cache is cross-user) — the correct
   home, because the per-user library can't cross the dev-Clerk-preview → live-Clerk-prod userId
   boundary.
3. **Heading claim-check.** New `heading-grounding` compliance check: a figure in a section
   HEADING ("streams 661k songs daily") must trace to the facts, catching a number that leaked
   from memory into a heading even when the body grounding missed it.
4. **Relaxed cache TTL.** `CACHE_TTL_MS` 20h → 14 days. The TTL was a pre-supersession band-aid;
   now that move #2 drops stale numbers on read, good facts should persist rather than age out and
   force a non-deterministic re-research.

`tsc`-clean; new pure-helper tests (`isHighValueFact`, `capFacts`, `heading-grounding`) green.
Live proof PENDING: run the Michael Smith / Spotify case twice under the same preview user — run 1
warms the store, run 2 must re-surface the $8M forfeiture and the 1,040/661,440 mechanism, not a
weaker set.

## Blocker fix — no silent fallback to ungrounded angles (branch)

Symptom: intermittently the flow skipped "Confirm the case" and rendered ungrounded generic
angles whose mechanism was fabricated ("spectral analysis fingerprints"). No 500 in the logs —
a logic path, not a crash.

Root cause: `groundThenAngles` (viral-brief) only routed `kind !== "event"` with zero candidates
to grounding; an EVENT that resolved to **zero candidates** fell through to `fetchAngles(b, null)`
= ungrounded. And `!r.ok` / a thrown fetch landed there too. The intermittency is upstream:
`findResearch` classifies `kind` via Perplexity Sonar (a LIVE search), so the same title resolves
"event" one run and "claim"/"explainer" the next, changing whether `resolveSubjects` runs. Neither
the length budget nor the v3 cache touches this path.

Fix: zero candidates for ANY kind now grounds on the chosen title (real research), never
ungrounded angles; a hard failure retries once, then surfaces a `resolve-error` screen with Try
Again / Start over — it never renders a factless, fabrication-prone script. Added logging at the
branch (`[viral-brief] resolve`, `[findResearch] resolved`, `[resolveSubjects] resolved`) so a
future empty run shows which path fired and why.

## Move #8 — follow-ups (2 of 3 built on branch; #1 scoped)

First live read: craft works, accuracy moat held (ChatGPT invented "Jonathan Hay" + a fake quote;
Skripr invented nothing). Three follow-ups:

- **#2 Retention scaffolding enforced (BUILT).** Hook rule now demands an OPEN LOOP (tease-then-
  jump, never state-facts-in-order); callback rule is mandatory and must land the ending on a REAL
  SOURCED FACT (forfeiture / plea / documented outcome), never a phantom. Prompt-level driving.
- **#3 Implied-fact cliffhanger guard (BUILT).** New `implied-revelation` compliance check: a
  revelation-tease in the CLOSING ("what investigators found was not what anyone expected") is
  flagged — the invented thing is the narrative IMPLICATION, which the claim check misses because
  every sentence is individually sourced. Move #8's expansion introduced this risk; this is the net.
- **#4 Duration-count rule (BUILT).** Prompt: never state a computed span ("seven years"); use the
  date range ("2017 to 2024"). The recurring flag.
- **#1 20-min generation timeout (BLOCKER — SCOPED, not built).** The heavy Move #8 generation
  drops the connection on a 20-min build; `maxDuration` is already 300 and won't scale. Needs
  request-splitting, NOT a bigger timeout:
  1. Add a `mode:"section"` to the generate route: write ONE section given {sectionPlan, index,
     prior-body, facts, voice}, return it fast (<30s). Reuse `generateBySections`' per-section logic.
  2. Add a `mode:"finalize"`: take the assembled body, run voice pass (or per-section), the
     deterministic tic strip, format repair, hook re-stamp, then ALL safety checks
     (claim / quote-grounding / source-leak / heading / padding / implied-revelation) on the
     ASSEMBLED script. Return the final script + compliance.
  3. Client (viral-brief generate flow): loop the section plan calling `mode:"section"` with a
     progress bar, accumulate, then one `mode:"finalize"` call. No single request runs long.
  Must be preview-verified end to end at 20 min before `--prod` — this is why it wasn't built blind.

`tsc`-clean; new `implied-revelation` test green; all six suites green.

## Move #9 supplement — hook device selection + concrete-object callback (BUILT, prompt-level)

The first Move #9 build did the check side (best-practice tags on early-loop/callback) and a
GENERIC "defer the payoff" hook. The sharper craft framing was missing; added, all prompt-level in
`claude.ts` generation:

1. **Hook device SELECTED from the case's facts (1a).** A device menu — resolve-a-witnessed-
   spectacle, paradox, cold-scene-drop, ticking-clock — with the instruction to pick the one THIS
   case's facts support (paradox for Smith: "billions of streams, zero real fans", already in the
   researched facts) and the voice allows, and to LEAD with the strongest concrete image, not bury
   it in paragraph 2. Explicitly: do not transplant the source's device.
2. **Concrete-object callback (2c).** Plant one concrete image/object in the hook (the 2017
   spreadsheet; "a song no human ever chose to play"), return to THAT image at the end, still
   landing on a real sourced fact (the forfeiture). Abstract callbacks are called out as weak.
3. **Order of operations — device/voice separated (1b).** Pick device from facts → draft hook as
   STRUCTURE → voice renders the wording → hook re-stamp. Voice changes words, never whether the
   loop opens or the callback lands; it may not pick a device from its NEVER-DOES list.
4. **Voice-owned opening signatures allowed as the device** (Brew's date-stamp), still pointed at
   the case's strongest fact/image.

`tsc`-clean; all six suites green (prompt-only, no new logic). Verify on the ~11-min Michael Smith
build: hook LEADS on the paradox (not "something was draining millions"), plants a concrete image,
and the ending returns to that image + the $8M forfeiture.

## Move #9 fixes round 2 — the niche-agnostic punch-list

Overarching rule now front and center: **case- and niche-agnostic only.** Michael Smith is the
test fixture, not the target — no hard-coded case names, topics, numbers, or date ranges. The
`stripComputedDurations` break was the object lesson: a blind rule that shatters on real prose and
would shatter identically on "for three decades" in any niche.

1. **`stripComputedDurations` REVERTED (top priority).** The blind token replace shipped broken
   grammar ("For nearly seven years" → "For from 2017 to 2024", dangling "…through 2024. since
   2017.") and desynced the hook. Reverted to prompt rule + the existing grounding soft-flag (which
   already flags a spelled span not in the facts). Clean prose beats a mangling strip. A future
   grammar-aware version must rewrite whole phrases, re-sync the hook, and be live-verified.
2. **Settled-figure retrieval (supersession variance).** The resolved authoritative number
   (forfeiture / judgment / verdict / restitution / final toll / sentence) is now an explicit
   high-value deepen question, so it re-surfaces every run and supersession (#2) has it to win over
   the earlier allegation. `RESEARCH_BRIEF_VERSION` 3→4. Generalizes across niches by construction.
3. **Stale-date month granularity.** The check now catches "scheduled for July 2026" (month-only),
   comparing against the END of that month so a partial current month isn't wrongly flagged. Any
   niche, any future-framed date.
4. **Padding.** The anti-restatement rule is hardened: restating a fact/explanation to fill length
   is a hard failure; length comes from BREADTH of distinct real material (ties to context depth),
   and a tight script beats a padded one.
5. **Hook device selection pushed.** The first SENTENCE must be the device firing on a concrete
   image from the facts; vague abstract openers ("something was quietly draining millions") are a
   failure. Niche-agnostic device menu (paradox / cold-scene / ticking-clock / stark-object).

Confirmed working, do not regress: the Move #9 open-loop and callback checks now PASS (framework
fidelity 4/5, beats source). `tsc`-clean; new stale-date month tests green; all six suites green.

## Context depth — the real bottleneck was a fact CAP, not the research (root-cause fix)

Diagnosis held: the ~11-min build recycled five numbers because the angle page had almost nothing
else on it. But the research WAS gathering context — the facts just weren't reaching the page. The
cap, not the deepen brief, was the bottleneck:
- `suggest-viral-angles` sliced the researched facts to the first **12** before building slot
  cards. With `capFacts` pinning the core case figures to the front, those 12 were the core five;
  the 20-40 distinct context facts (detection, prior cases, victims, response) were sliced off and
  never reached the cards. Raised 12 → 50.
- The full-video outline passed generation only the facts the CARDS cited (a union of ~12), so the
  writer never saw the context breadth even when it existed. The full build now scopes on the
  ENTIRE researched set (`factRefs` = every fact), and the claim check validates against that same
  full set. Single-card builds still scope to that card.
- `buildGroundingBlock` cap 12 → 50 for consistency.

Deterministic, niche-agnostic (no streaming-specific logic), and it directly moves the acceptance
metric: the count of distinct sourced facts on the angle page and in the generated script. Verify
that count goes UP on the ~11-min build before touching padding or hook determinism — those two
are downstream symptoms of thin material and should ease once the breadth lands. `tsc`-clean; all
six suites green.

## Figure-check — universal spelled-number normalization (BUILT, voice-independent)

The figure-check false-positived when a voice spelled numbers out: it chopped a correctly-spelled
figure ("six hundred sixty-one thousand four hundred forty" = 661,440, which IS in the facts) into
fragments ("six hundred", "four hundred") and flagged them. Fixed BELOW the voice layer, by
construction — no special-casing of any voice:
- `spelledNumbersIn` / `digitNumbersIn` / `numbersMatch` in `script-compliance.ts` normalize BOTH
  the script AND the fact set to numeric VALUES (spelled → digits, "$8M"/"8 million" → 8,000,000,
  "8,091,843.64" → canonical), and match on value at the coarser side's precision, so "$8M"
  matches "$8,091,843.64" but "$9M" does not. Spelled numbers are parsed as WHOLE phrases (no
  fragmentation).
- The body grounding check and the heading claim-check both use it. "seven years" stays a soft
  flag (computed span, unchanged).
Test: the same fact ($8,091,843.64) as digits / spelled / "$8M" all pass; an absent number ($25M)
flags in all three renderings; the whole-phrase 661,440 no longer fragments. All green.

Still open (deterministic, force-it): the hook device + callback RE-STAMP — a post-generation pass
that guarantees the first sentence is the selected device on a concrete image and the ending
returns to it + lands on a sourced fact (prompt nudges have failed ~3 runs; needs a rewrite pass,
preview-verified). Then the timeout refactor for the 20-min head-to-head.

## Hook/callback fix #2 — deterministic detection + GUARDED rewrite (BUILT, preview-gated)

"Force it, don't ask." Prompt nudges failed ~3 runs (hook opened vague, ending teased). Built as a
post-generation pass whose two GUARDS are pure/deterministic and unit-tested, even though the
rewrite is an LLM call that earns the preview gate:
- **Detection (conservative, under-fire):** `hookIsVague` fires only on the specific failing shapes
  ("something was quietly…", "for years,…", "few noticed…"); `endingTeasesWithoutLanding` fires
  only when the ending teases ("what happened next", "who assembled it") AND does not land on a
  sourced figure/outcome. A false negative is cheap; a false positive touches the finished script.
- **Guard (a):** the rewriter is called ONLY when detection fires — a hook/callback that already
  works is never touched.
- **Guard (b):** `chooseRewrite`/`isUsableRewrite` keep the ORIGINAL on any empty, oversized, or
  refusal return, and on any error. Worst case is "fails to improve an already-failing hook" — it
  cannot regress a good one.
- The hook rewrite runs BEFORE `restampHook` so it re-syncs into the body; the ending rewrite
  replaces only the final paragraph. Both time-guarded within the generation budget.

`tsc`-clean; detection + both guards unit-tested (passing hook → no rewrite; garbage/empty/refusal
→ original retained); all six suites green. PREVIEW VERIFICATION (the rewrite quality): across a
few runs, does the hook now lead on a concrete-image device consistently (the tell was 4/5 then
3/5), and does the ending land on the forfeiture instead of a co-conspirator cliffhanger?
