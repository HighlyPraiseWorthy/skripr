import { MetadataRoute } from "next";
import { articles } from "./youtube-strategy/articles";
import { comparisons } from "./compare/comparisons";
import { roundups } from "./best/roundups";
import { NAME_NICHES } from "@/lib/data/channel-name-niches";
import { SEO_TOOLS } from "@/lib/data/seo-tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://skripr.app";

  const articleUrls = articles.map((article) => ({
    url: `${baseUrl}/youtube-strategy/${article.slug}`,
    lastModified: new Date("2026-06-04"),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const comparisonUrls = comparisons.map((c) => ({
    url: `${baseUrl}/compare/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const roundupUrls = roundups.map((r) => ({
    url: `${baseUrl}/best/${r.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const nameNicheUrls = NAME_NICHES.map((n) => ({
    url: `${baseUrl}/youtube-channel-name-generator/${n.id}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const seoToolUrls = SEO_TOOLS.map((t) => ({
    url: `${baseUrl}/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.9,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/youtube-strategy`,
      lastModified: new Date("2026-06-04"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/youtube-scriptwriting`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/faceless-youtube`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/youtube-video-ideas`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/youtube-video-ideas-generator`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...articleUrls,
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...comparisonUrls,
    {
      url: `${baseUrl}/subscribr-alternative`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tubeai-alternative`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/skripr-vs-claude`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/will-ai-replace-youtubers`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/best`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...roundupUrls,
    {
      url: `${baseUrl}/youtube-channel-name-generator`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...nameNicheUrls,
    {
      url: `${baseUrl}/youtube-seo-tools`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...seoToolUrls,
    // /pricing intentionally redirects to /#pricing (homepage section), so it is
    // NOT a standalone indexable page. Kept out of the sitemap to avoid GSC
    // "redirect error". Revisit a real pricing page once the brand has search demand.
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    // /sign-up is a conversion/auth page with no SEO value; kept out of the
    // sitemap so it contains only real, indexable content.
  ];
}
