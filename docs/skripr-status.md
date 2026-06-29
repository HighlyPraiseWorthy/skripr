# Skripr Status and Handoff

> Read this plus `docs/skripr-voice.md` to get fully up to speed on Skripr. Last updated 2026-06-23.

## What Skripr is
A YouTube script generation SaaS. You give it a video that is ALREADY winning. Skripr reverse-engineers that specific video, finds the **retention triggers** that made it perform, and writes a fresh script applying those same triggers, in your voice. Built for faceless / voiceover channels.

CRITICAL framing (corrected by Anton 2026-06-26, see memory `project_skripr_mechanism`): Skripr does NOT find/discover/surface videos for you. The user brings the proven video; Skripr learns its retention triggers and writes from it. Never write "Skripr finds proven videos in your niche." Niche Bend and Viral Remixer both reverse-engineer a provided video.

- Repo: `~/workspace/skripr` (Next.js modified App Router, see AGENTS.md, read `node_modules/next/dist/docs/` before writing Next code).
- Live domain: **skripr.app** (production). Old `skripr.vercel.app` 308-redirects to it.
- Stack: Clerk auth (production keys), Supabase (`supabaseAdmin`), Anthropic SDK (claude-sonnet-4-6 for generation, claude-haiku-4-5 for angles/classify), Perplexity Sonar (research), Stripe billing, Sentry, PostHog.
- Owner email: skripr.app@gmail.com. Admin in-app via `ADMIN_USER_IDS` env (Clerk IDs, = agency/unlimited).

## Deploy workflow (hard rules)
- Deploy ONLY via `npx vercel deploy --prod`. Git push does not deploy.
- Always run `./node_modules/.bin/tsc --noEmit` first; check exit code.
- `vercel.json` `functions.maxDuration` overrides route-level maxDuration. Generate route is 300s.
- `scripts.estimated_duration` is integer seconds.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Vercel "Sensitive" env vars return EMPTY from `vercel env pull` by design; that does not mean they are unset. Verify values in the Vercel dashboard, not via pull.

## Production launch (done 2026-06-20)
Custom domain, SSL, production Clerk (pk_live/sk_live), Google sign-in via own OAuth (Apple disabled), Clerk webhook `skripr.app/api/clerk/webhook` (user.created creates `user_profiles`), Stripe webhook `skripr.app/api/stripe/webhook` (checkout upgrades plan, subscription.deleted/updated downgrades). Full funnel smoke-tested end to end (signup, paywall, live Stripe checkout, generation). Secrets rotated. Dev data was remapped in Supabase from old to new Clerk user IDs.

## Product Hunt launch: SCHEDULED for Thursday June 25, 12:01am PT
- PH copy is set (tagline "YouTube scripts built on what's already winning.", description, 3 tags: YouTube + Artificial Intelligence + Marketing, maker comment). Gallery = 4 trimmed GIFs (Niche Bend, Viral Remixer, script-gen, Voice Match).
- Reddit founder-story post is written (for r/SideProject, r/SaaS, r/indiehackers, r/EntrepreneurRideAlong, r/juststart). Not yet posted.
- LAUNCH-DAY PLAN: code freeze from Jun 24 night (no deploys unless emergency). Top up Anthropic + Perplexity API credit (free-signup generation spike is the main cost risk). On Jun 25: reply to every PH comment fast, post the Reddit story, watch Vercel/Stripe/Sentry. Do not deploy.

## Pricing and gating
Free 2 scripts/mo, Starter $19 (20), Pro $39 (50), Agency $99 (200). PLAN_LIMITS in `src/lib/stripe/config.ts` is source of truth. Niche Bend + Viral Magnet = Starter+. Compliance = Pro+ (enforced in route AND page). A/B Titles + Metadata = free. Gate CTAs say "Get Starter/Pro" (not "Unlock", a banned word).

## SEO surface (live, in sitemap, GSC verified + sitemap submitted)
- Landing `/`, `/pricing`, `/contact`, `/sign-up`.
- Comparison/thesis pages: `/subscribr-alternative`, `/tubeai-alternative`, `/skripr-vs-claude`, `/will-ai-replace-youtubers` (all brand-themed, FAQ schema, honest, no fabricated stats).
- `/youtube-strategy` hub + ~33 guide articles in `src/app/youtube-strategy/articles.ts` (clusters incl. Faceless YouTube, Growth, Retention, Niche, Viral, Titles). Articles render via `[slug]/page.tsx` + `ArticleTemplate.tsx`. Each auto-gets a mid-article CTA + comparison link, FAQs + FAQPage schema.
- Sitemap `src/app/sitemap.ts` (~64 URLs). robots.ts allows all + references sitemap.
- metadataBase set, default OG/Twitter, dynamic branded OG image at `src/app/opengraph-image.tsx`.
- SEO is the slow lane (weeks to months). Early GSC: ~10 impressions, avg position ~7 at 2 days. Launch traffic comes from PH + Reddit, not SEO.

## Free tools (ungated lead-gen, SEO + funnel) — added 2026-06-27
Free, no-login interactive tools that target high-volume tool-intent keywords and funnel to signup ("Start free, 2 scripts"). Each wraps existing AI plumbing in a public page. Ungated but IP rate-limited (in-memory, best-effort) on cheap Haiku to protect API budget. Internally linked from the homepage footer + all 3 pillar footers.
- **Channel Name Generator** (~49k/mo cluster): hub `/youtube-channel-name-generator` + 18 niche spokes `/[niche]` (gaming, tech, music, etc.) via `generateStaticParams`. Data in `src/lib/data/channel-name-niches.ts`, widget `src/components/ChannelNameGenerator.tsx`, API `/api/channel-name-generator`.
- **YouTube SEO Toolkit** (~99k/mo cluster, biggest): hub `/youtube-seo-tools` + 3 exact-match spokes `/youtube-tag-generator` (~53k), `/youtube-title-generator` (~23k), `/youtube-description-generator` (~20k). Config `src/lib/data/seo-tools.ts`, adaptive widget `src/components/SeoToolWidget.tsx`, shared page `src/components/SeoToolPage.tsx`, API `/api/youtube-seo-tools`.
- Both have fresh re-rolls (pass already-shown items back as `exclude`) and avoid generic output. Verified working live.
- NEXT possible tool pillars from keyword research: a "promote/grow/go viral" cluster (~124k/mo) exists but is broad informational intent that overlaps existing guides, NOT a tool, so deprioritized.

## Generation engine state (`src/lib/ai/claude.ts`)
- A creator voice profile OVERRIDES the default documentary paragraph/sentence rhythm (short punches/fragments allowed for punchy voices). It never overrides: banned phrases, anti-fabrication, no-sponsor, voiceover-only (no bracket markers), no em dashes in output.
- Rule 10 NO REPETITION, Rule 11 CONCRETE SCENES (sensory moments over abstract) are always on.
- Quality validated by independent ChatGPT grading: cult psychology 8.5, cocaine route 9.1, people-pleasing (Kurzgesagt) 9.3. KEY INSIGHT: voice fidelity is highest when voice matches the content type (Kurzgesagt/explainer = engine's home turf; Hormozi punchy voice on a deep documentary topic scores lower on voice-match because the topic pulls documentary). The engine is considered DONE; do not keep tuning it. The bottleneck is traction, not script quality.

## Recent fixes this session (already deployed)
- Voice handoff: topic-only brief carries voiceProfileId; all 4 brief pages pass voice to generate.
- Viral Remixer title lock: viral-brief angle titles now keep the selected remix title's formula.
- Clerk UI dark-themed (`@clerk/themes` dark baseTheme + `.cl-*` CSS in globals.css). Social buttons styled.
- youtube-strategy guides re-themed purple to blue. ResearchStep recolored purple to blue.
- Em-dashes and banned SaaS words swept from all user-facing copy.

## Deferred (only if asked, not now)
- First-N-free script allowance (activation lever).
- Payoff-timing nudge (land big reveal ~40-50%) and more emotional peaks in scripts.
- A "voice strength" toggle (loose blend vs strict voice adherence).
- Gating script-brief Viral Magnet was done; A/B Titles intentionally left free.

## Voice for all copy
See `docs/skripr-voice.md`. No dashes. Short sentences. No banned SaaS words. Belief first, feature as proof, land on outcome. No fabricated stats (pre-traction). Humanize everything by default.
