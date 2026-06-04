import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Article, articles } from "../articles";
import { ArticleCTA, RelatedArticles, TableOfContents, ArticleFAQ, renderMarkdown } from "../ArticleTemplate";

export async function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find(a => a.slug === slug);
  if (!article) return {};

  return {
    title: article.metaTitle,
    description: article.metaDescription,
    openGraph: {
      title: article.metaTitle,
      description: article.metaDescription,
      type: "article",
      url: `https://skripr.vercel.app/youtube-strategy/${article.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: article.metaTitle,
      description: article.metaDescription,
    },
    alternates: {
      canonical: `https://skripr.vercel.app/youtube-strategy/${article.slug}`,
    },
  };
}

const articleFAQs: Record<string, { q: string; a: string }[]> = {
  "niche-crossover-strategy": [
    { q: "Is niche crossover the same as making content in multiple niches?", a: "No. Niche crossover is strategic — you're combining two adjacent niches into single videos that appeal to both audiences. Making content in multiple niches means switching between unrelated topics, which confuses the algorithm." },
    { q: "How many adjacent niches should I target?", a: "Start with 1-2 adjacent niches. Once you've validated crossover content works for your channel, expand to 3-4. Too many at once dilutes your positioning." },
    { q: "Does niche crossover work for small channels?", a: "It works especially well for small channels. When you have fewer subscribers, the algorithm is still figuring out who to show your content to. Crossover content gives it multiple recommendation graphs to test in." },
  ],
  "reverse-engineer-viral-videos": [
    { q: "Is reverse engineering the same as copying?", a: "No. You're borrowing the structural framework — the hook type, open loop placement, pacing — not the content itself. It's like using the same story structure as a bestselling novel but writing your own story." },
    { q: "How many videos should I analyze before creating?", a: "Analyze at least 5-10 videos in your niche. One video might be an anomaly. Patterns across multiple videos reveal the structural formulas that consistently work." },
    { q: "Can I use this for Shorts too?", a: "Yes, but the structure is compressed. Shorts hooks need to hit in 1-2 seconds, and the entire video is the payoff. The principles are the same — just faster." },
  ],
  "title-words-that-convert": [
    { q: "Do power words work in every niche?", a: "The specific words that work best vary by niche, but the principle is universal. S-tier words like 'proven,' 'secret,' and 'mistake' perform well across all niches. Skripr's Viral Magnet Words are ranked by niche-specific CTR data." },
    { q: "Should I use power words in every title?", a: "Use them strategically, not in every title. If every title sounds like clickbait, viewers learn to ignore your titles. Mix optimized titles with straightforward ones." },
    { q: "How much does CTR actually affect my channel growth?", a: "CTR is the first gate. If nobody clicks, nobody watches, and the algorithm never gets retention data to work with. A 2% CTR vs 8% CTR on the same impression volume means 4x the views from the same number of recommendations." },
  ],
  "retention-optimization": [
    { q: "What's a good retention rate on YouTube?", a: "50%+ average view duration is solid. 60%+ is excellent. 70%+ is exceptional and will trigger aggressive algorithm recommendations. The first 30 seconds are the most critical — if you keep 70%+ past 30 seconds, you're in great shape." },
    { q: "Do open loops work for educational content?", a: "Absolutely. 'The third study I'm about to show you contradicts everything you've heard' is an open loop in an educational context. The technique works for any content type." },
    { q: "How do I know if my re-hooks are working?", a: "Check your retention graph in YouTube Studio. If you see small bumps at regular intervals (every 30-45 seconds), your re-hooks are working. If the line is a steady decline, you need more frequent or stronger re-hooks." },
  ],
  "find-your-niche": [
    { q: "Can I change my niche later?", a: "Yes, but it's costly. The algorithm has already categorized your channel. A complete niche reset means starting from scratch with recommendations. Niche bending (expanding into adjacent niches) is a better strategy than switching." },
    { q: "How long should I test a niche before deciding?", a: "Give it at least 20-30 videos. The algorithm needs time to understand your content and find the right audience. Most creators quit too early — before the algorithm has enough data to work with." },
    { q: "What if my niche is too competitive?", a: "Go narrower. Instead of finance, try finance for freelancers. Instead of fitness, try fitness for desk workers. A narrower niche means less competition and a more targeted audience." },
  ],
  "niche-bend-examples": [
    { q: "Do I need a big channel for niche bending to work?", a: "No. Niche bending works at any channel size. In fact, it's most powerful for small channels because you're accessing recommendation graphs your competitors haven't discovered yet." },
    { q: "How many niche bends should I try at once?", a: "Start with one. Create 3-5 videos testing a single crossover. If the data shows it's working (higher CTR, good retention), expand. Don't dilute your channel with too many experiments at once." },
  ],
  "adjacent-niches": [
    { q: "What's the difference between adjacent niches and sub-niches?", a: "A sub-niche is a narrower version of your current niche (finance → personal finance for freelancers). An adjacent niche is a neighboring topic that overlaps with your audience (finance → productivity). Both reduce competition, but adjacent niches open entirely new recommendation graphs." },
    { q: "How do I know if an adjacent niche is worth pursuing?", a: "Score it on audience overlap, search volume, and competition. If the combined score is above 20 out of 30, it's worth testing with 3-5 videos." },
  ],
  "viral-video-formula": [
    { q: "Can any topic go viral with the right structure?", a: "Structure dramatically increases your chances, but topic still matters. The best combination is a genuinely useful topic with a viral structure. Great structure on a topic nobody cares about won't go viral." },
    { q: "How fast can I learn to apply the viral video formula?", a: "The formulas are simple enough to learn in one afternoon. The skill is in execution — writing hooks that feel natural, placing open loops that create real curiosity, and pacing your content for retention. Practice it on every video." },
  ],
  "competitor-script-analysis": [
    { q: "Is analyzing competitor scripts considered stealing?", a: "No. You're studying publicly available content to learn structural patterns. Every writer reads other writers. Every filmmaker watches other filmmakers. Analysis is how you learn the craft." },
    { q: "How many competitor videos should I analyze?", a: "At least 5-10. One video might be an anomaly. Patterns across multiple videos reveal what consistently works versus what was a one-time success." },
  ],
  "hook-analysis": [
    { q: "What's the most common hook mistake?", a: "Starting with 'Hey guys, welcome back to my channel.' The viewer doesn't care about your channel yet. Give them a reason to stay in the first 3 seconds — a stat, a bold claim, a question, or a story opening." },
    { q: "Can I use the same hook type for every video?", a: "You can, but you shouldn't. Different content types call for different hooks. Educational content works best with stat hooks or question hooks. Opinion content works best with contrarian hooks. Match the hook to the content." },
  ],
  "ctr-optimization": [
    { q: "What's more important — CTR or retention?", a: "Both matter, but CTR is the first gate. If nobody clicks, nobody watches, and the algorithm never gets retention data. Optimize CTR first (titles, thumbnails), then optimize retention (script structure)." },
    { q: "How much can power words actually increase CTR?", a: "S-tier power words like 'proven,' 'secret,' and 'mistake' can increase CTR by 15-30% compared to generic titles. The exact lift depends on your niche, but the principle is consistent across all categories." },
  ],
  "title-formulas": [
    { q: "Should I use a title formula for every video?", a: "Not necessarily. Formulas are templates, not rules. Use them when you're unsure how to title a video. As you get better at writing titles, you'll naturally blend multiple formulas or create your own." },
    { q: "Does title length affect CTR?", a: "Yes. Keep titles under 60 characters so they don't get cut off on mobile. Longer titles still display on desktop, but mobile viewers (the majority) will see a truncated version." },
  ],
  "power-words-youtube": [
    { q: "Are power words the same as clickbait?", a: "No. Clickbait makes promises it doesn't keep. Power words make your real content more compelling. '7 Proven YouTube Hooks That Triple Retention' is specific and deliverable. 'This will blow your mind' is clickbait." },
    { q: "Do power words work for all languages?", a: "The concept works in every language, but the specific words that trigger emotional responses vary by language and culture. Start with these English power words and test what works for your specific audience." },
  ],
  "open-loops": [
    { q: "Do open loops work for long-form content (20+ minutes)?", a: "Yes, even more so. Long videos need more open loops to maintain momentum. Aim for a new open loop every 60-90 seconds in long-form content. The 2:1 rule (plant 2, close 1) applies regardless of video length." },
    { q: "Is there such a thing as too many open loops?", a: "Yes. If you plant 10 open loops and close none, the viewer feels overwhelmed and loses trust. The 2:1 ratio is the sweet spot — enough to maintain curiosity, not so many that nothing feels resolved." },
  ],
  "script-structure": [
    { q: "Does this structure work for all video types?", a: "The 6-part structure works for 90% of YouTube content. Tutorials, listicles, reviews, commentary, and educational videos all benefit. The only exceptions are pure entertainment content like vlogs or sketch comedy." },
    { q: "How long should each part of the script be?", a: "Hook: 3 seconds. Setup: 12 seconds. Stakes: 15 seconds. Body: varies by video length. Payoff: 30 seconds. CTA: 10 seconds. Adjust based on your total video length, but keep the hook under 3 seconds no matter what." },
  ],
  "first-100-subscribers": [
    { q: "Is it normal to have 0 subscribers after 10 videos?", a: "Completely normal. Most channels don't see subscriber growth until video 20-30. The algorithm needs time to understand your content and find the right audience. Keep publishing consistently." },
    { q: "Should I buy subscribers to reach 100 faster?", a: "No. Botted subscribers don't watch your videos, don't generate watch hours, and YouTube can detect and penalize them. Organic growth is slower but real." },
  ],
  "adsense-requirements": [
    { q: "Can I monetize with Shorts instead of long-form?", a: "Yes. You need 10 million Shorts views in the last 90 days instead of 4,000 watch hours. Many creators find the Shorts route faster because Shorts views accumulate quickly with consistent posting." },
    { q: "What happens if I lose subscribers after monetization?", a: "As long as you stay above 1,000 subscribers and 4,000 watch hours, you stay monetized. If you drop below, you have a grace period to recover before revenue stops." },
  ],
  "affiliate-marketing-youtube": [
    { q: "Do I need a lot of views for affiliate marketing to work?", a: "No. Affiliate marketing works even with small audiences if your niche is right. A video with 1,000 views in a high-intent niche (like software reviews) can generate more affiliate revenue than a video with 100,000 views in a low-intent niche." },
    { q: "Do I have to verbally disclose affiliate links in every video?", a: "FTC requires disclosure. The easiest approach is to say 'This video contains affiliate links' at the start and include 'Contains affiliate links' in the description. Do this for every video with affiliate links." },
  ],
  "how-to-monetize-fast": [
    { q: "Can I really make money on YouTube with 0 subscribers?", a: "Yes. Affiliate marketing, digital products, freelance services, and UGC work at 0 subscribers. AdSense requires 1,000 subscribers, but it should be your last revenue stream to activate, not your first." },
    { q: "Which revenue stream should I start with?", a: "Affiliate marketing. It's free to start (Amazon Associates), requires no audience, and teaches you to create content that converts. Add digital products and sponsorships as you grow." },
  ],
};

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = articles.find(a => a.slug === slug);
  if (!article) notFound();

  const faqs = articleFAQs[article.slug] || [];
  const relatedInCluster = articles.filter(a => a.cluster === article.cluster && a.slug !== article.slug);
  const relatedOther = articles.filter(a => a.cluster !== article.cluster);
  const allRelated = [...relatedInCluster, ...relatedOther].slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription,
    author: {
      "@type": "Organization",
      name: "Skripr",
      url: "https://skripr.vercel.app",
    },
    publisher: {
      "@type": "Organization",
      name: "Skripr",
      logo: {
        "@type": "ImageObject",
        url: "https://skripr.vercel.app/icon.svg",
      },
    },
    mainEntityOfPage: `https://skripr.vercel.app/youtube-strategy/${article.slug}`,
    datePublished: "2026-06-04",
    dateModified: "2026-06-04",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb nav */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 0" }}>
        <nav style={{ fontSize: 13, color: "#64748b" }}>
          <Link href="/" style={{ color: "#64748b", textDecoration: "none" }}>Home</Link>
          <span style={{ margin: "0 8px" }}>/</span>
          <Link href="/youtube-strategy" style={{ color: "#64748b", textDecoration: "none" }}>YouTube Strategy</Link>
          <span style={{ margin: "0 8px" }}>/</span>
          <span style={{ color: "#94a3b8" }}>{article.cluster}</span>
        </nav>
      </div>

      {/* Article header */}
      <article style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: 999,
          background: "rgba(99,102,241,0.10)",
          border: "1px solid rgba(99,102,241,0.20)",
          color: "#a5b4fc",
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 20,
        }}>
          {article.cluster}
        </div>

        <h1 style={{
          fontSize: "clamp(28px,4vw,42px)",
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: "-0.03em",
          color: "#f1f5f9",
          marginBottom: 16,
        }}>
          {article.title}
        </h1>

        <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.7, marginBottom: 32 }}>
          {article.metaDescription}
        </p>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          paddingBottom: 32,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 32,
          fontSize: 13,
          color: "#475569",
        }}>
          <span>Skripr Team</span>
          <span>·</span>
          <span>Jun 4, 2026</span>
          <span>·</span>
          <span>{Math.ceil(article.content.split(" ").length / 200)} min read</span>
        </div>

        {/* Table of contents */}
        <TableOfContents content={article.content} />

        {/* Article body */}
        <div
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
        />

        {/* FAQ section */}
        <ArticleFAQ faqs={faqs} />

        {/* CTA */}
        <ArticleCTA article={article} />

        {/* Related articles */}
        <div style={{ marginTop: 48 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 16 }}>
            Related Articles
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {allRelated.map(a => (
              <Link
                key={a.slug}
                href={`/youtube-strategy/${a.slug}`}
                style={{
                  padding: "16px 18px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                <p style={{ fontSize: 12, color: "#818cf8", fontWeight: 600, marginBottom: 6 }}>
                  {a.cluster}
                </p>
                <p style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
                  {a.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </>
  );
}
