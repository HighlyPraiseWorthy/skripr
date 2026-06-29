# Skripr indexing acceleration plan

> The actual bottleneck. The site launched ~2026-06-25 with ~10 impressions. It
> does not have a content problem, it has a "Google does not know it exists yet"
> problem. Building more pages before these are crawled wastes the work. Work
> this list first; it is mostly one-time plus a cheap weekly check.

## Priority "Request Indexing" list (GSC caps ~10 URLs/day)

Spend the daily quota on the highest-volume, highest-intent pages first. Let the
sitemap pull in the long tail (the 18 name spokes, the ~33 guides).

Day-by-day, highest value first:
1. `/` (homepage — highest authority, links to everything)
2. `/youtube-seo-tools` (hub, ~99k/mo cluster)
3. `/youtube-tag-generator` (~53k/mo, the single biggest head)
4. `/youtube-channel-name-generator` (hub, ~49k/mo cluster)
5. `/youtube-title-generator` (~23k/mo)
6. `/youtube-description-generator` (~20k/mo)
6b. `/youtube-hook-generator` (added 2026-06-28; reached via the hub, request-index it directly too)
7. `/youtube-scriptwriting` (pillar)
8. `/faceless-youtube` (pillar)
9. `/youtube-video-ideas` (pillar)
10. `/pricing`

Then on following days: `/compare` hub + spokes, `/best` hub + spokes, the
`/youtube-strategy` hub, then the standalone alternative pages. Do NOT spend the
quota on individual long-tail spokes; the sitemap handles those.

## Do NOT re-request indexing for

- CSS / readability / palette changes (not content changes; no re-index needed).
- Pages already indexed and stable.

## Internal-link audit (pulls the crawler through the site)

- [ ] Every built page is linked from the homepage footer (`src/app/page.tsx`, link array ~line 1108).
- [ ] Every built page is linked from the pillar footers (`src/components/PillarHub.tsx`).
- [ ] The two free-tool hubs cross-link to each other and to the nearest pillar.
- [ ] Each guide links out to a relevant tool/comparison (the template auto-adds a comparison link + CTA — confirm the targets are live).
- [ ] No orphan pages: every URL in `sitemap.ts` is reachable by at least one in-content link, not only the sitemap.

## Off-site (moves indexing faster than the request button)

Real traffic and a few real links get a new domain crawled far faster than GSC's
request button. From the launch plan, these are written/queued:
- [ ] Reddit founder-story post (r/SideProject, r/SaaS, r/indiehackers, r/EntrepreneurRideAlong, r/juststart).
- [ ] Product Hunt page (live link back to skripr.app).
- [ ] Free-tool directories + AI-tool directories (the ungated tools are the easiest things to get listed).
- [ ] X / creator communities pointing at the free tools (no login = low friction = shares).

## Weekly check (later, lightweight)

Once GSC has data, a weekly cron can report: which priority URLs are indexed vs
not, impressions/clicks trend, average position, and any new pages still
uncrawled after 2+ weeks (those need an internal link or a manual request).
Hold off building the cron until there is enough data for it to say something.

## Reality check

Indexing a new domain takes weeks to months. This is normal. Early traffic comes
from PH + Reddit, not SEO. The job here is to remove every avoidable reason
Google has not crawled a page yet, then be patient.
