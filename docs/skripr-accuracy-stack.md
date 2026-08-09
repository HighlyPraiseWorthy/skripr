# Skripr accuracy + quality stack — handoff

Context transfer for a fresh chat. This documents the grounding/accuracy/craft
system built across the session on branch **`seo-review/2026-07-27`** (all work
committed and pushed; deploys via `npx vercel deploy --prod`, never git).

## The problem it solves
Topic Only and Viral Remixer used to invent a plausible premise, then write a
confident script full of fabricated specifics (invented auditors, fake documents,
a "technician in 1987" that never existed). The stack below turns a typed topic or
a remix title into a script grounded in a real, sourced case, and catches the
model's residual fabrication before the creator sees it.

## The pipeline, in order
1. **Resolve the case (Claude, not Perplexity).** A title is a recall question, so
   `resolveSubjects` in `src/lib/research.ts` uses Claude (sonnet) to name the real
   documented cases a title is about (Perplexity buried famous historical cases
   under recent coverage). Numeric constraints in the title ("30 years") are a HARD
   filter. Self-negating candidates are dropped in code.
2. **Classify the topic kind.** event / explainer / hypothetical / claim. The
   no-invent gate only fires for unresolved EVENTS, so Kurzgesagt-style explainers
   and "what if" hypotheticals keep their specifics.
3. **Ground BEFORE angles.** Every flow (Topic Only, hook-card `script-brief`,
   Remixer `viral-brief`, Niche Bend) resolves the case first, then generates angles
   ABOUT it. A single case grounds silently; several show a pick-case screen; a
   "name the exact case" override is on every picker as the deterministic path.
4. **Deepen (Claude asks, Perplexity sources).** `deepenCaseFacts` has Claude write
   the documentary-critical questions (named programs, motive, access, settings,
   each defendant's sentence separately, the DOCUMENTED ENDING, and in the Remixer a
   BRIDGE question hunting the crossover between the source video's subject and the
   case). Perplexity answers with citations. Only sourced facts reach the script.
   Payoff-shaped: the source video's whyItWorks biases which facts to fetch.
5. **Vet the angles** (`src/lib/ai/angle-vet.ts`): deterministic number scan + LLM
   check for unsupported specifics, superlatives, misstated events, false
   relationships, anachronistic era terms, and charge/verdict mischaracterization.
   Warnings render on the angle cards.
6. **Closed-world generation** (`src/lib/ai/claude.ts`): with source material, the
   script may state ONLY specifics in the facts. Covers numbers, dates, names,
   places, and MOTIVES. No "research suggests" hedge fallback.
7. **Self-review** (`src/lib/ai/self-review.ts`): a second Claude pass fixes
   contradictions, entity drift (FBI vs Marshals), stale time-bound attributes
   (an age repeated where it no longer holds), and over-hedged documented facts.
   Runs before autosave. Shows an "Auto-corrected for accuracy" panel.
8. **Deterministic scan** (`src/lib/fact-check.ts`): flags dates and dollar figures
   not in the facts. "Verify before publishing" panel.
9. **Verify (on-demand button, all result pages)** (`src/lib/ai/verify-facts.ts`,
   `/api/scripts/verify`): Claude extracts claims -> Perplexity web-checks each ->
   Claude applies corrections and cuts the unverifiable. This is the backstop that
   catches fabricated PLACE NAMES and plausible-wrong dates the other guards miss.

## Craft layer (this session's last builds)
- **The Climax** technique now STAGES the peak and builds to the documented ending.
- **Director's-note field** on the shared `StorytellingPicker` (every flow): freeform
  casting/staging/tone/climax-aim instruction. Shapes the telling only; accuracy
  rules still win if a note conflicts with the facts.
- **CTA toggles** (`CompanionCtaToggle.tsx`): companion-video CTA and an opt-in early
  soft CTA (off by default; when off, one CTA at the end).
- **Title lock**: "use my topic as the title" keeps the creator's title, varies hooks.

## Hard rules that must never regress
- Deploy ONLY via `npx vercel deploy --prod`; run `./node_modules/.bin/tsc --noEmit`
  first. Verify live with curl (sandbox browser cannot reach the dev server).
- This is a MODIFIED Next.js: read `node_modules/next/dist/docs/` before Next APIs.
- Voice bible: no em dashes ever, no fabricated stats, Skripr never "finds videos".
- Do NOT run DDL against the production Supabase; hand the user the SQL to run.
- PERPLEXITY_API_KEY is Production-only (redacted on env pull), so Perplexity legs
  cannot be tested locally; ANTHROPIC_API_KEY IS in .env.local, so Claude legs can.

## Known open items (flagged, not built)
- Remixer "new niche" transplant titles (options 6-10) are generated before
  grounding, so the tool offers titles with no real case. The pick-time resolution
  catches it safely (no fabrication), but the tool still presents them as viable.
  Fix: relabel the section (cheap) OR ground each title at generation (~10 calls,
  expensive). Awaiting the user's call.
- Residual non-determinism in the Claude case picker even at temperature 0. The
  numeric hard-filter and the manual override mitigate it; it cannot be fully
  eliminated. The override is the deterministic path.

## Workflow that produces the best scripts
Generate -> click **Verify** on the result -> fix what it flags. The user also runs
each draft past a SEPARATE Claude reviewer chat, which has been the source of most
bug reports this session (it catches the seams between components).
