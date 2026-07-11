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
- Each page now includes `topQueries` (the real search terms it appears for, with per-query position). USE THEM: (a) a page ranking top-10 for a query it does not target in its H1/title is a reinforcement candidate (suggest phrasing tweaks through the /seo-page review flow); (b) recurring query variants nobody targets are spoke candidates for the ledger; (c) a hub outranking its own spoke for the spoke's exact keyword is an internal-linking/anchor-text fix. A page with impressions but empty topQueries means Google anonymized rare queries (normal for tiny volumes, not an error).
- **When classifying URL Inspection `coverageState`, match EXACT statuses, never substrings.** "Discovered - currently not indexed" and "Crawled - currently not indexed" both CONTAIN the word "indexed" but mean NOT indexed (this substring bug inflated an audit once). Buckets: "Submitted and indexed" / "Indexed, not submitted in sitemap" = indexed; "Discovered - currently not indexed" = queued, normal for a young domain, no fix needed; "Crawled - currently not indexed" = crawled but judged not index-worthy yet (quality signal, watch it); "URL is unknown to Google" = never seen, needs links or a manual request.
- **PostHog** (wired 2026-07-06, key at `~/.config/skripr/posthog-key`, Query-read scope, project 444678):
  - `python3 -W ignore scripts/posthog-pull.py attribution 28` → new signups + which public pages each signer-up viewed BEFORE their first /dashboard pageview (assisted attribution; one signup can credit several pages). Write per-page counts into `signupsAttributed` in the ledger.
  - `python3 -W ignore scripts/posthog-pull.py pages 28` → pageviews/visitors per public path (tool usage volume).
  - Caveats to respect: the signup proxy is "first /dashboard pageview", so an existing user on a new device counts as new; volumes are tiny early on, so report counts, not percentages. A page with traffic but zero signup touches is a conversion-copy question, not an SEO one.
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
