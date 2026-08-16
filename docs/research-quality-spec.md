# Research-quality spec — the "zero-edit" reframe

Status: diagnosis grounded in code (not guesses). Safety gate shipped; moves #1–#3 open.

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

1. **Canonical resolution + authority ranking + living-person guard** in `resolveSubjects`.
   After Claude names candidates, **rank the existing candidates** by authoritative coverage
   (one verification call: Perplexity, or a `sourceTier`-weighted check) so the DOJ-covered case
   sorts to the top, and run the living-person/company guard here at suggestion time.
   **Scope guard: rank, don't re-run.** One extra call over ≤4 candidates, not a re-research —
   or resolution goes from fast to slow and users feel latency instead of wrongness.

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

## Status: moves #1–#3 all shipped

The full adjudication chain exists: #1 ranks the right case onto the confirm card, #3 digs for
the missing quantities, #2 supersedes stale/weaker facts over the whole returned set. The one
remaining step is the PROOF: a single live click-through on Michael Smith to confirm the four
corrections (wrong case, $10M→$8M, stale age, missing mechanism) now happen with zero human
intervention. All three moves use Perplexity/LLM paths that are prod-only, so they are
tsc + graceful-fallback verified but not yet run live. The cache-TTL safety gate stays until
that run confirms supersession fires.

## Holding every change against the bar

For each move, the test is: *would this have produced a right, complete fact without a human
who knows the case intervening?* Ferreira, `$10M`, and the missing mechanism all fail that bar
today; moves #1–#3 are the adjudication steps that make them pass.
