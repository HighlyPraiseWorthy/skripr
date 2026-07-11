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
    columns: string[];
    rows: string[][];
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
      "VidIQ is a strong research and optimization tool, and it has added AI features that can spin up a script. But that script is a side feature bolted onto a keyword tool: generic, not grounded in your voice, not built around retention. For Skripr, the script is the whole product, written from a video already proven to work that you bring it.",
    competitorColumn: "VidIQ",
    rows: [
      ["Keyword and tag research", "Yes", "Yes, its core strength"],
      ["Finds outlier videos worth modeling", "Yes, built in", "Partial, view counts only"],
      ["Generates a script", "Yes, the core product", "Yes, an added AI feature"],
      ["Scripts built from a proven video you bring", "Yes", "No"],
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
        d: "A general AI script is written from nothing in particular. Skripr writes from a video already outperforming that you bring it, so the structure you get is proven, not guessed. That grounding is the difference between a draft and a script you can record.",
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
        a: "Yes, VidIQ has AI features that can generate a script. The gap is depth: that script is a side feature on a keyword tool, so it tends to be generic, not written in your voice, and not built around retention. Skripr is purpose-built for the script and grounds it in a proven video you bring it.",
      },
      {
        q: "Does Skripr do keyword research like VidIQ?",
        a: "Skripr is built around reverse-engineering a winning video you give it, or pulling real research for a topic you choose, then scripting from it. If your goal is to go from an idea to a recorded video, that research is built into the workflow rather than being the end product.",
      },
      {
        q: "Is Skripr free to try?",
        a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly, cancel anytime.",
      },
    ],
    related: [
      { href: "/compare/skripr-vs-tubebuddy", label: "vs TubeBuddy" },
      { href: "/compare/skripr-vs-retti", label: "vs Retti" },
      { href: "/compare/skripr-vs-chatgpt", label: "vs ChatGPT" },
    ],
    dataBlock: {
      heading: "What \"grounded in proven videos\" actually looks like",
      intro:
        "These are real faceless personal-finance channels, every one of them started in the last several months. Each had a video pull far past its subscriber count: the kind of proven video you would hand Skripr to write your script from. A keyword score cannot show you this.",
      columns: ["Channel", "Subscribers", "Started", "Breakout video", "Views"],
      rows: [
        ["how really?", "10.1K", "Dec 2025", "Why $2 Trillion Vanishes Every Year", "829K"],
        ["Backyard Bankroll", "16.5K", "Apr 2026", "13 Animals That Make $2,000/Month, Zero Acres", "476K"],
        ["Millionaire Problems", "17.4K", "Apr 2026", "The Economics of Owning a Casino", "451K"],
        ["Money Simplified", "24.5K", "Mar 2026", "The Psychology of People Who Quietly Escape the Rat Race", "538K"],
        ["Six Figure Explainer", "8.6K", "Mar 2026", "Your Life As Every FAANG Rank", "235K"],
      ],
      caption:
        "Source: public YouTube data,faceless personal-finance niche, June 2026. A live example, refreshed over time.",
      kicker:
        "VidIQ gives you a keyword and a score. You hand Skripr a video that already works, and it writes your script from its hooks and structure.",
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
        d: "Most creators are not stuck on metadata. They are stuck on what to make and how to open it. Skripr removes that bottleneck.",
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
      "ChatGPT guesses. Skripr writes from a video that already works. Here is the difference.",
    eyebrow: "Skripr vs ChatGPT",
    h1: "ChatGPT will write you a script. It just will not write the one that gets watched.",
    subhead:
      "ChatGPT is a brilliant general tool, and you probably already pay for it. But ask it for a YouTube script and you get fluent text with no idea what is pulling views in your niche, no voice match, and no retention structure. You still have to research it, rebuild it, and clean it up. Skripr does that work before it hands you the script.",
    competitorColumn: "ChatGPT",
    rows: [
      ["Starts from a proven video you bring", "Yes", "No"],
      ["Reverse-engineers why a winner worked", "Yes", "No, from scratch"],
      ["Writes in your voice or a creator's", "Yes (Voice Match)", "Generic by default"],
      ["Retention structure: hooks, re-hooks", "Yes", "Only if you prompt it"],
      ["Real cited research", "Yes", "Not reliably"],
      ["Title, metadata, compliance check", "Yes, one flow", "No"],
      ["Output", "Ready to record", "A draft you clean up"],
    ],
    beliefs: [
      {
        t: "A general AI writes into the dark.",
        d: "ChatGPT writes from nothing in particular. Skripr writes from a video that already worked, the one you bring it, so you start from proven structure, not from a guess.",
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
        a: "Because they are not the same purchase. ChatGPT Plus is a general assistant for everything. Skripr is a YouTube script engine that builds your script on a proven video you bring, writes in your voice, and builds retention in. If YouTube is the goal, the time you save not researching and rewriting is the value.",
      },
      {
        q: "Can I just prompt ChatGPT well enough to match Skripr?",
        a: "You can get closer with a strong prompt, but you are still missing the proven-video grounding and the voice and retention layers Skripr builds in by default. You would be rebuilding a slice of Skripr by hand on every script.",
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
      "Jasper is a capable marketing writer with brand voices and templates for blogs, emails, and ad copy. None of that is a YouTube script. A video that gets watched needs a hook in the first seconds, retention beats, and structure pulled from a video already proven to work. That is what Skripr writes.",
    competitorColumn: "Jasper",
    rows: [
      ["Blog, email, and ad copy", "No, not its focus", "Yes, its core strength"],
      ["Starts from a proven video you bring", "Yes", "No"],
      ["Reverse-engineers why a winner worked", "Yes", "No"],
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
        d: "Jasper writes from generic marketing templates. Skripr writes from a video already proven to work that you bring it, so the script starts from proven structure, not from a template.",
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

  {
    slug: "skripr-vs-gemini",
    competitor: "Gemini",
    category: "General AI assistant",
    intent: "commercial",
    metaTitle: "Skripr vs Gemini for Script Writing (2026)",
    metaDescription:
      "Gemini is a strong general model from Google, but it does not know what is working on YouTube, your voice, or retention. See why a purpose-built script tool wins.",
    ogDescription:
      "Gemini writes fluent text. Skripr writes the script that gets watched. Here is the difference.",
    eyebrow: "Skripr vs Gemini",
    h1: "Gemini will write you a script. It just will not write the one that gets watched.",
    subhead:
      "Gemini is a capable general model, and it is great for research, drafting, and a hundred other jobs. But ask it for a YouTube script and you get fluent text with no idea what is pulling views in your niche, no voice match, and no retention structure. You still have to research it, restructure it, and clean it up. Skripr does that work before it hands you the script.",
    competitorColumn: "Gemini",
    rows: [
      ["Starts from a proven video you bring", "Yes", "No"],
      ["Reverse-engineers why a winner worked", "Yes", "No, from scratch"],
      ["Writes in your voice or a creator's", "Yes (Voice Match)", "Generic by default"],
      ["Retention structure: hooks, re-hooks", "Yes", "Only if you prompt it"],
      ["Real cited research", "Yes", "Not reliably"],
      ["Title, metadata, compliance check", "Yes, one flow", "No"],
      ["Output", "Ready to record", "A draft you clean up"],
    ],
    beliefs: [
      {
        t: "A general model writes into the dark.",
        d: "Gemini writes from nothing in particular. Skripr writes from a video that already worked, the one you bring it, so you start from proven structure, not from a guess.",
      },
      {
        t: "Generic gets sensed in a sentence.",
        d: "Prompt any general model and the output sounds like every other model. Skripr learns your voice, or any creator's voice you choose, and writes every script in it, so viewers hear a real person and stay.",
      },
      {
        t: "The script is a pipeline, not a paragraph.",
        d: "A finished video needs a hook, retention beats, research, a title, metadata, and a compliance check. Skripr does all of it in one flow. A general assistant gives you raw text and leaves the rest to you.",
      },
    ],
    bridge:
      "Gemini is an excellent general tool, and we are not trying to out-reason it. For research, brainstorming, and everyday work, reach for it. But when the deliverable is a YouTube script that has to get the click and hold the view, a purpose-built tool wins. That is the one job Skripr is built for.",
    closingH1: "Stop cleaning up generic drafts.",
    faqs: [
      {
        q: "Can I just use Gemini to write YouTube scripts?",
        a: "You can, and it writes fluent prose. The gap is that a general model does not know what is working on YouTube right now, does not write in your voice by default, and does not build retention structure in. You get a generic draft you still have to research, restructure, and clean up. Skripr is built specifically for the YouTube script, so that work is already done.",
      },
      {
        q: "What does Skripr do that Gemini does not?",
        a: "Skripr starts from a proven video you give it, writes in your voice or any creator's voice you choose, builds in hooks and retention beats, grounds claims in real cited research, and adds titles, metadata, and a demonetization check. It is a purpose-built YouTube pipeline rather than a general chat tool.",
      },
      {
        q: "Is Skripr better than Gemini?",
        a: "For general reasoning, research, and writing, Gemini is excellent and Skripr does not try to compete with it. For the specific job of writing a YouTube script that gets clicked and watched, Skripr is purpose-built and goes deeper.",
      },
      {
        q: "Is Skripr free to try?",
        a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly, cancel anytime.",
      },
    ],
    related: [
      { href: "/skripr-vs-claude", label: "vs Claude" },
      { href: "/compare/skripr-vs-chatgpt", label: "vs ChatGPT" },
      { href: "/compare/skripr-vs-vidiq", label: "vs VidIQ" },
    ],
    dataBlock: {
      heading: "What \"grounded in proven videos\" actually looks like",
      intro:
        "These are real faceless space and science channels, all started within the last several months. Each had a video pull far past its subscriber count: the kind of proven video you would hand Skripr to write your script from. A general model has no idea this exists.",
      columns: ["Channel", "Subscribers", "Started", "Breakout video", "Views"],
      rows: [
        ["Bluntly Explained", "9.6K", "Apr 2026", "Every Type of Black Hole Explained in 11 Minutes", "878K"],
        ["big space explainer", "5.8K", "Feb 2026", "Every Way the Universe Could End Explained in 18 Minutes", "351K"],
        ["Jost", "19.9K", "Dec 2025", "Why Anyone Who Goes to Mars Will Never Come Back", "1.3M"],
        ["Cosmicus", "89.8K", "Feb 2026", "James Webb Just Saw Pluto for the First Time", "623K"],
        ["Cosmic Lens", "97.4K", "Oct 2025", "Why Saturn is the Scariest Planet", "6.1M"],
      ],
      caption:
        "Source: public YouTube data,faceless space and science niche, June 2026. A live example, refreshed over time.",
      kicker:
        "Gemini starts from scratch. You hand Skripr a video that already works, and it writes your script from its hooks and structure.",
    },
  },

  {
    slug: "skripr-vs-claude-for-documentary-channels",
    competitor: "Claude",
    category: "Documentary scriptwriting",
    intent: "commercial",
    metaTitle: "Skripr vs Claude for Documentary Channels (2026)",
    metaDescription:
      "Documentary channels live on narration, research, and long-form retention. Claude writes fluent prose but does not know documentary formats or pace for retention. See the difference.",
    ogDescription:
      "Claude writes fluent narration. Skripr writes the documentary that holds a viewer for 20 minutes. Here is the difference.",
    eyebrow: "Skripr vs Claude for Documentary Channels",
    h1: "Claude writes beautiful narration. Skripr writes the documentary people finish.",
    subhead:
      "Documentary channels live or die on three things: narration that carries, research that holds up, and retention across fifteen to forty minutes. Claude writes fluent prose, but it does not know which documentary formats are working right now, it does not pace a long-form script for retention, and it does not write in your narrator voice by default. Skripr is built for exactly that job.",
    competitorColumn: "Claude",
    rows: [
      ["Starts from a proven documentary you bring", "Yes", "No"],
      ["Reverse-engineers why a long-form winner worked", "Yes", "No, from scratch"],
      ["Long-form retention pacing and re-hooks", "Yes, built in", "Only if you prompt it"],
      ["Writes in your narrator voice", "Yes (Voice Match)", "Generic by default"],
      ["Real cited research for claims", "Yes", "Not reliably"],
      ["Title, metadata, compliance check", "Yes, one flow", "No"],
      ["Output", "A documentary script ready to narrate", "A draft you clean up"],
    ],
    beliefs: [
      {
        t: "A documentary is won in the first ninety seconds, then held for twenty minutes.",
        d: "Long-form documentary retention is its own craft: the cold open, the stakes, the open loops you pay off across the whole runtime. Claude writes lovely sentences but does not pace a twenty-minute script for retention. Skripr builds that structure in.",
      },
      {
        t: "Research that does not hold up sinks a documentary.",
        d: "Documentary audiences punish sloppy facts. A general model will state things confidently that are not reliably sourced. Skripr grounds claims in real cited research, so your script is built on something you can stand behind.",
      },
      {
        t: "The narrator voice is the channel.",
        d: "Faceless documentary channels are recognized by their narration. A generic AI voice breaks that. Skripr writes in your narrator voice, or one you choose, so every script sounds like your channel.",
      },
    ],
    bridge:
      "Claude is a genuinely excellent writer, and for drafting and research it is a great tool to have open. Skripr is not trying to win general writing. It is built for the specific job of a documentary script that opens hard, paces for retention, cites real research, and sounds like your narrator. That is the work a documentary channel actually needs.",
    closingH1: "Write the documentary people finish.",
    faqs: [
      {
        q: "Can Claude write documentary scripts?",
        a: "Claude writes fluent narration and is a strong drafting tool. The gap for documentary channels is that it does not know which documentary formats are working now, does not pace a long-form script for retention, does not reliably cite real research, and does not write in your narrator voice by default. Skripr is built around those exact needs.",
      },
      {
        q: "Why does retention matter more for documentaries?",
        a: "Documentaries are long, often fifteen to forty minutes, so a small drop in retention compounds across the runtime and starves the algorithm of watch time. Skripr structures the cold open, stakes, and open loops to hold attention across the whole video, not just the intro.",
      },
      {
        q: "Does Skripr handle the research a documentary needs?",
        a: "Skripr grounds claims in real cited research as part of the script, which matters more for documentary content than almost any other format, because the audience checks. You still verify, but you are not starting from a model that invents sources.",
      },
      {
        q: "Is Skripr free to try?",
        a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly, cancel anytime.",
      },
    ],
    related: [
      { href: "/skripr-vs-claude", label: "vs Claude (general)" },
      { href: "/compare/skripr-vs-gemini", label: "vs Gemini" },
      { href: "/best/ai-tools-for-faceless-channels", label: "Best faceless tools" },
    ],
    dataBlock: {
      heading: "Proven documentary structures, the kind you bring to Skripr",
      intro:
        "These are real faceless documentary channels, all started within the last several months. Each had a video pull far past its subscriber count: the kind of proven documentary you would hand Skripr to write your script from. A general writer cannot see any of this.",
      columns: ["Channel", "Subscribers", "Started", "Breakout video", "Views"],
      rows: [
        ["TRUE HORIZONS", "43.4K", "Oct 2025", "The Strait of Hormuz: The World's Most Dangerous Strait", "1.6M"],
        ["Accidental Scholar", "11.3K", "Mar 2026", "AI Reconstruction of the 1900 Galveston Storm", "712K"],
        ["Audio Point", "33.3K", "Nov 2025", "Countries That Lost Their Superpower Status (And Why)", "500K"],
        ["Dynastypical", "5.9K", "Apr 2026", "Why You Wouldn't Survive a Day as Anne Boleyn's Servant", "99K"],
        ["WW2 True Stories", "6.6K", "Oct 2025", "German Generals Mocked British Intelligence", "96K"],
      ],
      caption:
        "Source: public YouTube data,faceless documentary niche, June 2026. A live example, refreshed over time.",
      kicker:
        "Claude starts from scratch. You hand Skripr a documentary that already works, and it writes your script from its structure.",
    },
  },
  {
    slug: "skripr-vs-retti",
    competitor: "Retti",
    category: "Retention analysis tool",
    intent: "commercial",
    metaTitle: "Skripr vs Retti (2026): Diagnose or Write?",
    metaDescription:
      "Retti diagnoses why your published videos lose viewers. Skripr writes the next script from a video already proven to work. See where each tool fits.",
    ogDescription:
      "Retti tells you why the last video lost viewers. Skripr writes the next one. Here is the difference.",
    eyebrow: "Skripr vs Retti",
    h1: "Retti tells you why the last video lost viewers. Skripr writes the next one.",
    subhead:
      "Retti is a retention analysis tool built by a YouTube strategist. It reads your published videos, scores your hooks, and shows where viewers left. That is genuinely useful, and it all happens after the video exists. Skripr works on the step that decides retention in the first place: the script, written from a video already proven to work, in your voice.",
    competitorColumn: "Retti",
    rows: [
      ["Diagnoses your published videos", "No", "Yes, its core strength"],
      ["Predicts retention curve and drop-off points", "No", "Yes"],
      ["Writes the full script", "Yes, the core product", "Yes, one of its tools"],
      ["Script built from a proven video you bring", "Yes", "Different approach: trained on retention patterns"],
      ["Writes in your voice or a creator's", "Yes (Voice Match)", "Not its focus"],
      ["Works before you have published anything", "Yes", "Best once you have videos to analyze"],
      ["Titles, metadata, demonetization check", "Yes, one flow", "Not listed among its tools"],
    ],
    beliefs: [
      {
        t: "A diagnosis is not a script.",
        d: "Retti can tell you the video leaked viewers at 2:14. You still have to sit down and write the next one better. Skripr does that part: it hands you the next script with the hook, re-hooks, and structure already built in.",
      },
      {
        t: "The next video is the lever, not the last one.",
        d: "A published video's retention is history. You cannot re-shoot it. Every point of watch time you will ever gain lives in the next script, which is the one job Skripr is built for.",
      },
      {
        t: "Proven beats predicted.",
        d: "A predicted retention curve is a forecast. A video that already pulled views is proof. Skripr grounds your script in a winner you bring it, so the structure you start from is validated by real viewers, not modeled.",
      },
    ],
    bridge:
      "Retti is a genuinely useful tool, and the post-publish diagnosis it does is a job Skripr does not do. If you want to know exactly why your last upload lost people, it earns its place. Skripr is not a diagnosis dashboard. It sits one step earlier, where retention is actually decided: the script for the video you have not made yet.",
    closingH1: "Stop auditing the last video. Write the next one.",
    faqs: [
      {
        q: "Is Skripr a Retti alternative?",
        a: "They solve different halves of the same problem. Retti diagnoses retention on videos you already published. Skripr writes the next script from a video already proven to work, in your voice. If your last video flopped and you want to know why, Retti does that. If you want the next one to hold viewers, that is Skripr.",
      },
      {
        q: "Can Retti write scripts too?",
        a: "Yes, Retti includes a script writer alongside its analysis tools. The difference is the center of gravity. Retti is built around diagnosing retention, with scripting as one of its tools. Skripr is built end to end around the script: grounded in a proven video you bring, written in your voice, with titles, metadata, and a demonetization check in the same flow.",
      },
      {
        q: "Does Skripr analyze my published videos' retention?",
        a: "No, and that is an honest gap. Skripr analyzes the proven video you bring it and writes your next script from it. It does not read your channel analytics. For post-publish diagnosis, a tool like Retti is the right fit, and plenty of creators could use one for the autopsy and the other for the next script.",
      },
      {
        q: "Is Skripr free to try?",
        a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly, cancel anytime.",
      },
    ],
    related: [
      { href: "/compare/skripr-vs-vidiq", label: "vs VidIQ" },
      { href: "/subscribr-alternative", label: "vs Subscribr" },
      { href: "/compare/skripr-vs-chatgpt", label: "vs ChatGPT" },
    ],
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return comparisons.find((c) => c.slug === slug);
}
