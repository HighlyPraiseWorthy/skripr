---
description: Build one NexLev-grounded SEO page end to end (research → write → QA → build → human review → deploy → verify → log). Human review before deploy is mandatory.
---

# /seo-page — Skripr SEO pipeline orchestrator

Target keyword/topic: **$ARGUMENTS**

You are the Head of SEO at Skripr. Run this pipeline for the target above. It
produces ONE page that is grounded in real YouTube data (the Creator Intent
Engine), in Skripr's voice, accuracy-checked, then built into the repo. **You
must STOP for human review before deploying.** Never deploy without approval.

First, if you have not already this session, read `docs/skripr-seo-brief.md` and
`docs/skripr-voice.md`. Load the `seo-page-patterns` and `seo-voice-qa` skills.

## 1. Opportunity check + page-type decision
- Read `docs/seo-opportunities.json`. If the target (or its cluster) is already built or deprioritized, say so and ask whether to continue.
- **Pull real keyword volume** (preferred over guessing): run `python3 scripts/keyword-planner.py "<target>" "<related seed>"`. If it returns `ok: true`, use the real `avg_monthly_searches` + `competition_index` for scoring, and harvest the returned ideas as secondary-keyword + spoke candidates. If it returns `ok: false` (credentials not yet approved, see docs/keyword-planner-setup.md), fall back to manual SERP estimates and SAY which you used. Never fabricate a volume.
- If new, score it: real (or estimated) search volume, intent, competition, product-to-funnel fit, and index-likelihood on a new domain. Use the method in brief §7.
- **Choose the page type from intent. Do NOT default to a tool.** A tool is the highest-ROI page ONLY when the keyword is tool-intent AND Skripr already ships an engine that backs it. Map intent → type:
  - tool-intent + Skripr has the engine → **free tool** (the money pattern).
  - "how to / what is / best way" informational → **guide** (in `/youtube-strategy`).
  - "X vs Y" / "X alternative" → **comparison** page.
  - "best X for Y" commercial roundup → **roundup**.
  - If no type fits well, say so; do not force a tool.
- State a go / no-go + the chosen page type with one-line reasoning. If no-go, stop and recommend a better target.

## 2. Research — the Creator Intent Engine (REAL data only)
Use the NexLev MCP tools to ground the page in actual YouTube data for this topic's niche:
- `get_niche_overview`, `search_niche_finder_channels`, `youtube_channel_outliers`, `get_similar_videos`, `get_video_rpm` — for real outlier channels, real titles, real RPMs.
- `get_video_transcript` / `youtube_video_comments` — for real creator + audience vocabulary.

**NexLev data-quality gates (apply ALL, or the data is not usable):**
- **Targeted, never wildcard.** Query the actual niche; do NOT use `query="*"` (it returns multilingual spam and broken scores, as seen 2026-06-28).
- **Fresh.** Date-bound to recent work: `startDate` within the last ~12 months and/or sort by `publishedAt`. State the pull date on the page ("Source: public YouTube data, pulled <date>").
- **Real performers, not artifacts.** `minOutlierScore` ~2, but also cap absurd values (discard any outlierScore > ~50 — they are data artifacts). Set a sane `minView` floor.
- **English + on-topic.** `englishOnly: true`; drop titles unrelated to the niche.
- **Monetized = more persuasive.** Prefer monetized examples: check `check_channel_monetization` / `check_video_monetization`, and pull `get_video_rpm` / `get_geography_revenue` so the page can show the niche actually earns. A monetized, recent, high-outlier example is what grabs the reader; an old or demonetized one does not.
- If after filtering the data is thin or junky, DO NOT force it onto the page (discipline from the hook-page run). Ground the copy in real patterns instead and say so.

**Competitor research (what we can and cannot do — be honest):**
- We have NO backlink/keyword-volume database (Ahrefs/Semrush) wired, so we cannot pull a competitor's exact ranking keywords, search volumes, or sales. Do not pretend to.
- What we CAN do: web search the live SERP for the target keyword (who ranks, title/format patterns, FAQs, AI Overview presence); and use the `firecrawl` skill to map a competitor's sitemap and scrape their pages to infer their content/keyword clusters and find gaps Skripr can own.
- If true competitor keyword data is needed, flag it: it requires wiring a paid SEO API (Ahrefs/Semrush) or the Google Ads Keyword Planner.

Then build the **Creator Intent map** for the query:
goal → stage → tools they already use → frustration that drove the search → which Skripr feature genuinely helps → best content format → fitting CTA.
Label every data point "Source: public YouTube data." Use NO invented numbers.

## 3. Brief → 4. Write
- Write a tight brief (primary + secondary keywords, intent, the Creator Intent map, the angle, internal-link targets).
- Draft the page copy in Skripr's voice, grounded in the §2 research.

## 5. Voice + brand QA — run the `seo-voice-qa` skill
Every checkbox must pass: mechanism accuracy (no "Skripr finds videos"), no dashes, no banned words, no fabricated stats, comparison accuracy. Fix and re-check before continuing.

## 6. SEO QA
Title ≤ ~60 chars with the keyword, compelling meta description, canonical, correct JSON-LD, FAQs, internal links in and out, adequate depth vs the SERP.

## 7. Build — follow the `seo-page-patterns` skill
Pick the page type, mirror the existing template, add the data-file entry (or new files if a new type), confirm it appears in `sitemap.ts`, and add the mandatory internal links from the homepage footer and pillar footers.

## 8. Typecheck
`./node_modules/.bin/tsc --noEmit` — must exit 0. Fix until clean.

## 9. STOP — human review
Show: the new URL(s), the diff summary, the Creator Intent map, the QA result, and the post-deploy indexing plan. **Ask for explicit approval. Do not deploy until the user approves.**

## 10. Deploy + verify (only after approval)
`npx vercel deploy --prod`. Then `curl` the live URL(s): status code + grep expected content; POST to any new API route to confirm output.

## 11. Log
- Append/update the cluster in `docs/seo-opportunities.json` (status: built, date, URL, cluster).
- Append a `pages[]` entry with the `predicted` block filled from step 1 (intent, volume, competition, indexLikelihoodWeeks) and `actual` left null. This is what `/seo-review` later scores reality against, so the agent learns. Follow the `schema` block in the ledger.
- Add it to the priority list in `docs/skripr-indexing-plan.md` if it is high-intent.
