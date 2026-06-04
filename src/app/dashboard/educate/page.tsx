"use client";

import { useState } from "react";

const C = {
  bg: "#0b0b17",
  cardBg: "#12122a",
  cardOpen: "#161630",
  border: "rgba(99,102,241,0.12)",
  borderOpen: "rgba(99,102,241,0.30)",
  accent: "#818cf8",
  text: "#e2e8f0",
  textDim: "#64748b",
  textBright: "#f1f5f9",
};

const levelColor = (level: string) =>
  level === "Beginner"
    ? { bg: "rgba(52,211,153,0.12)", color: "#34d399" }
    : level === "Intermediate"
    ? { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" }
    : { bg: "rgba(248,113,113,0.12)", color: "#f87171" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: 0.6, marginBottom: 8, textTransform: "uppercase" }}>{title}</p>
      {children}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 10, padding: "10px 14px", marginTop: 10 }}>
      <p style={{ fontSize: 13, color: "#a5b4fc", lineHeight: 1.6, margin: 0 }}>💡 <strong>Skripr tip:</strong> {children}</p>
    </div>
  );
}

function Bullet({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ color: "#34d399", marginTop: 2, flexShrink: 0, fontSize: 12 }}>✓</span>
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0 }}>{item}</p>
        </div>
      ))}
    </div>
  );
}

const lessons = [
  {
    title: "The 8 Hook Types That Keep Viewers Watching",
    category: "Hooks",
    level: "Beginner",
    duration: "5 min",
    emoji: "🎣",
    summary: "The hook is the only thing standing between your video and the back button. You have 3 seconds.",
    content: (
      <div>
        <Section title="Why hooks make or break your channel">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>YouTube's algorithm measures drop-off at the 0-30 second mark. If viewers leave early, your video gets buried. If they stay, you get pushed to more feeds. The hook is the single highest-leverage moment in your entire script.</p>
        </Section>
        <Section title="The 8 proven hook patterns">
          <Bullet items={[
            "Question Hook — Surface a pain point as a question. 'Why do 90% of channels fail in the first 6 months?' Forces the viewer to mentally answer.",
            "Stat Hook — Open with a surprising number. '83% of people who start intermittent fasting quit by week 2 — here's the one thing they all got wrong.'",
            "Story Hook — Drop into a scene mid-action. 'Three years ago I was making $200 a month. Last Tuesday I cleared $18,000.'",
            "Controversy Hook — Take a bold stance. 'Morning routines are killing your productivity — and productivity YouTubers know it.'",
            "What If Hook — Pose an impossible scenario. 'What if everything you know about sleep is designed to keep you tired?'",
            "List Hook — Promise a specific number of insights. 'Five things your landlord legally cannot do — most tenants never find out about #3.'",
            "Result Hook — Lead with the outcome. 'I tested 47 different AI tools for 6 months. Here's the only one that actually saved me time.'",
            "Myth-Bust Hook — Shatter a common belief. 'Drinking 8 glasses of water a day isn't science — it's a misquote from a 1945 paper nobody read.'",
          ]} />
        </Section>
        <Section title="What makes a hook fail">
          <Bullet items={[
            "Starting with 'In this video...' — tells viewers nothing, gives them no reason to stay",
            "Starting with 'Welcome back...' — your returning viewers don't need a greeting; new viewers don't care",
            "Burying the tension — if your most interesting idea isn't in the first sentence, cut everything before it",
            "Being vague — 'I learned something amazing' is not a hook, it's a placeholder",
          ]} />
        </Section>
        <Tip>Skripr selects the best hook pattern for your niche automatically. True-crime gets Cold Opens. Finance gets Stat hooks. You can also click Rewrite Hook (3x per script) to get a completely different pattern.</Tip>
      </div>
    ),
  },
  {
    title: "Script Structure: The Anatomy of a Viral Video",
    category: "Script Writing",
    level: "Beginner",
    duration: "8 min",
    emoji: "🏗️",
    summary: "Viral videos aren't random. They follow a structure that keeps viewers watching and algorithms happy.",
    content: (
      <div>
        <Section title="The 5-part structure Skripr builds into every script">
          <Bullet items={[
            "Hook (0-30s) — Grab attention before a single second of context. No warmup, no intro music mention, straight to tension.",
            "Re-hook (30s mark) — The first big drop-off happens at 30 seconds. A hard pivot, new tension, or 'but here's what nobody tells you' moment resets attention.",
            "Body with escalating open loops — At the 1/3 mark: plant a question you don't answer yet. At the 2/3 mark: raise the stakes higher than the first loop. Viewers feel it would be a mistake to leave.",
            "Callback payoff (final 20%) — That detail you mentioned early in the video? Pay it off here. This creates the 'I can't believe that came back' moment that drives shares.",
            "CTA — One clear action. Subscribe, comment, or watch next. Never two things at once.",
          ]} />
        </Section>
        <Section title="The 0:30 retention cliff">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>YouTube Analytics shows a consistent drop-off at exactly 30 seconds across almost every channel. This is when casual viewers decide if the video is worth their time. A Re-hook at this exact moment — a new angle, a pivot, a surprising reveal — resets their decision. Most creators ignore this moment. It's your biggest competitive advantage.</p>
        </Section>
        <Section title="Open loops: what they are and why they work">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>An open loop is an unanswered question. The human brain is wired to seek closure — it's called the Zeigarnik effect. When you say "I'll tell you exactly why in a moment" or "the reason will surprise you — but first", you create a mild tension the viewer needs resolved. The key is escalation: your second open loop must feel more urgent than your first, or viewers sense the pattern and stop caring.</p>
        </Section>
        <Tip>Skripr embeds these three mechanics (0:30 re-hook, escalating open loops, callback threading) into every script it generates. You don't have to think about placement — it's handled at the prompt level.</Tip>
      </div>
    ),
  },
  {
    title: "Niche Bending: Break Out of Your Algorithm Bubble",
    category: "Growth",
    level: "Intermediate",
    duration: "6 min",
    emoji: "🔀",
    summary: "The fastest path to a new audience is borrowing what already works in a different niche.",
    content: (
      <div>
        <Section title="What is niche bending?">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>Niche bending is taking a concept, format, or hook pattern that performs well in one niche and transplanting it into another. A true-crime cold open applied to a personal finance video. A cooking challenge format applied to coding tutorials. The crossover creates novelty — and novelty gets clicks.</p>
        </Section>
        <Section title="Why it works for the algorithm">
          <Bullet items={[
            "YouTube recommends videos to viewers of similar channels — niche bending lets you tap into adjacent recommendation graphs",
            "Crossover content often has lower competition because it occupies a space between two niches",
            "Novelty drives click-through rate — familiar topic, unfamiliar format makes thumbnails stand out",
            "It forces creative constraints that often produce better scripts than staying in your comfort zone",
          ]} />
        </Section>
        <Section title="How to use Skripr's Niche Bend tool">
          <Bullet items={[
            "Select your primary niche (what your channel covers)",
            "Select an adjacent niche to borrow from (completely different genre works best)",
            "Optionally paste a source video URL — Skripr reverse-engineers its hook type and structure, then transplants it into your niche",
            "Get 10 crossover video ideas ranked by viral potential and competition level",
            "Click 'Generate Script' on any idea to go straight to script generation with that topic pre-filled",
          ]} />
        </Section>
        <Section title="Best niche combinations">
          <Bullet items={[
            "True-crime + Personal Finance — 'The $2M Real Estate Scam Nobody Talked About'",
            "History + Tech — 'The 1970s Mistake That Made Apple Possible'",
            "Fitness + Psychology — 'Why Your Brain Physically Cannot Stick to a Workout (And the Fix)'",
            "Documentary + Cooking — 'The Company That Changed How America Eats — And Kept It Secret'",
          ]} />
        </Section>
        <Tip>The Viral Magnet Words feature works alongside Niche Bend. Pick a trending magnet word before generating your crossover ideas — it forces the titles to include high-click-rate language from current YouTube trends.</Tip>
      </div>
    ),
  },
  {
    title: "Avoiding Demonetization: What YouTube Flags",
    category: "Compliance",
    level: "Intermediate",
    duration: "10 min",
    emoji: "🛡️",
    summary: "Demonetization kills revenue silently. Most creators find out weeks after the damage is done.",
    content: (
      <div>
        <Section title="How YouTube's content moderation works">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>YouTube uses automated scanning on every upload — audio, video, and metadata. It flags content before human review even begins. Most demonetization happens automatically within minutes of upload, often before your video gains any traction. Flagged content shows a yellow dollar icon (limited ads) instead of green (full monetization).</p>
        </Section>
        <Section title="What gets flagged most often">
          <Bullet items={[
            "Violence and graphic content — even described verbally in narration, not just shown visually",
            "Controversial topics — politics, religion, social issues can trigger limited ads regardless of how they're covered",
            "Dangerous challenges — any content that could be replicated and cause harm",
            "Adult themes — including suggestive language, not just explicit content",
            "Drug and alcohol references — even educational content about substances gets flagged",
            "Misleading metadata — titles or thumbnails that don't match the content",
            "Repetitive content — scripts that reuse the same sentences or phrases (common with poorly prompted AI)",
          ]} />
        </Section>
        <Section title="What most creators miss">
          <Bullet items={[
            "You can appeal every demonetization — most creators don't and lose revenue permanently",
            "Timestamps matter — flag triggers tied to specific moments can be cut without re-uploading",
            "Synonyms often bypass flags — 'ended their life' vs explicit phrasing",
            "Title and description are scanned separately from the video itself — mismatches trigger flags",
          ]} />
        </Section>
        <Tip>Use Skripr's Compliance tab before uploading. Paste your final script and it checks for language patterns, controversial phrasing, and content that commonly triggers limited monetization — before you ever hit upload.</Tip>
      </div>
    ),
  },

  {
    title: "Angles: The Counterintuitive Take That Makes Scripts Stick",
    category: "Script Writing",
    level: "Intermediate",
    duration: "7 min",
    emoji: "🎯",
    summary: "Same topic, different angle = completely different video. The angle is what makes yours worth watching.",
    content: (
      <div>
        <Section title="What is an angle?">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>An angle is the specific counterintuitive truth your video argues. Not the topic — the stance. Topic: 'morning routines'. Angle: 'Morning routines are a productivity trap designed by people who don't have jobs.' Same topic, completely different video. The angle is what your script defends from beginning to end.</p>
        </Section>
        <Section title="What makes a strong angle">
          <Bullet items={[
            "Counterintuitive — it contradicts what most people believe or have been told",
            "Specific — 'coffee is bad for you' is weak. 'Coffee ruins your focus if you drink it before 9:30am due to cortisol timing' is strong.",
            "Defensible — you need to actually argue it through the script. If you can't fill 5 minutes defending it, the angle is too thin.",
            "Emotionally resonant — it should either validate something the viewer suspects or challenge something they think they know",
          ]} />
        </Section>
        <Section title="How to use Suggest Angles in Skripr">
          <Bullet items={[
            "Type your topic in the Topic Only tab",
            "Click 'Suggest Angles for me' — Skripr generates 4 counterintuitive takes on your topic",
            "Pick the one that resonates, or edit it to fit your voice",
            "Click Generate Script — the entire script builds around that specific angle",
            "Without an angle, you get a generic script. With one, every section serves the argument.",
          ]} />
        </Section>
        <Section title="Angle examples by niche">
          <Bullet items={[
            "Finance: 'Budgeting apps make you worse with money — here's the psychology'",
            "Fitness: 'Rest days are when you actually get stronger — and most people do them wrong'",
            "Tech: 'The feature that made iPhone popular wasn't the touchscreen'",
            "History: 'Rome didn't fall — it deliberately transformed into something more stable'",
          ]} />
        </Section>
        <Tip>You can lock an angle before generating, or generate first and let Skripr's AI choose. Locking an angle produces tighter, more consistent scripts. The angle becomes the thread every section is woven around.</Tip>
      </div>
    ),
  },
  {
    title: "Retention Mechanics: The Science of 70%+ Viewer Retention",
    category: "Script Writing",
    level: "Advanced",
    duration: "12 min",
    emoji: "📈",
    summary: "Retention isn't about being entertaining. It's about exploiting three specific neurological patterns that keep eyes on screens.",
    content: (
      <div>
        <Section title="Why retention is the most important metric">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>YouTube's ranking algorithm is primarily driven by watch time and retention rate. A video that 10,000 people watch for 80% of its length beats a video that 100,000 people watch for 10%. High retention tells YouTube the content is valuable — and YouTube rewards it with distribution. The goal isn't views, it's minutes watched.</p>
        </Section>
        <Section title="Mechanic 1: The 0:30 Re-Hook">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>The 30-second mark is the single biggest drop-off point across YouTube. This is when casual viewers decide your video isn't worth their time. Placing a hard re-hook exactly here — a new tension, a pivot, a 'but here's what nobody mentions' moment — resets the viewer's decision to stay. This is mandatory in every Skripr-generated script.</p>
        </Section>
        <Section title="Mechanic 2: Escalating Open Loops">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>Open loops exploit the Zeigarnik effect — the brain's compulsion to seek closure on unfinished questions. Plant your first open loop at the 1/3 mark of the video. Plant a second, more urgent open loop at the 2/3 mark. The second must feel higher-stakes than the first — not just 'another question' but 'the stakes just got higher'. Viewers feel it would be a mistake to leave before the resolution.</p>
        </Section>
        <Section title="Mechanic 3: Callback Threading">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>In the first 20% of your script, plant a detail that seems throwaway — a specific name, a number, an odd aside. In the final 20%, return to it and pay it off. The callback creates the 'I can't believe that came back' moment. It makes the video feel designed, not improvised. This drives shares more than any other structural technique — viewers want to show others the moment they didn't see coming.</p>
        </Section>
        <Tip>All three mechanics are baked into Skripr's SYSTEM_PROMPT. You don't need to write 'insert open loop here' — the AI places them structurally. Your job is to review and make sure the callback setup in the first section actually pays off in the last one.</Tip>
      </div>
    ),
  },
  {
    title: "Skripr End-to-End: From Idea to Upload-Ready Script",
    category: "Workflow",
    level: "Beginner",
    duration: "8 min",
    emoji: "🚀",
    summary: "The full Skripr workflow in under 10 minutes — from blank page to a script ready for TTS and upload.",
    content: (
      <div>
        <Section title="Step 1 — Choose your input mode">
          <Bullet items={[
            "Topic Only — you have an idea and want Skripr to build the full script from scratch. Most common for original content.",
            "YouTube URL — paste a competitor or inspiration video. Skripr extracts the transcript and uses it as a structural reference while targeting your niche.",
            "Paste Transcript — copy the transcript manually from YouTube (click ⋯ → Show transcript → copy all). Most reliable for longer videos.",
          ]} />
        </Section>
        <Section title="Step 2 — Lock your angle (optional but powerful)">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>In Topic Only mode, click 'Suggest Angles for me' and pick a counterintuitive take. This single step is the difference between a generic script and one that feels like it has a clear point of view. Without an angle, the script covers the topic. With one, it argues a position — and that's what viewers share.</p>
        </Section>
        <Section title="Step 3 — Set your niche and video length">
          <Bullet items={[
            "Niche tells the AI which hook pattern, tone, and vocabulary works best for your audience",
            "Video length controls word count: Short (2-3 min) = 200 words, Long (8-10 min) = 500 words, Ultra Long = 600+ words",
            "Viral Magnet Word — optional trending word that gets woven into the title automatically",
          ]} />
        </Section>
        <Section title="Step 4 — Generate and review">
          <Bullet items={[
            "Hit Generate Script — takes 15-30 seconds",
            "Review the HOOK first — this is the highest-impact section. If it doesn't grab you, click Rewrite Hook (3 rewrites available per script)",
            "Read the full script aloud — if you stumble, edit it. TTS reads exactly what's written.",
            "Check for em dashes or long sentences — Skripr strips these, but always review",
          ]} />
        </Section>
        <Section title="Step 5 — Copy and go">
          <Bullet items={[
            "Copy the full script to your TTS tool (ElevenLabs, Murf, Play.ht)",
            "Use the generated title as your YouTube title starting point",
            "Run the script through Compliance check before upload if it covers a sensitive topic",
            "Use Metadata tab to generate SEO-optimized tags and description",
          ]} />
        </Section>
        <Tip>The fastest workflow: Topic Only → Suggest Angles → pick one → Generate → Rewrite Hook once → Copy. Under 3 minutes from idea to script if you know your topic.</Tip>
      </div>
    ),
  },
  {
    title: "Viral Magnet Titles: How to Pick Words That Drive Clicks",
    category: "Titles",
    level: "Intermediate",
    duration: "6 min",
    emoji: "✨",
    summary: "The title is decided before the video is made. Magnet words are the specific vocabulary that signals this video is worth clicking.",
    content: (
      <div>
        <Section title="What is a magnet word?">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>A magnet word is a high-emotional-trigger word that YouTube data shows correlates with above-average click-through rates in a specific niche. They are not random — they are the vocabulary that top-performing creators consistently use because viewers respond to them instinctively.</p>
        </Section>
        <Section title="The S/A/B/C tier system">
          <Bullet items={[
            "S-Tier — The highest-impact words in your niche. These appear in viral titles consistently across top channels. Use sparingly — one per title maximum.",
            "A-Tier — Strong performers. Good for reinforcing your hook or adding urgency without oversaturation.",
            "B-Tier — Solid supporting words. Work best in combination with an S or A-tier word to build context.",
            "C-Tier — Functional words. They do not spike CTR on their own but they complete the sentence without diluting it.",
          ]} />
        </Section>
        <Section title="How to build a title using Skripr's Viral Magnet tool">
          <Bullet items={[
            "Enter your video topic and optionally paste your script for better word suggestions",
            "Browse the word grid — words are grouped by tier and color-coded by impact level",
            "Select up to 3 magnet words that feel natural together — the tool generates 8 title options",
            "You get 3 same-formula variations and 5 new formula titles so you can see how the words behave in different structures",
            "Copy the title that fits your script best — come back and try alternatives if CTR underperforms",
          ]} />
        </Section>
        <Section title="Common mistakes with title words">
          <Bullet items={[
            "Stacking S-tier words — triggers spam filters and looks desperate to the algorithm",
            "Using tier words that do not match the video tone — a calm educational video with an aggressive title creates viewer distrust",
            "Ignoring niche context — a word that is S-tier in fitness is B-tier at best in finance",
          ]} />
        </Section>
        <Tip>Use Viral Magnet before you script, not after. The title should inform how you frame the hook and the angle — not be retrofitted to a script you already wrote.</Tip>
      </div>
    ),
  },
  {
    title: "Metadata Strategy: How YouTube Decides Who Sees Your Video",
    category: "Growth",
    level: "Intermediate",
    duration: "7 min",
    emoji: "📊",
    summary: "Your title, tags, and description do not just describe your video — they determine which surface YouTube places it on and who it recommends it to.",
    content: (
      <div>
        <Section title="The three YouTube discovery surfaces">
          <Bullet items={[
            "Search — Viewer types a query. Best served by keyword-first titles under 60 characters with the primary keyword in the first 5 words.",
            "Browse (Home Feed) — Viewer is scrolling their homepage. Best served by hook-first titles that create curiosity or emotional tension — no keyword stuffing required.",
            "Suggested Videos — Viewer finishes a video and sees yours recommended. Driven by topic cluster matching between your tags and the tags used by channels your target viewer already watches.",
          ]} />
        </Section>
        <Section title="Why most creators optimize for only one surface">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>Most YouTube SEO advice is about search optimization. That advice is not wrong — but it ignores the fact that 70%+ of most channels' views come from Browse and Suggested, not search. Skripr generates Search, Browse, and Hybrid titles separately so you can match the title type to how you plan to grow.</p>
        </Section>
        <Section title="The tag cluster strategy">
          <Bullet items={[
            "Anchor tags (1-3) — Exact match of your primary keyword and its closest variations. These tell YouTube what your video is about.",
            "Long-tail tags (4-10) — 3-5 word phrases that real viewers type into search. Be specific: how to lose weight fast, not just weight loss.",
            "Cluster-match tags (11-16) — The terminology that major channels in your niche use consistently. These place your video in the same recommendation cluster as those channels so when viewers finish their videos, yours appears next.",
            "Broad discovery tags (17-20) — Wider terms that expand reach beyond your core audience to adjacent viewers.",
          ]} />
        </Section>
        <Section title="The description above the fold">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>The first 2-3 sentences of your description appear before the Show More cutoff and are the text YouTube crawls most heavily for search indexing. Front-load your primary keyword naturally in the first sentence. This is also the only text visible in Google search snippets when your video ranks there.</p>
        </Section>
        <Tip>Use Search titles when targeting a specific query. Use Browse titles when relying on subscriber feed and homepage recommendations. Use Hybrid when your video could perform on both — common for evergreen topics with broad appeal.</Tip>
      </div>
    ),
  },
  {
    title: "A/B Testing Titles: How to Find the Winner Without Guessing",
    category: "Titles",
    level: "Intermediate",
    duration: "5 min",
    emoji: "⚡",
    summary: "Most creators publish a title and forget it. The ones who grow fastest treat the title as a variable — and keep testing until the data shows them a winner.",
    content: (
      <div>
        <Section title="What you are actually testing">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>A/B testing a YouTube title means publishing with Title A, measuring CTR over 48 hours, then swapping to Title B if performance is below benchmark. YouTube does not reset view history when you change a title — but it does serve the new title to new viewers, so you get a clean test on fresh impressions.</p>
        </Section>
        <Section title="CTR benchmarks to know">
          <Bullet items={[
            "Below 2% — Poor. The title or thumbnail is not connecting. Swap both.",
            "2-4% — Below average. The title is probably fine but not compelling. Test a stronger angle.",
            "4-6% — Average. You are getting clicks but there is room to improve. Try a Browse-optimized title.",
            "6-10% — Good. Keep this title and focus on retention instead of CTR.",
            "10%+ — Exceptional. Your hook is working. Double down on similar title structures.",
          ]} />
        </Section>
        <Section title="The 48-hour rule">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>Wait at least 48 hours before evaluating CTR. Videos often spike in the first 24 hours from your subscriber feed — this audience is predisposed to click because they already follow you. The 48-hour mark captures Browse and Suggested traffic, which is colder and more representative of how the title performs with strangers.</p>
        </Section>
        <Section title="How to use Skripr's A/B Titles feature">
          <Bullet items={[
            "Generate metadata in the Metadata Generator — you get 4 Search, 4 Browse, and 2 Hybrid titles",
            "Star any titles you want to save — they appear in the A/B Titles section in the sidebar",
            "Pick one title for upload — use it for 48 hours and check CTR in YouTube Studio Analytics",
            "If CTR is below 4%, copy the next title from your A/B Titles list and paste it into YouTube Studio",
            "Repeat until you find the title that reaches 6%+ CTR — then leave it alone",
          ]} />
        </Section>
        <Tip>Never A/B test thumbnail and title at the same time. Change one variable at a time. If both change simultaneously, you will not know which drove the CTR improvement.</Tip>
      </div>
    ),
  },
  {
    title: "Viral Remixer: Borrow the Format, Not the Content",
    category: "Growth",
    level: "Intermediate",
    duration: "5 min",
    emoji: "🔁",
    summary: "The best YouTube formats are infinitely remixable. A video that went viral in one niche contains a structural blueprint you can transplant directly into yours.",
    content: (
      <div>
        <Section title="What makes a format remixable?">
          <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>A format is the structural skeleton of a video — the sequence of emotional beats, reveal timing, pacing, and hook type — stripped of its content. A 30-day challenge format is remixable. The specific challenge is just content. The structure is what drives retention, and that structure works regardless of topic.</p>
        </Section>
        <Section title="How to use the Viral Remixer">
          <Bullet items={[
            "Paste a URL of a video that performed well — either in your niche or a completely different one",
            "Skripr extracts the transcript, identifies the hook type, structural pattern, and pacing",
            "Select how aggressively to remix — subtle keeps the original flow, aggressive transplants the format into a new angle",
            "Get a remixed script where the structure mirrors the viral video but the content is entirely yours",
            "Use this as a starting point — the hook, open loop placement, and re-hook timing are already battle-tested",
          ]} />
        </Section>
        <Section title="What to remix vs what to avoid">
          <Bullet items={[
            "Remix: hook type and opening tension setup",
            "Remix: where the re-hook appears relative to total video length",
            "Remix: open loop placement and escalation pattern",
            "Remix: callback structure at the end",
            "Do NOT copy: specific facts, stories, or examples — that is plagiarism",
            "Do NOT remix: elements that only work because of a specific creator's face or personal brand",
          ]} />
        </Section>
        <Section title="Best sources to remix from">
          <Bullet items={[
            "Channels in a completely different niche with 2M+ views on the video — they have proven the format works at scale",
            "Videos that are 2-4 years old in your niche — the format is proven but the content is outdated and can be refreshed",
            "Viral explainer videos — the structure of problem, failed attempts, counterintuitive solution, and proof translates to almost any topic",
          ]} />
        </Section>
        <Tip>The best remixing targets are videos that outperformed their channel average by 3x or more. That spike means the format — not just the topic — drove the performance.</Tip>
      </div>
    ),
  },
];

export default function EducatePage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "fixed", bottom: -180, left: -120, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.09) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, marginBottom: 6 }}>Learn</h1>
          <p style={{ color: C.textDim, fontSize: 15, lineHeight: 1.6 }}>Everything you need to grow a faceless YouTube channel with Skripr</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lessons.map((lesson, i) => {
            const lc = levelColor(lesson.level);
            const isOpen = openIdx === i;
            return (
              <div
                key={i}
                style={{
                  borderRadius: 16,
                  background: isOpen ? C.cardOpen : C.cardBg,
                  border: `1px solid ${isOpen ? C.borderOpen : C.border}`,
                  overflow: "hidden",
                  transition: "border-color 200ms, background 200ms",
                }}
              >
                {/* Header — always visible */}
                <button
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  style={{
                    width: "100%",
                    padding: "18px 22px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{lesson.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ padding: "2px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: lc.bg, color: lc.color, letterSpacing: 0.3 }}>{lesson.level}</span>
                      <span style={{ fontSize: 11, color: C.textDim, background: "rgba(99,102,241,0.08)", padding: "2px 8px", borderRadius: 6 }}>{lesson.category}</span>
                      <span style={{ fontSize: 11, color: C.textDim }}>{lesson.duration} read</span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: C.textBright, margin: 0, lineHeight: 1.4 }}>{lesson.title}</h3>
                    {!isOpen && <p style={{ fontSize: 13, color: C.textDim, margin: "4px 0 0", lineHeight: 1.5 }}>{lesson.summary}</p>}
                  </div>
                  <span style={{ fontSize: 18, color: C.accent, flexShrink: 0, transition: "transform 200ms", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>⌄</span>
                </button>

                {/* Content — shown when open */}
                {isOpen && (
                  <div style={{ padding: "0 22px 22px", borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
                    <p style={{ fontSize: 14, color: "#a5b4fc", marginBottom: 20, lineHeight: 1.6, fontStyle: "italic" }}>{lesson.summary}</p>
                    {lesson.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 32, padding: "20px 24px", borderRadius: 16, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.14)", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>More lessons coming soon — covering thumbnail design, monetization strategy, and advanced channel growth. <span style={{ color: C.accent }}>Ideas? Email skripr.app@gmail.com</span></p>
        </div>
      </div>
    </div>
  );
}
