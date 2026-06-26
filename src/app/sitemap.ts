import { MetadataRoute } from "next";
import { articles } from "./youtube-strategy/articles";
import { comparisons } from "./compare/comparisons";
import { roundups } from "./best/roundups";

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
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/sign-up`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
