---
description: The SEO learning loop. Pulls real outcomes (GSC + PostHog) for built pages, scores predicted vs actual, writes verdicts + durable lessons back into the ledger, and recalibrates the scoring method. Run on a cadence once GSC has data.
---

# /seo-review — Skripr SEO learning loop

Optional scope (one URL or cluster): **$ARGUMENTS** (omit to review all built pages)

You are the Head of SEO at Skripr running the reflection cycle. The point is
self-improvement: every built page made a prediction; this compares it to reality
and updates the heuristics so future builds are smarter. Read
`docs/skripr-seo-brief.md` and `docs/seo-opportunities.json` first.

## 0. Preconditions
- **GSC is wired (set up 2026-06-28).** Service-account key at `~/.config/skripr/gsc-key.json` (perms 600, outside the repo; also in Vercel as `GSC_SERVICE_ACCOUNT_JSON` for any future serverless use). The service account `skripr-gsc-reader@skripr.iam.gserviceaccount.com` is a Full user on `sc-domain:skripr.app`. This loop runs LOCALLY (it edits ledger files), so it reads the local key, not Vercel.
- PostHog is wired (`NEXT_PUBLIC_POSTHOG_KEY`); use its API for funnel/conversion data.

## 1. Observe (real data only)
- Run `python3 -W ignore scripts/gsc-pull.py 28` to get per-page impressions, clicks, avgPosition, CTR for the last 28 days (override days as needed). A page absent from the output has no impressions yet (treat as not-yet-ranking, not zero-by-fabrication).
- **PostHog**: free-tool usage events and signups attributed to each page's funnel.
- Never invent a number. If a source is unavailable, leave the field null and say so.

## 2. Record
Write the pulled numbers into each page's `actual` block (set `asOf` to today, `indexedOn` when first seen indexed). Do not edit `predicted`.

## 3. Score predicted vs actual → verdict
Per page, set `verdict` to one of, with a one-line why:
- `winning` — indexed and gaining impressions/clicks at/above prediction.
- `indexed-not-ranking` — indexed but position is poor / few impressions.
- `not-indexed` — still not indexed past its `indexLikelihoodWeeks`; needs an internal link or a manual GSC request.
- `refresh-candidate` — was ranking, now slipping (CTR or position dropped).
- `kill-candidate` — saturated SERP, no traction after a fair window; stop investing.

## 4. Learn (this is the compounding part)
When a pattern holds across pages, append a `{ date, lesson, evidence }` entry to `learnings[]` and, if it changes how to pick or build pages, update `scoring_method` (note the date + evidence). Examples of real lessons: "tool pages index in ~3wk vs guides ~8wk", "saturated-SERP tool pages never ranked, down-weight competition", "hook-style CTA converted 2x the generic CTA". Keep lessons specific and evidence-backed.

## 5. Propose actions (do not auto-publish)
Output a short action list: pages to request-index, internal links to add, refresh-candidates to rewrite, kill-candidates to stop. Queue rewrites for human review; never silently edit a live page. Apply ledger/doc updates directly, but route any page-copy changes through `/seo-page`-style review.

## 6. Cadence
Weekly once there is data; monthly while the domain is young. Suggest scheduling via a cron only after the first manual run proves the data pulls work.
