import { MetadataRoute } from "next";
import { articles } from "./youtube-strategy/articles";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://skripr.vercel.app";

  const articleUrls = articles.map((article) => ({
    url: `${baseUrl}/youtube-strategy/${article.slug}`,
    lastModified: new Date("2026-06-04"),
    changeFrequency: "monthly" as const,
    priority: 0.7,
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
    ...articleUrls,
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sign-up`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
