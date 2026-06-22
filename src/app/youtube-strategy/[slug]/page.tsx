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
      url: `https://skripr.app/youtube-strategy/${article.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: article.metaTitle,
      description: article.metaDescription,
    },
    alternates: {
      canonical: `https://skripr.app/youtube-strategy/${article.slug}`,
    },
  };
}

const articleFAQs: Record<string, { q: string; a: string }[]> = {
  "how-to-start-a-faceless-youtube-channel": [
    { q: "How much does it cost to start a faceless YouTube channel?", a: "You can start for very little: a script tool, a voiceover option, and free or low-cost visuals. Your biggest investment is time and consistency, not money." },
    { q: "Do faceless channels get monetized?", a: "Yes. Faceless channels can join the YouTube Partner Program like any other, as long as the content is original and follows the guidelines." },
    { q: "How many videos before a faceless channel grows?", a: "Plan for at least 20 to 30 consistent uploads so the algorithm has enough data to find your audience." },
  ],
  "how-to-script-a-youtube-video": [
    { q: "How do you script a YouTube video step by step?", a: "Start with a hook, outline three to five points, write the body for the ear with re-hooks, plant and resolve open loops, then end with one clear call to action." },
    { q: "Should I script every YouTube video word for word?", a: "On-camera creators often script the hook and key beats and improvise the rest. Faceless and voiceover videos are usually scripted fully, because the script is the entire video." },
    { q: "How long should a YouTube script be?", a: "About 130 words per minute of finished video, so a 10-minute video runs around 1,300 words." },
  ],
  "how-to-grow-a-small-youtube-channel": [
    { q: "How do small YouTube channels grow in 2026?", a: "By making videos people finish. Strong hooks, clear packaging, a focused niche, topics with demand, and consistent uploads drive growth more than any trick." },
    { q: "Why is my small channel not growing?", a: "Usually weak retention, vague titles and thumbnails, an unfocused niche, or too few uploads for the algorithm to learn. Fix hooks and packaging first." },
    { q: "How often should a small channel post?", a: "Consistently enough to gather data and stay in the algorithm's view. A steady schedule you can sustain beats a burst you cannot." },
  ],
  "youtube-video-ideas-when-stuck": [
    { q: "What should I make when I have no YouTube ideas?", a: "Start from proven videos in your niche, bend formats from adjacent niches, and use simple frameworks like the mistake, the contrarian take, and the breakdown." },
    { q: "How do YouTubers never run out of ideas?", a: "They generate ideas from what already works and from multiple angles on the same topic, rather than inventing from scratch." },
    { q: "How do I know if a video idea is good?", a: "Check that the topic already has demand. If similar videos get real views in your niche, the idea is validated before you make it." },
  ],
  "how-to-avoid-demonetization-on-youtube": [
    { q: "What causes demonetization on YouTube?", a: "Content advertisers avoid: strong profanity, graphic violence, carelessly handled sensitive topics, adult content, and reckless controversy, especially early in the video or in the title." },
    { q: "Can you fix a demonetized video?", a: "You can edit and resubmit for review, but the strongest earning window is often at launch. Checking the script before you publish avoids the problem." },
    { q: "How do I keep my videos advertiser-friendly?", a: "Handle sensitive topics with context and a measured tone, keep the first 30 seconds and the title clean, and review the script against YouTube's guidelines before recording. Skripr's Compliance check does this for you." },
  ],
  "how-to-write-a-faceless-youtube-script": [
    { q: "How long should a faceless YouTube script be?", a: "Plan for roughly 130 words per minute of finished video, so a 10-minute video is about 1,300 words. Match length to the depth of the topic, not a fixed word count." },
    { q: "Do I need a script for every faceless video?", a: "Yes. A faceless video has nothing but the script and the visuals, so a tight script is the single biggest lever on retention." },
    { q: "Can AI write a faceless YouTube script?", a: "Yes. Tools like Skripr generate full voiceover-ready scripts with hooks and retention structure built in, then you edit for your voice and facts." },
  ],
  "best-faceless-youtube-niches-2026": [
    { q: "What is the most profitable faceless niche?", a: "Finance, business, and tech tend to have the highest ad rates, but profit also depends on retention and how consistently you publish. A high-retention niche you can sustain often beats a high-RPM niche you abandon." },
    { q: "Which faceless niche is easiest to start?", a: "Educational explainers, history, and story-based channels are among the easiest, because they rely on research, a script, and stock or simple visuals." },
    { q: "Do faceless niches still work in 2026?", a: "Yes. Faceless channels keep growing across education, true crime, finance, and storytelling. The bar is quality scripting, not whether a niche looks saturated." },
  ],
  "best-ai-tools-for-faceless-youtube": [
    { q: "What is the best AI tool for faceless YouTube scripts?", a: "A purpose-built script tool like Skripr is stronger than a general chatbot because it builds retention structure and voice matching in, rather than producing a generic draft." },
    { q: "Can I run a faceless channel entirely with AI?", a: "You can use AI for scripting, voiceover, visuals, and editing, but you still direct it, fact-check, and edit. AI speeds the work, it does not replace judgment." },
    { q: "Are AI voices good enough for YouTube?", a: "Yes. Modern AI voices are natural enough for full narration on faceless channels, especially when paired with a well-written script." },
  ],
  "free-youtube-script-template": [
    { q: "Is there a free YouTube script template I can copy?", a: "Yes. The structure in this guide is free to copy: hook, setup, body with re-hooks, open loops, payoff, and one call to action." },
    { q: "How do I write a YouTube script from a template?", a: "Fill each section in order, lead with a strong hook, keep one idea per body section, plant and resolve open loops, and read it out loud to keep it natural." },
    { q: "How long should a YouTube script be?", a: "Plan for roughly 130 words per minute of finished video. A 10-minute video is about 1,300 words." },
  ],
  "how-to-get-your-first-1000-subscribers": [
    { q: "How long does it take to get 1,000 subscribers?", a: "It varies widely. With consistent, well-made videos in a niche that has demand, many creators reach it in a few months. Quitting early is the most common reason people never get there." },
    { q: "Do I need 1,000 subscribers to make money?", a: "You need 1,000 subscribers plus watch-time or Shorts thresholds to join the YouTube Partner Program. Many creators also earn through affiliates and sponsorships before then." },
    { q: "What gets the first 1,000 subscribers fastest?", a: "Strong hooks, topics with proven demand, consistent publishing, and videos people finish. Retention drives everything." },
  ],
  "how-to-beat-the-youtube-algorithm": [
    { q: "Can a small channel beat the YouTube algorithm?", a: "Yes. The algorithm favors videos that get clicks and hold attention, regardless of channel size. Strong hooks, titles, and retention let small channels get recommended." },
    { q: "What does the YouTube algorithm reward most in 2026?", a: "Click-through rate and watch time. Together they tell YouTube your video satisfies viewers, so it shows it to more people." },
    { q: "Why are my videos not getting views?", a: "Usually weak packaging in the title and thumbnail, weak retention, an unclear niche, or too few uploads for the algorithm to learn from. Fix hooks and titles first." },
  ],
  "niche-crossover-strategy": [
    { q: "Is niche crossover the same as making content in multiple niches?", a: "No. Niche crossover is strategic, you're combining two adjacent niches into single videos that appeal to both audiences. Making content in multiple niches means switching between unrelated topics, which confuses the algorithm." },
    { q: "How many adjacent niches should I target?", a: "Start with 1-2 adjacent niches. Once you've validated crossover content works for your channel, expand to 3-4. Too many at once dilutes your positioning." },
    { q: "Does niche crossover work for small channels?", a: "It works especially well for small channels. When you have fewer subscribers, the algorithm is still figuring out who to show your content to. Crossover content gives it multiple recommendation graphs to test in." },
  ],
  "reverse-engineer-viral-videos": [
    { q: "Is reverse engineering the same as copying?", a: "No. You're borrowing the structural framework, the hook type, open loop placement, pacing, not the content itself. It's like using the same story structure as a bestselling novel but writing your own story." },
    { q: "How many videos should I analyze before creating?", a: "Analyze at least 5-10 videos in your niche. One video might be an anomaly. Patterns across multiple videos reveal the structural formulas that consistently work." },
    { q: "Can I use this for Shorts too?", a: "Yes, but the structure is compressed. Shorts hooks need to hit in 1-2 seconds, and the entire video is the payoff. The principles are the same, just faster." },
  ],
  "title-words-that-convert": [
    { q: "Do power words work in every niche?", a: "The specific words that work best vary by niche, but the principle is universal. S-tier words like 'proven,' 'secret,' and 'mistake' perform well across all niches. Skripr's Viral Magnet Words are ranked by niche-specific CTR data." },
    { q: "Should I use power words in every title?", a: "Use them strategically, not in every title. If every title sounds like clickbait, viewers learn to ignore your titles. Mix optimized titles with straightforward ones." },
    { q: "How much does CTR actually affect my channel growth?", a: "CTR is the first gate. If nobody clicks, nobody watches, and the algorithm never gets retention data to work with. A 2% CTR vs 8% CTR on the same impression volume means 4x the views from the same number of recommendations." },
  ],
  "retention-optimization": [
    { q: "What's a good retention rate on YouTube?", a: "50%+ average view duration is solid. 60%+ is excellent. 70%+ is exceptional and will trigger aggressive algorithm recommendations. The first 30 seconds are the most critical, if you keep 70%+ past 30 seconds, you're in great shape." },
    { q: "Do open loops work for educational content?", a: "Absolutely. 'The third study I'm about to show you contradicts everything you've heard' is an open loop in an educational context. The technique works for any content type." },
    { q: "How do I know if my re-hooks are working?", a: "Check your retention graph in YouTube Studio. If you see small bumps at regular intervals (every 30-45 seconds), your re-hooks are working. If the line is a steady decline, you need more frequent or stronger re-hooks." },
  ],
  "find-your-niche": [
    { q: "Can I change my niche later?", a: "Yes, but it's costly. The algorithm has already categorized your channel. A complete niche reset means starting from scratch with recommendations. Niche bending (expanding into adjacent niches) is a better strategy than switching." },
    { q: "How long should I test a niche before deciding?", a: "Give it at least 20-30 videos. The algorithm needs time to understand your content and find the right audience. Most creators quit too early, before the algorithm has enough data to work with." },
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
    { q: "How fast can I learn to apply the viral video formula?", a: "The formulas are simple enough to learn in one afternoon. The skill is in execution, writing hooks that feel natural, placing open loops that create real curiosity, and pacing your content for retention. Practice it on every video." },
  ],
  "competitor-script-analysis": [
    { q: "Is analyzing competitor scripts considered stealing?", a: "No. You're studying publicly available content to learn structural patterns. Every writer reads other writers. Every filmmaker watches other filmmakers. Analysis is how you learn the craft." },
    { q: "How many competitor videos should I analyze?", a: "At least 5-10. One video might be an anomaly. Patterns across multiple videos reveal what consistently works versus what was a one-time success." },
  ],
  "hook-analysis": [
    { q: "What's the most common hook mistake?", a: "Starting with 'Hey guys, welcome back to my channel.' The viewer doesn't care about your channel yet. Give them a reason to stay in the first 3 seconds, a stat, a bold claim, a question, or a story opening." },
    { q: "Can I use the same hook type for every video?", a: "You can, but you shouldn't. Different content types call for different hooks. Educational content works best with stat hooks or question hooks. Opinion content works best with contrarian hooks. Match the hook to the content." },
  ],
  "ctr-optimization": [
    { q: "What's more important, CTR or retention?", a: "Both matter, but CTR is the first gate. If nobody clicks, nobody watches, and the algorithm never gets retention data. Optimize CTR first (titles, thumbnails), then optimize retention (script structure)." },
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
    { q: "Is there such a thing as too many open loops?", a: "Yes. If you plant 10 open loops and close none, the viewer feels overwhelmed and loses trust. The 2:1 ratio is the sweet spot, enough to maintain curiosity, not so many that nothing feels resolved." },
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
      url: "https://skripr.app",
    },
    publisher: {
      "@type": "Organization",
      name: "Skripr",
      logo: {
        "@type": "ImageObject",
        url: "https://skripr.app/icon.svg",
      },
    },
    mainEntityOfPage: `https://skripr.app/youtube-strategy/${article.slug}`,
    datePublished: "2026-06-04",
    dateModified: "2026-06-04",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }) }}
        />
      )}

      {/* Breadcrumb nav */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 0" }}>
        <nav style={{ fontSize: 13, color: "#8aa4bf" }}>
          <Link href="/" style={{ color: "#8aa4bf", textDecoration: "none" }}>Home</Link>
          <span style={{ margin: "0 8px" }}>/</span>
          <Link href="/youtube-strategy" style={{ color: "#8aa4bf", textDecoration: "none" }}>YouTube Strategy</Link>
          <span style={{ margin: "0 8px" }}>/</span>
          <span style={{ color: "#bcd2e8" }}>{article.cluster}</span>
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
          background: "rgba(77,184,255,0.10)",
          border: "1px solid rgba(77,184,255,0.20)",
          color: "#7ed8ff",
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
          color: "#e8edf5",
          marginBottom: 16,
        }}>
          {article.title}
        </h1>

        <p style={{ fontSize: 16, color: "#8aa4bf", lineHeight: 1.7, marginBottom: 32 }}>
          {article.metaDescription}
        </p>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          paddingBottom: 32,
          borderBottom: "1px solid rgba(77,184,255,0.06)",
          marginBottom: 32,
          fontSize: 13,
          color: "#5a6b7d",
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
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#e8edf5", marginBottom: 16 }}>
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
                  background: "rgba(77,184,255,0.03)",
                  border: "1px solid rgba(77,184,255,0.07)",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                <p style={{ fontSize: 12, color: "#7ed8ff", fontWeight: 600, marginBottom: 6 }}>
                  {a.cluster}
                </p>
                <p style={{ fontSize: 14, color: "#d2e2f2", fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
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
