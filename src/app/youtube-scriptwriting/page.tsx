import { Metadata } from "next";
import { PillarHub, PillarData } from "../../components/PillarHub";

export const metadata: Metadata = {
  title: "YouTube Scriptwriting: The Complete Guide (2026)",
  description:
    "How to write a YouTube script that gets watched: hooks, retention structure, open loops, and pacing, with real examples of channels doing it right.",
  openGraph: {
    title: "YouTube Scriptwriting: The Complete Guide (2026)",
    description: "How to write a YouTube script that gets watched, with real examples.",
    type: "article",
    url: "https://skripr.app/youtube-scriptwriting",
  },
  twitter: { card: "summary_large_image", title: "YouTube Scriptwriting: The Complete Guide (2026)", description: "How to write a YouTube script that gets watched." },
  alternates: { canonical: "https://skripr.app/youtube-scriptwriting" },
};

const data: PillarData = {
  slug: "youtube-scriptwriting",
  eyebrow: "YouTube Scriptwriting",
  h1: "YouTube Scriptwriting: How to Write the Script That Gets Watched",
  intro:
    "Views are decided before you ever hit record. The script is what holds a viewer past the first thirty seconds and keeps them to the end, and watch time is what the algorithm rewards. This is the complete guide to writing one.",
  sections: [
    {
      heading: "The script is the video",
      body: [
        "Most creators treat the script as a rough plan and improvise the rest. That works on camera if you have presence, but it falls apart the moment retention matters, which is always. The script decides the hook, the pacing, where attention dips, and how you pull it back. Get the script right and editing, thumbnails, and titles have something worth promoting. Get it wrong and no amount of polish saves the video.",
        "A good YouTube script is not an essay read aloud. It is written for the ear and for attention: short lines, a clear single idea per section, and a reason to keep watching built into every beat.",
      ],
    },
    {
      heading: "Win the first thirty seconds, then re-hook every forty",
      body: [
        "The opening is the most important text you will write. Skip the welcome, skip the channel intro, and lead with the most interesting thing you have: a bold claim, a surprising stat, a question the viewer needs answered, or the middle of a story. The job of the hook is one thing only: earn the next ten seconds.",
        "Then you do it again, and again. Attention decays, so strong scripts re-hook roughly every thirty to forty-five seconds: a new question, a turn in the story, a payoff you promised earlier. Open loops are the tool here. Plant a question early (\"the third mistake is the one that cost me everything\") and pay it off later, so the viewer stays for the resolution.",
      ],
    },
    {
      heading: "Structure beats inspiration",
      body: [
        "You do not need to be a brilliant writer. You need a reliable structure: hook, setup, stakes, body delivered one idea at a time with re-hooks, a payoff, and one clear call to action. Plan roughly 130 words per minute of finished video, so a ten-minute video is about 1,300 words.",
        "The fastest way to write a script that performs is to start from what already works. Find a video that overperformed in your niche, study its structure, and write your own version on your own topic. That is exactly what Skripr automates: it surfaces proven videos and writes a script built on that structure, in your voice.",
      ],
    },
  ],
  dataBlock: {
    heading: "What a proven script looks like in the wild",
    intro:
      "These faceless documentary channels all started in the last several months and already have videos far past their subscriber count. The common thread is structure, a strong hook and tight pacing, not luck.",
    columns: ["Channel", "Subscribers", "Started", "Breakout video", "Views"],
    rows: [
      ["TRUE HORIZONS", "43.4K", "Oct 2025", "The Strait of Hormuz: The World's Most Dangerous Strait", "1.6M"],
      ["Accidental Scholar", "11.3K", "Mar 2026", "AI Reconstruction of the 1900 Galveston Storm", "712K"],
      ["Audio Point", "33.3K", "Nov 2025", "Countries That Lost Their Superpower Status (And Why)", "500K"],
      ["Dynastypical", "5.9K", "Apr 2026", "Why You Wouldn't Survive a Day as Anne Boleyn's Servant", "99K"],
    ],
    caption: "Source: Skripr research data, faceless documentary niche, June 2026. A live example, refreshed over time.",
  },
  moneyLinks: [
    { href: "/best/ai-script-writer-for-youtube", label: "Best AI Script Writer for YouTube", desc: "How the dedicated tools compare, and which writes scripts grounded in real data." },
    { href: "/best/ai-youtube-script-generator-for-beginners", label: "Best for Beginners", desc: "The simplest way to get a full proven script from a topic, free to start." },
    { href: "/compare/skripr-vs-chatgpt", label: "Skripr vs ChatGPT", desc: "Why a general chatbot writes generic scripts, and what to use instead." },
  ],
  supportingArticles: [
    { href: "/youtube-strategy/how-to-script-a-youtube-video", title: "How to Script a YouTube Video, Step by Step" },
    { href: "/youtube-strategy/script-structure", title: "The 6-Part YouTube Script Structure" },
    { href: "/youtube-strategy/hook-analysis", title: "How to Write a Hook That Stops the Scroll" },
    { href: "/youtube-strategy/open-loops", title: "Open Loops: Keeping Viewers to the End" },
    { href: "/youtube-strategy/retention-optimization", title: "Retention Optimization for YouTube" },
    { href: "/youtube-strategy/free-youtube-script-template", title: "Free YouTube Script Template" },
    { href: "/youtube-strategy/youtube-storytelling", title: "Storytelling Techniques for YouTube" },
  ],
  faqs: [
    { q: "Should I script every YouTube video word for word?", a: "On-camera creators often script the hook and key beats and improvise the rest. Faceless and voiceover videos are usually scripted fully, because the script is the entire video. Either way, scripting the hook and structure is what protects retention." },
    { q: "How long should a YouTube script be?", a: "Plan for roughly 130 words per minute of finished video, so a 10-minute video runs about 1,300 words. Match length to the depth of the topic, not a fixed count." },
    { q: "Can AI write a good YouTube script?", a: "A general chatbot writes generic text. A purpose-built tool like Skripr writes from videos already proven in your niche, in your voice, with hooks and retention built in, which is the difference between a draft you fix and a script you record." },
    { q: "Is Skripr free to try?", a: "Yes. Your first 2 scripts are free with no card required, and paid plans are flat monthly, cancel anytime." },
  ],
  related: [
    { href: "/faceless-youtube", label: "Faceless & Automation" },
    { href: "/youtube-video-ideas", label: "Research & Ideas" },
  ],
};

export default function Page() {
  return <PillarHub data={data} />;
}
