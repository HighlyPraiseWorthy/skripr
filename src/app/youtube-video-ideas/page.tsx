import { Metadata } from "next";
import { PillarHub, PillarData } from "../../components/PillarHub";

export const metadata: Metadata = {
  title: "How to Find Winning YouTube Video Ideas (2026)",
  description:
    "How to find YouTube video ideas that actually get views: outlier videos, reverse-engineering what works, niche research, and validating an idea before you film.",
  openGraph: {
    title: "How to Find Winning YouTube Video Ideas (2026)",
    description: "How to find YouTube video ideas that actually get views, with real examples.",
    type: "article",
    url: "https://skripr.app/youtube-video-ideas",
  },
  twitter: { card: "summary_large_image", title: "How to Find Winning YouTube Video Ideas (2026)", description: "How to find YouTube video ideas that actually get views." },
  alternates: { canonical: "https://skripr.app/youtube-video-ideas" },
};

const data: PillarData = {
  slug: "youtube-video-ideas",
  eyebrow: "Research & Ideas",
  h1: "How to Find Winning YouTube Video Ideas (Without Guessing)",
  intro:
    "The idea decides more than the edit ever will. A great script on a topic nobody wants is a wasted week. This is how to find ideas with proven demand, reverse-engineer why they worked, and validate them before you film.",
  sections: [
    {
      heading: "Stop inventing ideas. Start from what already works",
      body: [
        "The most common mistake is brainstorming ideas from scratch and hoping. The reliable approach is the opposite: find videos that already overperformed in your niche and build on what they proved. You are not copying the content, you are borrowing the validated demand and the structure.",
        "The key signal is the outlier: a video that pulled far more views than its channel's size would predict. An outlier tells you a topic and angle resonated independent of a big subscriber base, which means a smaller channel can win with the same idea executed well.",
      ],
    },
    {
      heading: "Reverse-engineer the win, not just the topic",
      body: [
        "Once you find an outlier, study why it worked: the hook, the title and thumbnail promise, the open loops, and the pacing. Patterns across five to ten videos in a niche reveal the structural formula that consistently performs, rather than a one-off fluke.",
        "Then bend it to your channel. Take the proven structure and apply it to your own topic, or cross it with an adjacent niche to reach an audience your competitors have not targeted. That is how you get the demand of a proven idea with an angle that is still your own.",
      ],
    },
    {
      heading: "Validate before you film",
      body: [
        "Before committing a week to a video, confirm the demand is real. If similar videos in your niche already pull meaningful views, the idea is validated. If nothing comparable exists or everything underperforms, treat that as a warning, not a green field.",
        "This research, finding outliers, understanding why they worked, and validating demand, is the front half of every video. It is also exactly what Skripr speeds up: drop in a channel and it surfaces that channel's outliers, then turns the proven video you pick straight into a script, so research and creation are one step instead of hours in separate tools.",
      ],
    },
  ],
  dataBlock: {
    heading: "Real outliers, the kind Skripr surfaces from a channel",
    intro:
      "These recently started faceless channels each had a video pull far past their subscriber count. Spotting that gap is the whole game, and it is what Skripr's Outlier Finder surfaces when you give it a channel.",
    columns: ["Channel", "Subscribers", "Started", "Breakout video", "Views"],
    rows: [
      ["how really?", "10.1K", "Dec 2025", "Why $2 Trillion Vanishes Every Year", "829K"],
      ["Cosmic Lens", "97.4K", "Oct 2025", "Why Saturn is the Scariest Planet", "6.1M"],
      ["Millionaire Problems", "17.4K", "Apr 2026", "The Economics of Owning a Casino", "451K"],
      ["Money Simplified", "24.5K", "Mar 2026", "The Psychology of People Who Quietly Escape the Rat Race", "538K"],
    ],
    caption: "Source: public YouTube data, faceless niches, June 2026. A live example, refreshed over time.",
  },
  moneyLinks: [
    { href: "/youtube-video-ideas-generator", label: "Video Ideas Generator", desc: "Free tool: get click-worthy ideas for your niche in seconds, then turn one into a script." },
    { href: "/compare/skripr-vs-vidiq", label: "Skripr vs VidIQ", desc: "VidIQ finds keywords. See why creators want research that turns into a script." },
    { href: "/compare/skripr-vs-tubebuddy", label: "Skripr vs TubeBuddy", desc: "Optimization tools manage your channel; this is about finding the next video." },
    { href: "/best/ai-tools-for-faceless-channels", label: "Best Faceless Tools", desc: "The full stack for turning a proven idea into a finished faceless video." },
  ],
  supportingArticles: [
    { href: "/youtube-strategy/youtube-video-ideas-when-stuck", title: "What to Make When You Have No Ideas" },
    { href: "/youtube-strategy/reverse-engineer-viral-videos", title: "How to Reverse-Engineer Viral Videos" },
    { href: "/youtube-strategy/competitor-script-analysis", title: "Competitor Script Analysis" },
    { href: "/youtube-strategy/find-your-niche", title: "How to Find Your Niche" },
    { href: "/youtube-strategy/niche-crossover-strategy", title: "Niche Crossover Strategy" },
    { href: "/youtube-strategy/viral-video-formula", title: "The Viral Video Formula" },
    { href: "/youtube-strategy/how-to-beat-the-youtube-algorithm", title: "How to Beat the YouTube Algorithm" },
  ],
  faqs: [
    { q: "How do YouTubers never run out of ideas?", a: "They generate ideas from what already works, proven videos and outliers in their niche, and from multiple angles on the same topic, rather than inventing from scratch every time." },
    { q: "How do I know if a video idea is good?", a: "Check that the topic already has demand. If similar videos in your niche get real views, the idea is validated before you make it. If nothing comparable performs, that is a warning sign." },
    { q: "What is an outlier video?", a: "A video that pulled far more views than its channel's subscriber count would predict. Outliers reveal topics and angles that resonate independent of channel size, which is exactly what a smaller channel can model." },
    { q: "Is Skripr free to try?", a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly, cancel anytime." },
  ],
  related: [
    { href: "/youtube-scriptwriting", label: "Scriptwriting" },
    { href: "/faceless-youtube", label: "Faceless & Automation" },
  ],
};

export default function Page() {
  return <PillarHub data={data} />;
}
