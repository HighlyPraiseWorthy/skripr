import { MetadataRoute } from "next";
import { articles } from "./youtube-strategy/articles";
import { comparisons } from "./compare/comparisons";
import { roundups } from "./best/roundups";
import { NAME_NICHES } from "@/lib/data/channel-name-niches";
import { SEO_TOOLS } from "@/lib/data/seo-tools";

// ---------------------------------------------------------------------------
// REAL last-modified dates. Do NOT use `new Date()` here.
//
// Using new Date() stamps every URL with the build time, so every deploy told
// Google "all 50 pages changed today". Google ignores lastmod site-wide when it
// is consistently inaccurate, which froze recrawls for 55+ days. Fixed
// 2026-08-22 (which triggered the first tool-page recrawl since launch), then
// SILENTLY REVERTED because the fix was deployed but never git-committed, and a
// later deploy shipped the old new Date() file. Re-applied AND committed to git
// 2026-09-01 so it cannot regress again.
//
// MAINTENANCE: when you genuinely change a page's content, update its date
// below. If a page is not listed, it falls back to its section default, meaning
// "unchanged since launch". An honest lastmod is the only lastmod worth sending.
// ---------------------------------------------------------------------------
const LAUNCH = "2026-06-27"; // original public launch of the SEO surface
const ARTICLES_BASE = "2026-06-04";

const PAGE_UPDATED: Record<string, string> = {
  // Core
  "/": "2026-08-02", // footer restructure + transcript generator link
  "/youtube-scriptwriting": "2026-06-29", // copy sweep
  "/faceless-youtube": "2026-08-02", // YouTube automation reinforcement
  "/youtube-video-ideas": "2026-07-10", // money link to the ideas generator
  "/youtube-strategy": "2026-07-15",

  // Free tools
  "/youtube-transcript-generator": "2026-08-02", // built
  "/youtube-video-ideas-generator": "2026-06-28", // built
  "/why-did-my-video-flop": "2026-08-02",
  "/youtube-seo-tools": "2026-08-02", // hub copy + transcript cross-link
  "/youtube-channel-name-generator": "2026-08-02", // broader keyword retarget

  // Comparison / thesis
  "/compare": "2026-07-10", // Retti added
  "/subscribr-alternative": "2026-06-29",
  "/tubeai-alternative": "2026-06-29",
  "/skripr-vs-claude": "2026-06-29",
  "/will-ai-replace-youtubers": "2026-06-29",
  "/best": "2026-06-29",
  "/contact": LAUNCH,

  // Guides changed after the 2026-06-04 base
  "/youtube-strategy/how-to-avoid-demonetization-on-youtube": "2026-07-13",
  "/youtube-strategy/how-to-grow-a-small-youtube-channel": "2026-07-13",
  "/youtube-strategy/best-faceless-youtube-niches-2026": "2026-07-13",
  "/youtube-strategy/how-to-beat-the-youtube-algorithm": "2026-07-13",
  "/youtube-strategy/adjacent-niches": "2026-07-15",
  "/youtube-strategy/how-to-use-ai-for-youtube": "2026-07-15",
  "/youtube-strategy/title-words-that-convert": "2026-07-06",
  "/youtube-strategy/title-formulas": "2026-07-06",
  "/youtube-strategy/ctr-optimization": "2026-07-06",
  "/youtube-strategy/find-your-niche": "2026-07-06",
  "/youtube-strategy/how-to-start-a-faceless-youtube-channel": "2026-07-06",
  "/youtube-strategy/how-to-write-a-faceless-youtube-script": "2026-06-29",
  "/youtube-strategy/best-ai-tools-for-faceless-youtube": "2026-06-29",
  "/youtube-strategy/free-youtube-script-template": "2026-06-29",
  "/youtube-strategy/youtube-video-ideas-when-stuck": "2026-06-29",

  // Comparison spokes
  "/compare/skripr-vs-retti": "2026-07-10",
};

function modified(path: string, fallback: string = LAUNCH): Date {
  return new Date(PAGE_UPDATED[path] ?? fallback);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://skripr.app";
  const entry = (
    path: string,
    priority: number,
    changeFrequency: "weekly" | "monthly" | "yearly",
    fallback: string = LAUNCH
  ) => ({
    url: path === "/" ? baseUrl : `${baseUrl}${path}`,
    lastModified: modified(path, fallback),
    changeFrequency,
    priority,
  });

  const articleUrls = articles.map((a) =>
    entry(`/youtube-strategy/${a.slug}`, 0.7, "monthly", ARTICLES_BASE)
  );
  // The shared SeoToolPage component changed 2026-08-02 (cross-link anchors),
  // so every tool spoke's rendered HTML changed on that date.
  const seoToolUrls = SEO_TOOLS.map((t) => entry(`/${t.slug}`, 0.9, "monthly", "2026-08-02"));
  const comparisonUrls = comparisons.map((c) => entry(`/compare/${c.slug}`, 0.8, "monthly", "2026-06-29"));
  const roundupUrls = roundups.map((r) => entry(`/best/${r.slug}`, 0.8, "monthly", "2026-06-29"));
  const nameNicheUrls = NAME_NICHES.map((n) =>
    entry(`/youtube-channel-name-generator/${n.id}`, 0.7, "monthly", LAUNCH)
  );

  return [
    entry("/", 1, "weekly"),
    entry("/youtube-strategy", 0.9, "weekly"),
    entry("/youtube-scriptwriting", 0.9, "weekly"),
    entry("/faceless-youtube", 0.9, "weekly"),
    entry("/youtube-video-ideas", 0.9, "weekly"),
    entry("/youtube-transcript-generator", 0.9, "weekly"),
    entry("/youtube-video-ideas-generator", 0.9, "weekly"),
    entry("/why-did-my-video-flop", 0.9, "weekly"),
    ...articleUrls,
    entry("/compare", 0.9, "weekly"),
    ...comparisonUrls,
    entry("/subscribr-alternative", 0.8, "monthly"),
    entry("/tubeai-alternative", 0.8, "monthly"),
    entry("/skripr-vs-claude", 0.8, "monthly"),
    entry("/will-ai-replace-youtubers", 0.7, "monthly"),
    entry("/best", 0.9, "weekly"),
    ...roundupUrls,
    entry("/youtube-channel-name-generator", 0.9, "weekly"),
    ...nameNicheUrls,
    entry("/youtube-seo-tools", 0.9, "weekly"),
    ...seoToolUrls,
    // /pricing intentionally redirects to /#pricing (homepage section), so it is
    // NOT a standalone indexable page. Kept out of the sitemap to avoid GSC
    // "redirect error". Revisit a real pricing page once the brand has search demand.
    entry("/contact", 0.4, "yearly"),
    // /sign-up is a conversion/auth page with no SEO value; kept out of the
    // sitemap so it contains only real, indexable content.
  ];
}
