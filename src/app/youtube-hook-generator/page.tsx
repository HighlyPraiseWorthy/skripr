import { Metadata } from "next";
import SeoToolPage from "@/components/SeoToolPage";
import { getSeoTool } from "@/lib/data/seo-tools";

const tool = getSeoTool("youtube-hook-generator")!;
const url = `https://skripr.app/${tool.slug}`;

export const metadata: Metadata = {
  title: tool.metaTitle,
  description: tool.metaDescription,
  openGraph: { title: tool.metaTitle, description: tool.ogDescription, type: "website", url },
  twitter: { card: "summary_large_image", title: tool.metaTitle, description: tool.ogDescription },
  alternates: { canonical: url },
};

export default function Page() {
  return <SeoToolPage tool={tool} />;
}
