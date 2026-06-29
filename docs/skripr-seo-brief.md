# Skripr SEO Agent Brief

> Single source of truth for the Skripr SEO workstream. Read this + `docs/skripr-voice.md` before doing anything. This brief is self-contained: it folds in the relevant project memory so you do not need anything else to start.

---

## 1. What Skripr is (get this exactly right)

Skripr is a YouTube script-generation SaaS at **skripr.app** (Next.js, deployed on Vercel). Repo: `~/workspace/skripr`.

**The mechanism (DO NOT get this wrong):** the USER brings a video that is already winning, or a topic. Skripr reverse-engineers WHY that proven video worked (its hook, structure, pacing, title formula) and writes a fresh script on the user's own topic, in their voice. Two input modes: (1) paste a proven video, (2) topic-only (Skripr pulls real research + builds on proven structures).

**HARD accuracy rule:** Skripr does **NOT** find, discover, or surface videos for the user. Never write "Skripr finds proven videos in your niche" or "surfaces outliers for you." The creator provides the input. The one exception is **Outlier Finder**, which is **channel-scoped only**: the user gives it a channel, it surfaces that channel's breakout videos. It is not open-web discovery. (This exact error was already shipped once across the SEO pages and had to be swept out. Do not reintroduce it.)

**NEVER mention** Skripr's internal self-improving / collective-learning layer (a per-niche framework pool). It is private. Not for any public page or copy.

---

## 2. Voice and copy rules (from `docs/skripr-voice.md`, read it in full)

- **No dashes** (em or en). Ever.
- Short sentences, one idea each. Fifth-grade reading level.
- **No fabricated stats, user counts, or results.** Skripr is pre-traction. Real numbers only. (Data blocks of real YouTube channels are labeled "Source: public YouTube data," framed as "the kind of proven video you bring to Skripr," never "videos Skripr found.")
- Banned SaaS words: game-changing, revolutionary, amazing, unlock, supercharge, leverage, seamless, robust, powerful, streamline, cutting-edge, next-level, elevate.
- Belief-first: sell the belief / burst a negative belief, not features. Feature is the proof, outcome is the close.
- Humanize everything (founder-in-the-trenches, not brand-manager).
- Approved phrasing for what Skripr extracts from a video: "the formula behind the video," "why it worked," "the hooks and retention patterns," "the viral DNA / the playbook," "retention triggers." All fine, use interchangeably.
- **Comparison-page accuracy:** on `/compare` and alternative pages, verify a competitor's ACTUAL capabilities before claiming "X cannot do Y." Lead with what the competitor is genuinely good at, then the honest Skripr wedge. Never invent a competitor limitation. The honest wedge vs general AI (ChatGPT/Gemini/Claude) is "they write from scratch; you bring Skripr a proven video and it reverse-engineers why it worked," NOT "Skripr knows what's trending."

---

## 3. SEO surface already built (do not duplicate)

**Pillars (3)** via `src/components/PillarHub.tsx`, data co-located in each page:
- `/youtube-scriptwriting`, `/faceless-youtube`, `/youtube-video-ideas`

**Content hubs:**
- `/youtube-strategy` hub + ~33 guide articles. Data: `src/app/youtube-strategy/articles.ts`. Renders via `[slug]/page.tsx` + `ArticleTemplate.tsx`. Each guide auto-gets a mid-article CTA, a comparison link, and FAQPage schema.
- `/compare` hub + 6 comparison spokes. Data: `src/app/compare/comparisons.ts`, render `compare/[slug]/page.tsx`.
- `/best` hub + 5 roundup spokes. Data: `src/app/best/roundups.ts`, render `best/[slug]/page.tsx`.

**Standalone pages:** `/subscribr-alternative`, `/tubeai-alternative`, `/skripr-vs-claude`, `/will-ai-replace-youtubers`. Plus `/pricing`, `/contact`, `/sign-up`, `/terms`, `/privacy`.

**Free tools (ungated lead-gen, the newest + highest-value pillars):**
- **Channel Name Generator** (~49k/mo cluster): hub `/youtube-channel-name-generator` + 18 niche spokes `/[niche]`. Data `src/lib/data/channel-name-niches.ts`, widget `src/components/ChannelNameGenerator.tsx`, API `/api/channel-name-generator`.
- **YouTube SEO Toolkit** (~99k/mo cluster): hub `/youtube-seo-tools` + 3 exact-match spokes `/youtube-tag-generator` (~53k), `/youtube-title-generator` (~23k), `/youtube-description-generator` (~20k). Config `src/lib/data/seo-tools.ts`, widget `src/components/SeoToolWidget.tsx`, shared page `src/components/SeoToolPage.tsx`, API `/api/youtube-seo-tools`.

**Infra:** `src/app/sitemap.ts` (data-driven, ~64 URLs, auto-includes new entries from the data files), `src/app/robots.ts` (allow all + sitemap), `metadataBase` set in `src/app/layout.tsx`, dynamic branded OG image at `src/app/opengraph-image.tsx`.

---

## 4. How to add SEO pages (mirror these proven patterns)

**This is a MODIFIED Next.js (see `AGENTS.md`).** Conventions differ from training data. Mirror existing files, do not invent. Key conventions confirmed in-repo:
- Dynamic route params are a Promise: `{ params }: { params: Promise<{ slug: string }> }`, then `const { slug } = await params;`.
- `export function generateStaticParams()` returns the slug array from the data file.
- `export async function generateMetadata({ params })` for per-page title/description/OG/canonical.
- Static pages use `export const metadata: Metadata = {...}`.
- JSON-LD via `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(x) }} />`. Use WebApplication (tools), Article (guides/pillars), FAQPage, BreadcrumbList, ItemList (roundups).
- Shared dark palette: `bg #080c12, border #1a2840, text #e8edf5, muted #d2e2f2, dim #bcd2e8, accent #4db8ff`. Body text 15-16px, bright. Do NOT use the dim `#8aa4bf` for readable text (already swept out for being too dim).

**Free-tool pattern** (the repeatable money pattern): data config in `src/lib/data/*.ts` → ungated API route under `src/app/api/*` (IP rate-limited in-memory, cheap Haiku `claude-haiku-4-5-20251001`, low max_tokens) → client widget in `src/components/*` → page(s) that render it → add to sitemap → add internal links. Pass already-shown results back as `exclude` so re-rolls stay fresh. Always end results with a funnel CTA to `/sign-up` ("Start free, 2 scripts").

**Internal linking matters for indexing:** every new section MUST be linked from the homepage footer (`src/app/page.tsx`) and the pillar footers (`src/components/PillarHub.tsx`). The homepage is the highest-authority page; a footer link there pulls Google's crawler in fast.

---

## 5. Deploy + verify workflow (hard rules)

- Deploy ONLY via `npx vercel deploy --prod`. Git push does not deploy.
- Run `./node_modules/.bin/tsc --noEmit` first and confirm exit 0 before deploying.
- After deploy, verify live with `curl` (status codes + grep for expected content; POST to API routes to confirm output). The sandboxed browser preview cannot reach the dev server in this environment, so curl against the live site is the verification method.
- `vercel.json` `functions.maxDuration` overrides route-level maxDuration.
- Vercel "Sensitive" env vars return empty from `vercel env pull` by design. Verify values in the dashboard, not the CLI.
- **Preview deploys (`vercel deploy` without `--prod`) currently 500 on every route** because the Clerk `publishableKey` is set only in the Production env scope, and Clerk runs in middleware on all routes. Until Clerk keys are added to the Preview env scope, verify on production (deploy `--prod`, then curl skripr.app), not on preview URLs.

---

## 6. Indexing / GSC

- GSC: domain property `sc-domain:skripr.app` verified, sitemap submitted. Domain is new (launched ~2026-06-25), so very little is indexed yet. Expect weeks to months. This is normal.
- Manual "Request Indexing" is capped at ~10 URLs/day. Prioritize the highest-volume, highest-intent pages first (the free-tool hubs + heads like `/youtube-tag-generator`, the name-generator hub, the 3 pillars). Let the sitemap pull in the long tail.
- Backlinks + real traffic (Reddit, X, directories) speed indexing more than the request button. CSS/readability changes do NOT require re-indexing; only content changes do.

---

## 7. Keyword research: built vs remaining

- BUILT: Channel Name Generator (~49k/mo), SEO Toolkit (~99k/mo). Both tool-intent, low-competition, product-backed, with the tightest funnel fit.
- DEPRIORITIZED: a "promote / grow / go viral" cluster (~124k/mo, broad) — informational intent that overlaps existing `/youtube-strategy` + `/youtube-video-ideas`, and it is a content grind, not a tool. Lower ROI than tools.
- Method that has been working: find clusters that are (1) high combined volume, (2) tool-intent (a generator beats a blog post), (3) low competition, (4) backed by an engine Skripr already ships, (5) tight product-to-funnel fit. Rank candidate pillars by those.

---

## 8. The SEO system (lean v1, built 2026-06-28)

The workstream now runs as a pipeline, not ad-hoc. Use it.
- **`/seo-page <keyword>`** (`.claude/commands/seo-page.md`) — orchestrator. Runs opportunity check → NexLev-grounded research (the Creator Intent Engine) → brief → write → voice QA → SEO QA → build → typecheck → **human review (mandatory stop)** → deploy → verify → log.
- **`seo-page-patterns` skill** — how to build each page type correctly in this modified-Next repo. Auto-loaded by the command; reflects §4 above.
- **`seo-voice-qa` skill** — the final voice + mechanism-accuracy gate. Reflects §2 above.
- **`docs/seo-opportunities.json`** — the keyword/opportunity ledger. Check before building, append after.
- **`docs/skripr-indexing-plan.md`** — the current #1 priority: getting the existing ~64 URLs crawled. Indexing is the bottleneck, not page count. Work this before adding pages.

Design note: this deliberately collapses a maximalist "40-agent" vision into a few skills + one orchestrator + the NexLev data we already have. The Growth/Refresh/Learning cron layer is intentionally deferred until GSC has data to learn from.

## 9. Pointers
- Full project state (product, launch, pricing, engine, all features): `docs/skripr-status.md`.
- Voice bible (read before writing any copy): `docs/skripr-voice.md`.
- This brief is SEO-scoped. For product/engine questions, defer to the status doc.

---
*Maintained for the Skripr SEO workstream (skripr.app).*
