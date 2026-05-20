import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const words = [
  // ─── S-TIER ───
  { word: "secretly", grade: "S", category: "Intrigue", lift_range: "+38-52%", why_it_works: "Implies hidden knowledge most people don't have access to — triggers exclusivity and FOMO instantly.", example_before: "How creators grow on YouTube", example_after: "how creators are secretly doubling their views", niches: [] },
  { word: "actually", grade: "S", category: "Reframe", lift_range: "+35-48%", why_it_works: "Signals the viewer's current belief is wrong — creates a curiosity gap that demands resolution.", example_before: "AI tools for YouTube", example_after: "what AI tools actually do to your retention", niches: [] },
  { word: "nobody", grade: "S", category: "Exclusivity", lift_range: "+40-55%", why_it_works: "Implies the viewer is about to access information that the crowd doesn't have. Pure exclusivity trigger.", example_before: "Growing a channel from zero", example_after: "what nobody tells you about growing from zero", niches: [] },
  { word: "quietly", grade: "S", category: "Stealth", lift_range: "+36-50%", why_it_works: "Implies something significant is happening under the radar — creates urgency to catch up before everyone else.", example_before: "Algorithm changes in 2024", example_after: "why the algorithm is quietly punishing this mistake", niches: [] },
  { word: "hidden", grade: "S", category: "Discovery", lift_range: "+38-54%", why_it_works: "Discovery framing — implies there's a layer beneath what everyone else can see.", example_before: "YouTube monetization tips", example_after: "the hidden reason your monetization is lower than expected", niches: [] },
  { word: "exposed", grade: "S", category: "Revelation", lift_range: "+42-58%", why_it_works: "Controversy + revelation combined. Feels like something previously suppressed is being uncovered.", example_before: "The truth about faceless channels", example_after: "faceless channels exposed — what they don't show you", niches: [] },
  { word: "truth", grade: "S", category: "Authenticity", lift_range: "+33-47%", why_it_works: "Signals that everything the viewer has been told before was false or incomplete.", example_before: "Building an audience online", example_after: "the truth about building an audience nobody wants to say", niches: [] },
  { word: "revealed", grade: "S", category: "Disclosure", lift_range: "+35-49%", why_it_works: "Passive framing that makes the viewer feel they're receiving privileged information being unlocked for them.", example_before: "Viral video formula", example_after: "the viral video formula finally revealed (it's not what you think)", niches: [] },
  // ─── A-TIER ───
  { word: "destroyed", grade: "A", category: "Stakes", lift_range: "+28-40%", why_it_works: "High-stakes outcome language — implies serious consequence the viewer needs to avoid or understand.", example_before: "Common YouTube mistakes", example_after: "the one mistake that destroyed a 100k channel overnight", niches: [] },
  { word: "ruined", grade: "A", category: "Consequence", lift_range: "+26-38%", why_it_works: "Consequence framing creates empathy and warning — viewer wants to avoid the same fate.", example_before: "Niche selection mistakes", example_after: "how picking the wrong niche ruined 3 years of work", niches: [] },
  { word: "wrong", grade: "A", category: "Correction", lift_range: "+25-37%", why_it_works: "Everyone fears being wrong. Signals that a common belief the viewer holds is incorrect.", example_before: "Growing with YouTube Shorts", example_after: "everything you know about Shorts is wrong", niches: [] },
  { word: "real", grade: "A", category: "Authenticity", lift_range: "+24-36%", why_it_works: "Cuts through filtered content. Viewers crave unfiltered reality — 'real' promises they'll get it.", example_before: "YouTube income at 100k subscribers", example_after: "the real YouTube income at 100k (not the highlight reel)", niches: [] },
  { word: "dangerous", grade: "A", category: "Warning", lift_range: "+27-39%", why_it_works: "Warns of a risk the viewer is likely unaware of — creates urgency to watch immediately.", example_before: "Outsourcing your YouTube content", example_after: "why outsourcing your YouTube content is more dangerous than you think", niches: [] },
  { word: "mistake", grade: "A", category: "Learning", lift_range: "+24-35%", why_it_works: "Mistake framing is highly relatable — most creators fear making errors they don't know about.", example_before: "Building a YouTube channel", example_after: "the silent mistake killing most YouTube channels in month 3", niches: [] },
  { word: "trap", grade: "A", category: "Warning", lift_range: "+26-38%", why_it_works: "Implies the viewer is being manipulated or misled without knowing it — triggers protective instinct.", example_before: "Viral video strategies", example_after: "the viral strategy trap most creators fall into", niches: [] },
  { word: "brutal", grade: "A", category: "Honesty", lift_range: "+23-34%", why_it_works: "Promises radical transparency. Viewers are tired of sugar-coated advice — brutal implies real talk.", example_before: "Honest YouTube growth advice", example_after: "brutal truth about YouTube growth in 2024", niches: [] },
  { word: "fake", grade: "A", category: "Authenticity", lift_range: "+25-36%", why_it_works: "Exposes something fraudulent — creates distrust of conventional wisdom and makes the creator the trustworthy alternative.", example_before: "YouTube growth strategies that work", example_after: "the fake YouTube growth strategies everyone keeps recommending", niches: [] },
  { word: "silent", grade: "A", category: "Hidden Force", lift_range: "+24-35%", why_it_works: "Something operating in the background, unseen — implies the viewer is affected without knowing it.", example_before: "Things hurting your channel", example_after: "the silent algorithm change hurting small channels right now", niches: [] },
  { word: "killing", grade: "A", category: "Impact", lift_range: "+28-41%", why_it_works: "Strong outcome language — implies something is causing serious, ongoing damage to the viewer's results.", example_before: "Why videos underperform", example_after: "the one habit quietly killing your video performance", niches: [] },
  { word: "broken", grade: "A", category: "Problem", lift_range: "+22-33%", why_it_works: "Diagnoses a system the viewer relies on as fundamentally flawed — creates urgency to find the fix.", example_before: "YouTube advice that doesn't work", example_after: "why the standard YouTube advice is completely broken", niches: [] },
  // ─── B-TIER ───
  { word: "ignored", grade: "B", category: "Overlooked", lift_range: "+18-28%", why_it_works: "Implies the viewer has been leaving value on the table by not noticing something obvious.", example_before: "YouTube analytics features", example_after: "the ignored analytics feature that predicts viral videos", niches: [] },
  { word: "missed", grade: "B", category: "FOMO", lift_range: "+17-27%", why_it_works: "Fear of missing out — viewer feels they've already lost something and need to catch up.", example_before: "YouTube growth opportunities", example_after: "the growth window most creators completely missed", niches: [] },
  { word: "banned", grade: "B", category: "Forbidden", lift_range: "+20-30%", why_it_works: "Forbidden knowledge framing — implies the information is being suppressed or restricted.", example_before: "YouTube monetization strategies", example_after: "the monetization strategy YouTube quietly banned creators from using", niches: [] },
  { word: "toxic", grade: "B", category: "Warning", lift_range: "+18-27%", why_it_works: "Strong negative framing that implies ongoing harm — creates urgency to identify and eliminate the problem.", example_before: "Common YouTube habits", example_after: "5 toxic YouTube habits creators defend but secretly regret", niches: [] },
  { word: "outdated", grade: "B", category: "Timely", lift_range: "+16-25%", why_it_works: "Signals that the viewer's current strategy is no longer working — creates urgency to update.", example_before: "YouTube growth tactics", example_after: "the outdated YouTube tactics that are now hurting your channel", niches: [] },
  { word: "overrated", grade: "B", category: "Contrarian", lift_range: "+17-26%", why_it_works: "Contrarian framing — challenges popular opinion and signals the creator has a better perspective.", example_before: "Viral video advice", example_after: "the most overrated viral video advice creators keep following", niches: [] },
  { word: "underrated", grade: "B", category: "Discovery", lift_range: "+16-24%", why_it_works: "Discovery framing — implies the viewer will learn about something valuable most people dismiss.", example_before: "YouTube growth strategies", example_after: "the most underrated YouTube growth strategy in 2024", niches: [] },
  { word: "uncomfortable", grade: "B", category: "Honest", lift_range: "+15-24%", why_it_works: "Implies the creator is going to say something most people avoid saying — raw honesty hook.", example_before: "The creator economy reality", example_after: "the uncomfortable reality of the creator economy nobody discusses", niches: [] },
  { word: "strange", grade: "B", category: "Curiosity", lift_range: "+16-25%", why_it_works: "Pattern interrupt — implies something unusual or counterintuitive about a familiar topic.", example_before: "What makes videos go viral", example_after: "the strange reason some videos go viral 6 months after posting", niches: [] },
  { word: "dark", grade: "B", category: "Intrigue", lift_range: "+17-26%", why_it_works: "Implies the creator is going to expose the negative side of something the viewer participates in.", example_before: "Behind the scenes of viral channels", example_after: "the dark side of viral YouTube channels nobody admits", niches: [] },
  // ─── C-TIER ───
  { word: "proven", grade: "C", category: "Credibility", lift_range: "+10-18%", why_it_works: "Adds social proof and reduces viewer skepticism — implies the method has been validated.", example_before: "YouTube growth system", example_after: "the proven YouTube growth system behind 50+ channels", niches: [] },
  { word: "simple", grade: "C", category: "Accessibility", lift_range: "+9-16%", why_it_works: "Reduces perceived barrier to entry — viewer believes they can execute the strategy.", example_before: "Getting your first 1000 subscribers", example_after: "the simple system behind getting your first 1000 subscribers", niches: [] },
  { word: "exact", grade: "C", category: "Specificity", lift_range: "+11-19%", why_it_works: "Precision framing — viewer expects a concrete, actionable template rather than vague advice.", example_before: "Video script formula", example_after: "the exact script formula behind 10M-view videos", niches: [] },
  { word: "weird", grade: "C", category: "Curiosity", lift_range: "+12-20%", why_it_works: "Pattern interrupt — signals something counterintuitive or unexpected is about to be shared.", example_before: "Retention trick for videos", example_after: "the weird retention trick that keeps viewers to the end", niches: [] },
  { word: "untold", grade: "C", category: "Exclusive", lift_range: "+13-21%", why_it_works: "Implies suppressed or overlooked narrative — viewer feels they're getting the version nobody else has.", example_before: "Story of a viral channel", example_after: "the untold story of how this channel went from 0 to 1M", niches: [] },
];

async function seed() {
  console.log("Seeding", words.length, "magnet words...");
  const { data, error } = await supabase
    .from("magnet_words")
    .upsert(
      words.map(w => ({ ...w, is_active: true })),
      { onConflict: "word" }
    );
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Done! Seeded", words.length, "words.");
  }
}

seed();
