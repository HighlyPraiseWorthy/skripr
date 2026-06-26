// Programmatic comparison pages for /compare/[slug].
//
// Each entry renders a full, on-brand comparison page in the same design as
// /skripr-vs-claude, but data-driven: adding a new comparison is one entry here.
// Keep claims honest and specific. Lead with what the competitor is genuinely
// good at, then the Skripr wedge. Never invent stats.
//
// Slugs already covered by standalone pages (skripr-vs-claude,
// subscribr-alternative, tubeai-alternative) are intentionally NOT duplicated
// here to avoid cannibalizing them; link to them via `related` instead.

export interface Comparison {
  slug: string;
  competitor: string; // display name, e.g. "VidIQ"
  category: string; // tiny eyebrow label, e.g. "Research & keyword tool"
  intent: "commercial" | "transactional" | "informational"; // internal, for prioritization
  metaTitle: string;
  metaDescription: string;
  ogDescription: string;
  eyebrow: string; // "Skripr vs VidIQ"
  h1: string;
  subhead: string;
  competitorColumn: string; // comparison-table header for the competitor column
  rows: [feature: string, skripr: string, competitor: string][];
  beliefs: { t: string; d: string }[];
  bridge: string; // the fair "they're great at X, but..." paragraph
  closingH1: string;
  faqs: { q: string; a: string }[];
  related: { href: string; label: string }[];
  // Optional proof block populated from real Skripr/NexLev research data.
  // A point-in-time snapshot, refreshed manually. Only set where it earns its place.
  dataBlock?: {
    heading: string;
    intro: string;
    columns: [string, string, string, string];
    rows: [channel: string, subs: string, video: string, views: string][];
    caption: string;
    kicker: string;
  };
}

export const comparisons: Comparison[] = [
  {
    slug: "skripr-vs-vidiq",
    competitor: "VidIQ",
    category: "Research & keyword tool",
    intent: "commercial",
    metaTitle: "Skripr vs VidIQ (2026): Which Writes Better Scripts?",
    metaDescription:
      "VidIQ added AI scripts on top of its research tools. Skripr is built around the script: grounded in proven videos, in your voice, with retention structure. See the difference.",
    ogDescription:
      "VidIQ can generate a script. Skripr writes the one that gets watched. Here is the real difference.",
    eyebrow: "Skripr vs VidIQ",
    h1: "VidIQ can generate a script. Skripr writes the one that gets watched.",
    subhead:
      "VidIQ is a strong research and optimization tool, and it has added AI features that can spin up a script. But that script is a side feature bolted onto a keyword tool: generic, not grounded in your voice, not built around retention. For Skripr, the script is the whole product, written from videos already proven to work in your niche.",
    competitorColumn: "VidIQ",
    rows: [
      ["Keyword and tag research", "Yes", "Yes, its core strength"],
      ["Finds outlier videos worth modeling", "Yes, built in", "Partial, view counts only"],
      ["Generates a script", "Yes, the core product", "Yes, an added AI feature"],
      ["Scripts grounded in proven videos in your niche", "Yes", "No"],
      ["Writes in your voice or a creator's", "Yes (Voice Match)", "Generic by default"],
      ["Retention structure: hooks, re-hooks", "Yes, built in", "Not by design"],
      ["Built for faceless and automation volume", "Yes", "No"],
    ],
    beliefs: [
      {
        t: "A script feature is not a script engine.",
        d: "VidIQ can generate a script, but it is one feature on a research dashboard. Skripr is built end to end around the script, so the hook, the retention beats, the voice, and the research all come from the same purpose-built pipeline.",
      },
      {
        t: "Grounded beats generic.",
        d: "A general AI script is written from nothing in particular. Skripr writes from videos already outperforming in your niche, so the structure you get is proven, not guessed. That grounding is the difference between a draft and a script you can record.",
      },
      {
        t: "Voice and retention are the whole game.",
        d: "Most generated scripts sound the same and decline in attention from the first line. Skripr writes in your voice or a creator's you choose, and builds re-hooks in, because holding the view is the entire job.",
      },
    ],
    bridge:
      "VidIQ is a genuinely useful research tool, and plenty of creators keep it for keyword checks and the extension. Skripr does not try to replace your analytics dashboard. Where it goes deeper is the script itself: grounded in proven videos, in your voice, engineered for retention, because that is the one job Skripr is built for.",
    closingH1: "A script feature, or a script engine.",
    faqs: [
      {
        q: "Is Skripr a VidIQ alternative?",
        a: "They overlap more than they used to, since VidIQ added AI script features. The difference is focus. VidIQ is a research and optimization dashboard with scripting bolted on. Skripr is built end to end around the script, grounded in proven videos, in your voice, with retention structure. Many creators keep VidIQ for keyword checks and use Skripr to actually write the video.",
      },
      {
        q: "Can VidIQ write a YouTube script?",
        a: "Yes, VidIQ has AI features that can generate a script. The gap is depth: that script is a side feature on a keyword tool, so it tends to be generic, not written in your voice, and not built around retention. Skripr is purpose-built for the script and grounds it in videos already working in your niche.",
      },
      {
        q: "Does Skripr do keyword research like VidIQ?",
        a: "Skripr is built around finding videos and ideas already proven to work in your niche, then scripting them. If your goal is to go from a topic to a recorded video, that research is built into the workflow rather than being the end product.",
      },
      {
        q: "Is Skripr free to try?",
        a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly, cancel anytime.",
      },
    ],
    related: [
      { href: "/compare/skripr-vs-tubebuddy", label: "vs TubeBuddy" },
      { href: "/compare/skripr-vs-chatgpt", label: "vs ChatGPT" },
      { href: "/skripr-vs-claude", label: "vs Claude" },
    ],
    dataBlock: {
      heading: "What \"grounded in proven videos\" actually looks like",
      intro:
        "These are real faceless personal-finance channels in Skripr's research data. Each one had a video pull far more views than its subscriber count would predict, the kind of proven structure Skripr writes your script from. A keyword score cannot show you this.",
      columns: ["Channel", "Subscribers", "Breakout video", "Views"],
      rows: [
        ["Fred - Money Historian", "5.1K", "The 2008 Financial Crisis Explained Like You're 5", "241K"],
        ["Money Simplified", "24.5K", "The Psychology of People Who Quietly Escape the Rat Race", "538K"],
        ["Weird Finance", "27.7K", "Why Roblox Lost $282M Despite 70M Daily Users", "392K"],
        ["How Money Works Uncut", "108K", "The New \"Unemployable\" Class", "627K"],
        ["Crayon Capital", "218K", "The Great Depression Explained Like You're 5", "2.5M"],
      ],
      caption:
        "Source: Skripr research data, faceless personal-finance niche, June 2026. A live example, refreshed over time.",
      kicker:
        "VidIQ gives you a keyword and a score. Skripr finds the videos already working in your niche, then writes your script from them.",
    },
  },

  {
    slug: "skripr-vs-tubebuddy",
    competitor: "TubeBuddy",
    category: "Channel management tool",
    intent: "commercial",
    metaTitle: "Skripr vs TubeBuddy (2026): Optimize or Create?",
    metaDescription:
      "TubeBuddy manages and optimizes uploads you already made. Skripr helps you make the next one. See where each tool fits in a creator's workflow.",
    ogDescription:
      "TubeBuddy optimizes the upload. Skripr helps you make the video. Here is the difference.",
    eyebrow: "Skripr vs TubeBuddy",
    h1: "TubeBuddy optimizes the video you already made. Skripr helps you make the next one.",
    subhead:
      "TubeBuddy is a solid channel-management layer: bulk tag edits, thumbnail tests, SEO housekeeping, publishing tools. All of it happens after the video exists. Skripr works on the step before that, the one that actually decides whether a video gets watched: the script.",
    competitorColumn: "TubeBuddy",
    rows: [
      ["Bulk channel management and tags", "No, not its focus", "Yes, its core strength"],
      ["Thumbnail and title A/B testing", "Title variants generated", "Yes"],
      ["Finds your next winning idea", "Yes", "No"],
      ["Writes the full script", "Yes, ready to record", "No"],
      ["Writes in your voice or a creator's", "Yes (Voice Match)", "No"],
      ["Retention structure built in", "Yes", "No"],
      ["Output", "A finished script", "An optimized upload"],
    ],
    beliefs: [
      {
        t: "Optimization cannot save a video you have not made.",
        d: "Tags, thumbnails, and SEO tweaks matter, but they work on a finished video. The growth lever earlier in the chain is the idea and the script. Skripr owns that step.",
      },
      {
        t: "Housekeeping is not creation.",
        d: "TubeBuddy keeps your channel tidy and consistent. It does not help you decide what to film or how to script it. Those are the decisions that move the channel.",
      },
      {
        t: "The bottleneck is usually the next script, not the next tag.",
        d: "Most creators are not stuck on metadata. They are stuck staring at a blank doc wondering what to make and how to open it. Skripr removes that bottleneck.",
      },
    ],
    bridge:
      "TubeBuddy is a capable management tool, and if you run a large channel its bulk features earn their place. Skripr is not a management dashboard. It sits upstream of all of that, at the point where a video is still just an idea.",
    closingH1: "Make the video, then optimize it.",
    faqs: [
      {
        q: "Is Skripr a TubeBuddy alternative?",
        a: "They solve different problems. TubeBuddy manages and optimizes existing uploads. Skripr helps you create the next video, from idea to finished script. They sit at opposite ends of the workflow and can be used together.",
      },
      {
        q: "Does TubeBuddy write scripts?",
        a: "No. TubeBuddy focuses on tags, thumbnails, SEO, and channel management. Scriptwriting is the gap Skripr fills.",
      },
      {
        q: "I already use TubeBuddy. Do I need Skripr?",
        a: "If your scripts are the part slowing you down, yes. TubeBuddy will not help you decide what to film or how to write it. That is exactly what Skripr is for.",
      },
      {
        q: "Is Skripr free to try?",
        a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly, cancel anytime.",
      },
    ],
    related: [
      { href: "/compare/skripr-vs-vidiq", label: "vs VidIQ" },
      { href: "/compare/skripr-vs-chatgpt", label: "vs ChatGPT" },
      { href: "/youtube-strategy", label: "Guides" },
    ],
  },

  {
    slug: "skripr-vs-chatgpt",
    competitor: "ChatGPT",
    category: "General AI assistant",
    intent: "commercial",
    metaTitle: "Skripr vs ChatGPT for YouTube Scripts (2026)",
    metaDescription:
      "You already pay for ChatGPT, so why use Skripr? Because a general chatbot does not know what is working on YouTube, your voice, or retention structure. Here is the side-by-side.",
    ogDescription:
      "ChatGPT guesses. Skripr knows what is working on YouTube right now. Here is the difference.",
    eyebrow: "Skripr vs ChatGPT",
    h1: "ChatGPT will write you a script. It just will not write the one that gets watched.",
    subhead:
      "ChatGPT is a brilliant general tool, and you probably already pay for it. But ask it for a YouTube script and you get fluent text with no idea what is pulling views in your niche, no voice match, and no retention structure. You still have to research it, rebuild it, and clean it up. Skripr does that work before it hands you the script.",
    competitorColumn: "ChatGPT",
    rows: [
      ["Knows what is working on YouTube now", "Yes, built on real data", "No"],
      ["Starts from proven videos in your niche", "Yes", "No, blank canvas"],
      ["Writes in your voice or a creator's", "Yes (Voice Match)", "Generic by default"],
      ["Retention structure: hooks, re-hooks", "Yes", "Only if you prompt it"],
      ["Real cited research", "Yes", "Not reliably"],
      ["Title, metadata, compliance check", "Yes, one flow", "No"],
      ["Output", "Ready to record", "A draft you clean up"],
    ],
    beliefs: [
      {
        t: "A general AI writes into the dark.",
        d: "ChatGPT does not know which hooks, titles, and angles are pulling views on YouTube this week. Skripr does, because it is built on what is already working in your niche. You start from proven, not from a guess.",
      },
      {
        t: "Generic gets sensed in a sentence.",
        d: "Paste a prompt into any chatbot and the output sounds like every other chatbot. Skripr learns your voice, or any creator's voice you choose, and writes every script in it, so viewers hear a real person and stay.",
      },
      {
        t: "The script is a pipeline, not a paragraph.",
        d: "A finished video needs a hook, retention beats, research, a title, metadata, and a compliance check. Skripr does all of it in one flow. A chatbot gives you raw text and leaves the rest to you.",
      },
    ],
    bridge:
      "ChatGPT is a phenomenal general tool, and we use it too. For brainstorming and a hundred other jobs, reach for it. But when the deliverable is a YouTube script that has to get the click and hold the view, a purpose-built tool wins. That is the one job Skripr is built for.",
    closingH1: "Stop cleaning up generic drafts.",
    faqs: [
      {
        q: "I already pay for ChatGPT Plus. Why would I pay for Skripr too?",
        a: "Because they are not the same purchase. ChatGPT Plus is a general assistant for everything. Skripr is a YouTube script engine that knows your niche, writes in your voice, and builds retention in. If YouTube is the goal, the time you save not researching and rewriting is the value.",
      },
      {
        q: "Can I just prompt ChatGPT well enough to match Skripr?",
        a: "You can get closer with a strong prompt, but you are still missing the live picture of what is working on YouTube and the voice and retention layers Skripr builds in by default. You would be rebuilding a slice of Skripr by hand on every script.",
      },
      {
        q: "Does Skripr use models like ChatGPT under the hood?",
        a: "Skripr uses strong models and adds the parts a raw chatbot does not have: real YouTube research, voice matching, retention structure, and a YouTube-specific workflow around the writing.",
      },
      {
        q: "Is Skripr free to try?",
        a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly, cancel anytime.",
      },
    ],
    related: [
      { href: "/skripr-vs-claude", label: "vs Claude" },
      { href: "/compare/skripr-vs-jasper", label: "vs Jasper" },
      { href: "/compare/skripr-vs-vidiq", label: "vs VidIQ" },
    ],
  },

  {
    slug: "skripr-vs-jasper",
    competitor: "Jasper",
    category: "Marketing copy AI",
    intent: "commercial",
    metaTitle: "Skripr vs Jasper for YouTube Scripts (2026)",
    metaDescription:
      "Jasper was built for blog posts and ad copy, not retention-driven video. See why a YouTube-native script engine beats a marketing writer for creators.",
    ogDescription:
      "Jasper was built for blog posts. Skripr was built for YouTube. Here is the difference.",
    eyebrow: "Skripr vs Jasper",
    h1: "Jasper was built for blog posts and ads. Skripr was built for YouTube.",
    subhead:
      "Jasper is a capable marketing writer with brand voices and templates for blogs, emails, and ad copy. None of that is a YouTube script. A video that gets watched needs a hook in the first seconds, retention beats, and structure pulled from what is working on YouTube right now. That is what Skripr writes.",
    competitorColumn: "Jasper",
    rows: [
      ["Blog, email, and ad copy", "No, not its focus", "Yes, its core strength"],
      ["Knows what is working on YouTube now", "Yes, built on real data", "No"],
      ["Starts from proven videos in your niche", "Yes", "No"],
      ["Retention structure: hooks, re-hooks", "Yes", "No, written for readers not viewers"],
      ["Writes in a creator's voice", "Yes (Voice Match)", "Brand voice for marketing"],
      ["Title, metadata, compliance check", "Yes, one flow", "No"],
      ["Output", "A YouTube script", "Marketing copy"],
    ],
    beliefs: [
      {
        t: "Reading and watching are different crafts.",
        d: "Marketing copy is built to be skimmed on a page. A script is built to be heard and to hold attention second by second. Jasper optimizes for the first. Skripr optimizes for the second.",
      },
      {
        t: "A brand voice is not a creator voice.",
        d: "Jasper can sound like a company. Skripr learns how a specific creator actually talks, or how you do, so the script does not sound like an ad read.",
      },
      {
        t: "Marketing templates do not know YouTube.",
        d: "Jasper has no view of what is pulling clicks and watch time on YouTube this week. Skripr is built on it, so the script starts from proven, not from a generic template.",
      },
    ],
    bridge:
      "Jasper is a strong tool for marketing teams producing blogs and ads at scale, and for that work it earns its place. Skripr is not a marketing copy tool. It is a YouTube script engine, built for the one format Jasper was never designed for.",
    closingH1: "Use the tool built for the format.",
    faqs: [
      {
        q: "Is Skripr a Jasper alternative for video?",
        a: "For YouTube scripts specifically, yes. Jasper is built for marketing copy: blogs, emails, ads. Skripr is built for retention-driven video scripts grounded in real YouTube data. If video is the goal, Skripr is the fit.",
      },
      {
        q: "Can Jasper write YouTube scripts?",
        a: "It can produce text you could call a script, but it is written for readers, not viewers, with no YouTube research and no retention structure. That is the gap Skripr closes.",
      },
      {
        q: "Does Skripr also write marketing copy?",
        a: "No, and that is the point. Skripr is focused on one job, the YouTube script, rather than being a general marketing writer. The focus is why it goes deeper on that job.",
      },
      {
        q: "Is Skripr free to try?",
        a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly, cancel anytime.",
      },
    ],
    related: [
      { href: "/compare/skripr-vs-chatgpt", label: "vs ChatGPT" },
      { href: "/skripr-vs-claude", label: "vs Claude" },
      { href: "/compare/skripr-vs-vidiq", label: "vs VidIQ" },
    ],
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return comparisons.find((c) => c.slug === slug);
}
