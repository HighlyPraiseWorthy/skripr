// Config for the free YouTube SEO toolkit. Each tool is its own exact-match
// page (the keyword is the URL) plus a shared hub at /youtube-seo-tools.

export type SeoToolId = "tags" | "title" | "hook" | "description";

export interface SeoTool {
  id: SeoToolId;
  slug: string; // exact-match URL, e.g. "youtube-tag-generator"
  name: string; // "Tag Generator"
  h1: string;
  metaTitle: string;
  metaDescription: string;
  ogDescription: string;
  intro: string; // hero subhead
  inputLabel: string;
  placeholder: string;
  bodyHeading: string;
  body: string[];
  tip: string;
  faqs: { q: string; a: string }[];
}

export const SEO_TOOLS: SeoTool[] = [
  {
    id: "tags",
    slug: "youtube-tag-generator",
    name: "Tag Generator",
    h1: "YouTube Tag Generator",
    metaTitle: "Free YouTube Tag Generator (2026) | Skripr",
    metaDescription: "Generate relevant YouTube tags and keywords for any video in seconds. Free, no signup. Paste your topic and get tags that help your video get found.",
    ogDescription: "Relevant YouTube tags for any video in seconds. Free, no signup.",
    intro: "Paste your video topic and get a full set of relevant YouTube tags in seconds. Free, no account needed.",
    inputLabel: "Video topic or title",
    placeholder: "e.g. beginner sourdough bread recipe",
    bodyHeading: "How YouTube tags actually work",
    body: [
      "Tags are not the magic ranking lever some people think they are, but they still help YouTube understand what your video is about, especially for a new channel with little watch history. Used well, they reinforce your topic and catch a few extra search and suggested impressions.",
      "The trick is relevance over volume. Mix a couple of broad tags with several specific, long-tail ones that match how people actually search. Put your most important keyword first, and do not stuff in unrelated terms, because that confuses the algorithm more than it helps.",
      "Tags support your title and thumbnail, they do not replace them. Get those right first, then let tags do their quiet background job.",
    ],
    tip: "Lead with your exact main keyword, then go specific. Ten precise tags beat thirty random ones.",
    faqs: [
      { q: "Do YouTube tags still matter in 2026?", a: "They are a minor signal, not a major one. They help YouTube understand your topic, which matters most for small channels and search, but your title, thumbnail, and retention decide far more." },
      { q: "How many YouTube tags should I use?", a: "Quality over count. Around 10 to 15 relevant tags is plenty. Stuffing the limit with loosely related terms can hurt more than it helps." },
      { q: "Is this tag generator free?", a: "Yes, it is free and needs no signup. Paste a topic and copy your tags." },
    ],
  },
  {
    id: "title",
    slug: "youtube-title-generator",
    name: "Title Generator",
    h1: "YouTube Title Generator",
    metaTitle: "Free YouTube Title Generator (2026) | Skripr",
    metaDescription: "Generate high-CTR YouTube title ideas for any video in seconds. Free, no signup. Paste your topic and get click-worthy titles that are not clickbait.",
    ogDescription: "Click-worthy YouTube title ideas in seconds. Free, no signup.",
    intro: "Paste your video topic and get click-worthy title options in seconds. Free, no account needed.",
    inputLabel: "Video topic",
    placeholder: "e.g. why most diets fail",
    bodyHeading: "What makes a YouTube title get clicked",
    body: [
      "Your title and thumbnail do one job: earn the click. The best titles promise a clear payoff or open a curiosity gap a viewer cannot ignore, without lying about what is inside. A title that overpromises gets the click and then kills retention, which the algorithm punishes fast.",
      "Keep it under about 60 characters so it does not get cut off on mobile. Lead with the interesting part, use one strong word, and avoid generic openers like How to or Top 10. The goal is a title a stranger would click even if they had never heard of you.",
      "A great title cannot save a weak video, but a weak title can bury a great one. It is worth testing a few.",
    ],
    tip: "Write the title as a promise a stranger would click, then make sure your first 30 seconds deliver it.",
    faqs: [
      { q: "How long should a YouTube title be?", a: "Aim for under 60 characters so it is not cut off on mobile or in suggested feeds. Front-load the most interesting words." },
      { q: "What makes a title clickable without being clickbait?", a: "A real curiosity gap or a clear payoff that the video actually delivers. Clickbait overpromises and tanks retention, which hurts you more than the click helps." },
      { q: "Is the title generator free?", a: "Yes, it is free and needs no signup. Generate as many as you want and copy your favorite." },
    ],
  },
  {
    id: "hook",
    slug: "youtube-hook-generator",
    name: "Hook Generator",
    h1: "YouTube Hook Generator",
    metaTitle: "Free YouTube Hook Generator (2026) | Skripr",
    metaDescription: "Generate scroll-stopping opening lines for any YouTube video in seconds. Free, no signup. Paste your topic and get hooks built to win the first 30 seconds.",
    ogDescription: "Scroll-stopping YouTube hooks in seconds. Free, no signup.",
    intro: "Paste your video topic and get a set of strong opening lines in seconds. Free, no account needed.",
    inputLabel: "Video topic or title",
    placeholder: "e.g. why I quit my job to go full time on YouTube",
    bodyHeading: "Why your first line decides the video",
    body: [
      "Most viewers decide whether to stay in the first few seconds. The hook is the line that buys you the rest of the video. If it does not open a question, raise the stakes, or promise a clear payoff, people leave before the good part.",
      "Strong hooks tend to do one thing well. They open a curiosity gap. They say something that sounds wrong until you explain it. They drop you into the middle of the action. Or they name the exact problem the viewer came to solve. Pick one angle and commit to it, do not stack all four.",
      "A hook is a promise. The rest of the video has to pay it off, or retention falls off a cliff and the algorithm stops showing it. Write the hook you can actually deliver.",
    ],
    tip: "Say the most interesting thing first. If your hook could open any video in your niche, it is too generic.",
    faqs: [
      { q: "What is a YouTube hook?", a: "The opening line or first few seconds of your video. Its only job is to stop the viewer from leaving and earn the rest of the watch." },
      { q: "How long should a YouTube hook be?", a: "Short. One or two lines, usually the first 5 to 15 seconds. Get to the interesting part before the viewer decides to click away." },
      { q: "Is the hook generator free?", a: "Yes, it is free and needs no signup. Paste a topic and copy the hooks you like." },
    ],
  },
  {
    id: "description",
    slug: "youtube-description-generator",
    name: "Description Generator",
    h1: "YouTube Description Generator",
    metaTitle: "Free YouTube Description Generator (2026) | Skripr",
    metaDescription: "Generate a clear, SEO-friendly YouTube description for any video in seconds. Free, no signup. Paste your topic and get a ready-to-paste description with hashtags.",
    ogDescription: "A clean, SEO-friendly YouTube description in seconds. Free, no signup.",
    intro: "Paste your video topic and get a clean, SEO-friendly description in seconds. Free, no account needed.",
    inputLabel: "Video topic or title",
    placeholder: "e.g. how to grow tomatoes in pots",
    bodyHeading: "How to write a YouTube description that helps",
    body: [
      "Your description helps YouTube understand your video and gives viewers a reason to keep watching or click through. The first two lines matter most, since they show above the fold, so put your main keyword and the core promise there.",
      "Below that, a short paragraph on what the video covers, written for humans, not robots. Add a few relevant hashtags at the end, not thirty. Keyword stuffing reads as spam and does not help.",
      "Treat the description as support for the video, not a dumping ground. Clear and honest beats long and stuffed.",
    ],
    tip: "Put your main keyword and the payoff in the first two lines. That is the part viewers and YouTube actually read.",
    faqs: [
      { q: "What should a YouTube description include?", a: "A strong first two lines with your main keyword, a short summary of the video, and a few relevant hashtags. Keep it natural and honest." },
      { q: "How long should a YouTube description be?", a: "Long enough to describe the video clearly, usually a short paragraph or two. There is no bonus for padding it with keywords." },
      { q: "Is the description generator free?", a: "Yes, it is free and needs no signup. Paste a topic and copy your description." },
    ],
  },
];

export function getSeoTool(slug: string): SeoTool | undefined {
  return SEO_TOOLS.find((t) => t.slug === slug);
}
