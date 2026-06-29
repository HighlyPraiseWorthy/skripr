---
name: seo-page-patterns
description: >
  How to build a new SEO page inside the Skripr repo correctly. Use whenever
  adding or editing a pillar, content hub, guide, comparison page, roundup, free
  tool, or programmatic [slug] page on skripr.app. Encodes the modified-Next.js
  conventions, the repeatable free-tool money pattern, JSON-LD, the dark palette,
  and the mandatory internal-linking + sitemap steps. Mirror existing files; do
  not invent Next.js conventions from memory.
---

# Skripr SEO page patterns

This is a MODIFIED Next.js (see `AGENTS.md`). APIs and conventions differ from
training data. **Before writing any Next.js code, read the relevant guide in
`node_modules/next/dist/docs/` and mirror an existing page of the same type.**
Read `docs/skripr-seo-brief.md` first for full context if you have not.

## Pick the page type, then copy its template

| Type | Hub + data file | Renderer |
|---|---|---|
| Pillar | page + co-located data | `src/components/PillarHub.tsx` |
| Guide | `src/app/youtube-strategy/articles.ts` | `[slug]/page.tsx` + `ArticleTemplate.tsx` |
| Comparison | `src/app/compare/comparisons.ts` | `compare/[slug]/page.tsx` |
| Roundup | `src/app/best/roundups.ts` | `best/[slug]/page.tsx` |
| Free tool | `src/lib/data/seo-tools.ts` (canonical) | `SeoToolPage.tsx` + `SeoToolWidget.tsx` + `/api/*` |

**Adding a spoke to an existing cluster = add an entry to the data file. Nothing
else.** `generateStaticParams` reads the array; `sitemap.ts` auto-includes it.
Only build new files when starting a genuinely new page type.

## Modified-Next conventions confirmed in-repo (do not deviate)

- Dynamic params are a Promise: `{ params }: { params: Promise<{ slug: string }> }`, then `const { slug } = await params;`.
- `export function generateStaticParams()` returns the slug array from the data file.
- `export async function generateMetadata({ params })` for per-page title/description/OG/canonical. Static pages use `export const metadata: Metadata = {...}`.
- JSON-LD: `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(x) }} />`. Use WebApplication (tools), Article (guides/pillars), FAQPage, BreadcrumbList, ItemList (roundups).

## The free-tool pattern (the repeatable money pattern)

1. Data config in `src/lib/data/*.ts` (mirror `seo-tools.ts` shape: slug = exact-match URL, h1, metaTitle, metaDescription, intro, body[], tip, faqs[]).
2. Ungated API route under `src/app/api/*`. IP rate-limited (in-memory, best-effort), cheap Haiku `claude-haiku-4-5-20251001`, low `max_tokens`.
3. Client widget in `src/components/*`. Pass already-shown results back as `exclude` so re-rolls stay fresh and never repeat.
4. Page(s) render the widget. Always end results with a funnel CTA to `/sign-up` ("Start free, 2 scripts").

## Dark palette (use these exact values)

`bg #080c12, border #1a2840, text #e8edf5, muted #d2e2f2, dim #bcd2e8, accent #4db8ff`.
Body text 15-16px, bright. **Never** use `#8aa4bf` for readable text (too dim, already swept out).

## Mandatory steps for every new page (skip none)

1. Add to the data file (or create the new type by mirroring an existing one).
2. Confirm it lands in `src/app/sitemap.ts` (data-driven; new data-file entries auto-include — verify the URL appears).
3. **Internal links (this is what gets a new domain crawled):** link the new page from the homepage footer (`src/app/page.tsx`, the link array near line ~1106) AND from the pillar footers (`src/components/PillarHub.tsx`). The homepage is the highest-authority page; a footer link there pulls the crawler in fast.
   - **Tool/money pages MUST be linked DIRECTLY from the homepage footer, not only via their hub.** Evidence (2026-06-28 `/seo-review`): every tool spoke reachable only through its hub had ZERO GSC impressions at day 3, while directly-linked content pages were indexed. Add the spoke itself to the homepage footer array, not just the hub. See `[[seo-opportunities]]` learnings.
4. `./node_modules/.bin/tsc --noEmit` must exit 0 before any deploy.

## Deploy + verify (hard rules)

- Deploy ONLY via `npx vercel deploy --prod`. Git push does not deploy.
- After deploy, verify live with `curl` (status code + grep expected content; POST to API routes to confirm output). The sandboxed browser preview cannot reach the dev server here, so curl against the live site is the verification method.
- `vercel.json` `functions.maxDuration` overrides route-level maxDuration.
