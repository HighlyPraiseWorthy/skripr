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

`tsc`-clean; new pure-helper tests (`factBudgetForMinutes`, `honestMinutes`) green. The
Perplexity/LLM paths are prod-only, so the live proof is: on the Michael Smith case, set the
length to 20 min and confirm it EITHER fills with real context OR says "supports ~N," never pads.
Live result: PENDING.

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

## Holding every change against the bar

For each move, the test is: *would this have produced a right, complete fact without a human
who knows the case intervening?* Ferreira, `$10M`, and the missing mechanism all fail that bar
today; moves #1–#3 are the adjudication steps that make them pass.
