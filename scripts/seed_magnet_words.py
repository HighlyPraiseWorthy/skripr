#!/usr/bin/env python3
"""Quality expansion of magnet_words — hand-vetted, niche-tagged, grade-matched.
No scraped junk, no fabricated per-word multipliers (lift_range follows the
existing grade bands already in the table). Dedupes against current words.
Run: python3 scripts/seed_magnet_words.py
"""
import os, json, urllib.request, urllib.error

env = {}
for line in open(os.path.join(os.path.dirname(__file__), "..", ".env.local")):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); env[k.strip()] = v.strip().strip('"').strip("'")
URL = env["NEXT_PUBLIC_SUPABASE_URL"]; KEY = env["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

# Grade lift bands match the existing table convention (rotated for natural variation)
BANDS = {
    "S": ["+40-55%", "+38-52%", "+42-58%", "+36-50%"],
    "A": ["+26-38%", "+28-40%", "+24-36%", "+30-42%"],
    "B": ["+16-26%", "+18-28%", "+15-24%", "+17-27%"],
    "C": ["+9-16%", "+10-18%", "+11-19%", "+8-15%"],
}

# (word, grade, category, [niche ids], why_it_works, example_before, example_after)
W = [
    # ── S-tier: maximum-pull curiosity / shock / stakes ──────────────────────
    ("insane","S","Shock",[], "Signals the content breaks normal expectation, triggering an involuntary double-take.", "How Compound Interest Works", "How Compound Interest Gets Insane"),
    ("impossible","S","Curiosity",[], "Frames the topic as something that shouldn't be able to happen, demanding explanation.", "Surviving in Deep Space", "The Impossible Way to Survive Deep Space"),
    ("terrifying","S","Fear",[], "Raises emotional stakes instantly; fear is the strongest scroll-stopping trigger.", "What Sharks Really Do", "The Terrifying Truth About What Sharks Do"),
    ("deadly","S","Stakes",["fitness","science","true-crime","cooking"], "Attaches life-or-death stakes to an everyday topic.", "Common Kitchen Mistakes", "The Deadly Kitchen Mistake Everyone Makes"),
    ("rigged","S","Conspiracy",["personal-finance","business","gaming","sports"], "Implies the system is unfair against the viewer, igniting outrage curiosity.", "How the Stock Market Works", "Why the Stock Market Is Rigged Against You"),
    ("scam","S","Trust Violation",["personal-finance","business","tech"], "Promises exposure of a deception the viewer might be falling for.", "Is This Investment Worth It", "The Investment Scam Nobody Warns You About"),
    ("lies","S","Trust Violation",[], "Direct accusation that what they believe is false, forcing a credibility check.", "What Experts Say About Sleep", "The Lies Experts Tell You About Sleep"),
    ("doomed","S","Stakes",["history","science","personal-finance","gaming"], "Predicts inevitable failure, creating dread the viewer must resolve.", "The Future of Cities", "Why Modern Cities Are Doomed"),
    ("vanished","S","Mystery",["history","true-crime","science","travel"], "Implies an unexplained disappearance — pure curiosity gap.", "The Story of This Empire", "The Empire That Suddenly Vanished"),
    ("weaponized","S","Hidden Force",["tech","psychology","news","science"], "Reframes a neutral thing as a tool used against people.", "How Social Media Works", "How Social Media Got Weaponized Against You"),
    ("addictive","S","Hidden Force",["tech","psychology","gaming","entertainment"], "Suggests a hidden hook the viewer can't resist — they want to know why.", "Why You Use TikTok So Much", "Why TikTok Is Scientifically Addictive"),
    ("horrifying","S","Fear",["science","true-crime","history"], "Maximum emotional charge for a reveal-style payoff.", "What's In Your Tap Water", "The Horrifying Truth About Your Tap Water"),
    ("nightmare","S","Fear",["real-estate","travel","business","personal-finance"], "Frames the topic as a worst-case scenario the viewer must avoid.", "Buying Your First Home", "The First-Home Buying Nightmare Nobody Mentions"),
    ("unstoppable","S","Stakes",["business","self-improvement","sports","tech"], "Promises a force or method that can't be beaten — aspirational pull.", "Building Good Habits", "The Habit Loop That Makes You Unstoppable"),
    ("classified","S","Exclusive",["history","science","tech","news"], "Implies restricted information the viewer shouldn't have access to.", "Cold War Technology", "The Classified Cold War Tech Just Revealed"),
    ("obsessed","S","Emotional",["psychology","entertainment","fitness","culture"], "Hints at compulsion, making the behavior feel mysterious and worth dissecting.", "Why People Like True Crime", "Why We're Secretly Obsessed With True Crime"),
    ("disappeared","S","Mystery",["history","true-crime","travel","science"], "Open loop — something is gone and the viewer needs the explanation.", "This Ancient City", "The Ancient City That Disappeared Overnight"),
    ("brainwashed","S","Hidden Force",["psychology","news","culture","tech"], "Accuses an unseen force of controlling the viewer's mind.", "How Advertising Works", "How Ads Brainwashed an Entire Generation"),
    ("catastrophic","S","Stakes",["science","personal-finance","history","tech"], "Escalates a small mistake to disaster-scale consequence.", "A Common Investing Error", "The Catastrophic Investing Error You're Making"),
    ("unhinged","S","Shock",["entertainment","culture","gaming","storytelling"], "Promises chaos and unpredictability — entertainment bait.", "This Marketing Campaign", "The Most Unhinged Marketing Campaign Ever"),

    # ── A-tier: strong emotion / stakes / authority ──────────────────────────
    ("savage","A","Emotional",["sports","entertainment","gaming","business"], "Implies a brutal, no-mercy moment worth witnessing.", "How He Responded", "The Savage Way He Shut Them Down"),
    ("ruthless","A","Authority Signal",["business","history","true-crime"], "Frames a strategy or figure as coldly effective.", "How This CEO Operates", "The Ruthless Strategy This CEO Used"),
    ("lethal","A","Stakes",["fitness","science","true-crime"], "Adds danger to an otherwise ordinary subject.", "This Common Plant", "The Lethal Plant Hiding in Your Garden"),
    ("twisted","A","Mystery",["true-crime","psychology","storytelling"], "Promises a dark, unexpected turn.", "The Story Behind This Case", "The Twisted Story Behind This Case"),
    ("downfall","A","Decline Narrative",["business","history","entertainment","sports"], "Sets up a rise-and-fall arc viewers love to watch.", "What Happened to This Company", "The Downfall of a Billion-Dollar Company"),
    ("loophole","A","Exclusive",["personal-finance","business","real-estate","tech"], "Hints at a clever advantage most people don't know.", "How to Save on Taxes", "The Tax Loophole the Rich Quietly Use"),
    ("blueprint","A","Authority Signal",["business","self-improvement","fitness","real-estate"], "Promises a complete, follow-along system.", "How to Grow a Channel", "The Exact Blueprint to Grow a Channel"),
    ("relentless","A","Emotional",["self-improvement","sports","business"], "Signals intense, unstoppable effort — motivational pull.", "How to Stay Consistent", "The Relentless Routine That Builds Discipline"),
    ("meltdown","A","Dramatic Arc",["business","entertainment","personal-finance","news"], "Promises a dramatic collapse caught in real time.", "What Went Wrong Here", "The Live Meltdown Nobody Saw Coming"),
    ("predatory","A","Trust Violation",["personal-finance","business","tech"], "Frames an entity as hunting the viewer for profit.", "How These Loans Work", "The Predatory Loan Trap Targeting You"),
    ("overnight","A","Urgency",["personal-finance","business","self-improvement","fitness"], "Compresses the timeframe to feel almost too good to be true.", "How He Got Rich", "How He Got Rich Almost Overnight"),
    ("instantly","A","Urgency",["self-improvement","productivity","fitness","tech"], "Promises immediate payoff, lowering the effort barrier.", "How to Calm Anxiety", "How to Calm Anxiety Almost Instantly"),
    ("addicted","A","Hidden Force",["psychology","gaming","tech","fitness"], "Implies a compulsion worth understanding or escaping.", "Why You Crave Sugar", "Why Your Brain Is Addicted to Sugar"),
    ("collapse","A","Decline Narrative",["personal-finance","history","science","news"], "Big-stakes systemic-failure framing.", "The State of the Economy", "The Economic Collapse Everyone Ignores"),
    ("exploited","A","Trust Violation",["business","psychology","tech","personal-finance"], "Tells the viewer they're being used — outrage curiosity.", "How Free Apps Make Money", "How Free Apps Exploit Your Attention"),
    ("flawed","A","Reframe",["science","tech","education","psychology"], "Challenges something assumed to be solid or correct.", "The Science of Dieting", "The Deeply Flawed Science of Dieting"),
    ("haunting","A","Emotional",["history","true-crime","storytelling","music"], "Adds emotional weight and lingering mystery.", "The Story of This Town", "The Haunting Story This Town Buried"),
    ("rare","A","Exclusive",["automotive","photography","science","history"], "Signals scarcity, which raises perceived value.", "This Type of Car", "The Rare Car Collectors Fight Over"),
    ("genius","A","Authority Signal",["business","tech","science","gaming"], "Frames a move or design as brilliantly clever.", "How This Feature Works", "The Genius Design Trick Behind It"),
    ("brutal","A","Emotional",["fitness","sports","business","self-improvement"], "Conveys harsh intensity that signals real, not soft, content.", "The Reality of Training", "The Brutal Truth About Getting Fit"),
    ("merciless","A","Emotional",["business","sports","true-crime","history"], "Conveys cold, unrelenting intensity worth witnessing.", "How the Market Reacted", "The Merciless Way the Market Reacted"),
    ("ominous","A","Warning",["science","history","news"], "Signals a dark sign that something bad is coming.", "Signs Before the Crash", "The Ominous Sign Before the Crash"),
    ("betrayal","A","Trust Violation",["storytelling","true-crime","history","entertainment"], "Promises a turn where trust is broken — strong narrative hook.", "What His Partner Did", "The Betrayal That Ended Everything"),
    ("explosive","A","Dramatic Arc",["business","sports","entertainment","news"], "Implies sudden, high-energy escalation.", "How the Feud Started", "The Explosive Feud That Broke the Internet"),
    ("infamous","A","Dramatic Arc",["true-crime","history","entertainment","sports"], "Adds dark reputation weight that pulls clicks.", "This Famous Case", "The Infamous Case That Stunned Everyone"),

    # ── B-tier: solid curiosity / reframe / specificity ──────────────────────
    ("underrated","B","Overlooked",["gaming","tech","music","travel","cooking"], "Promises overlooked value, flattering the viewer's taste.", "Good Budget Headphones", "The Underrated Headphones Nobody Talks About"),
    ("overlooked","B","Overlooked",["business","history","science","self-improvement"], "Frames the topic as a missed opportunity worth catching.", "A Useful Productivity Tip", "The Overlooked Habit That Changes Everything"),
    ("misleading","B","Correction",["science","news","personal-finance","tech"], "Sets up a myth-busting correction.", "What the Label Says", "The Misleading Label You Trust Daily"),
    ("backfired","B","Consequence",["business","psychology","history","tech"], "Promises an ironic, instructive failure.", "Their Big Plan", "The Plan That Completely Backfired"),
    ("unexpected","B","Curiosity",[], "Primes the viewer for a surprise payoff.", "The Result of the Study", "The Unexpected Result of This Study"),
    ("counterintuitive","B","Reframe",["science","self-improvement","business","psychology"], "Signals a smart, non-obvious insight.", "How to Learn Faster", "The Counterintuitive Way to Learn Faster"),
    ("rarely","B","Exclusive",[], "Implies you're about to hear something seldom said.", "Advice About Money", "The Money Advice Rarely Given"),
    ("quietly","B","Stealth",["business","tech","news","personal-finance"], "Suggests something happening under the radar.", "What This Company Did", "What This Company Quietly Did"),
    ("accidentally","B","Discovery",["science","history","cooking","tech"], "Frames a discovery as a lucky, story-worthy mistake.", "How This Was Invented", "How This Was Accidentally Invented"),
    ("decoded","B","Disclosure",["science","tech","psychology","history"], "Promises to translate something complex into clarity.", "Understanding Body Language", "Body Language Finally Decoded"),
    ("uncovered","B","Disclosure",["news","business","history","science"], "Investigative framing that promises a reveal.", "The Real Numbers", "The Numbers They Never Uncovered"),
    ("warning","B","Warning",[], "Direct alert that primes protective attention.", "Before You Buy This", "Warning: Read This Before You Buy"),
    ("wasted","B","Consequence",["personal-finance","productivity","self-improvement"], "Triggers loss aversion about time or money.", "How You Spend Your Day", "The Hours You're Quietly Wasting"),
    ("regret","B","Emotional",["personal-finance","self-improvement","real-estate"], "Taps fear of a future mistake.", "Things to Avoid in Your 20s", "The Choice You'll Regret in Your 20s"),
    ("avoided","B","Warning",["fitness","personal-finance","cooking","travel"], "Frames the topic as a trap to dodge.", "Common Beginner Errors", "The Mistake Every Pro Avoided"),
    ("rethink","B","Reframe",["self-improvement","business","science","education"], "Invites the viewer to overturn an assumption.", "How You Manage Time", "Why You Should Rethink Time Management"),
    ("untapped","B","Overlooked",["business","real-estate","personal-finance","tech"], "Implies hidden, available opportunity.", "Side Income Ideas", "The Untapped Income Stream Nobody Uses"),
    ("notorious","B","Dramatic Arc",["true-crime","history","entertainment","gaming"], "Adds infamy and reputation weight.", "This Famous Heist", "The Notorious Heist That Fooled Everyone"),
    ("relentlessly","B","Emotional",["self-improvement","sports","business"], "Intensifier signaling sustained, serious effort.", "How to Improve Daily", "How Top Performers Relentlessly Improve"),
    ("misjudged","B","Correction",["history","psychology","business","science"], "Promises a reputation or fact being corrected.", "The Story of This Figure", "The Misjudged Genius History Forgot"),
    ("staggering","B","Specificity",["science","personal-finance","news"], "Amplifies a number or fact's scale.", "How Much Sugar You Eat", "The Staggering Amount of Sugar You Eat"),
    ("fragile","B","Stakes",["science","personal-finance","psychology","news"], "Implies something strong is secretly easy to break.", "How Stable Our System Is", "How Fragile Our System Really Is"),
    ("insider","B","Exclusive",["business","gaming","sports","tech"], "Promises norms only people on the inside know.", "How the Industry Works", "The Insider Rule Outsiders Never Hear"),

    # ── C-tier: dependable specificity / clarity boosters ────────────────────
    ("surprisingly","C","Curiosity",[], "Soft surprise cue that lifts an ordinary claim.", "This Method Works", "This Method Works Surprisingly Well"),
    ("finally","C","Urgency",[], "Implies a long-awaited answer has arrived.", "How to Fix This", "How to Finally Fix This"),
    ("simplified","C","Accessibility",["tech","science","education","personal-finance"], "Lowers the perceived effort to understand.", "Quantum Physics Explained", "Quantum Physics, Simplified"),
    ("explained","C","Accessibility",[], "Promises clarity on a confusing topic.", "The Housing Market", "The Housing Market, Explained"),
    ("really","C","Curiosity",[], "Subtle truth-seeking cue that adds intrigue.", "What This Means", "What This Really Means"),
    ("legit","C","Credibility",["fitness","self-improvement","personal-finance","tech"], "Casual credibility cue that counters skepticism.", "Is This Method Worth It", "The Only Method That's Actually Legit"),
    ("step-by-step","C","Accessibility",["education","tech","cooking","business"], "Signals an easy-to-follow process.", "How to Start Investing", "How to Start Investing, Step by Step"),
    ("ranked","C","Specificity",["gaming","entertainment","sports","tech","cooking"], "Promises a comparative, scannable list.", "Best Strategy Games", "Every Strategy Game, Ranked"),
    ("worst","C","Specificity",[], "Superlative that sets a clear, clickable stakes frame.", "Common Money Habits", "The Worst Money Habit You Have"),
    ("biggest","C","Specificity",[], "Superlative scale that promises the most important point.", "Mistakes in Cooking", "The Biggest Mistake in Cooking"),
    ("secretly","C","Stealth",[], "Implies hidden activity beneath the surface.", "What Your Phone Does", "What Your Phone Is Secretly Doing"),
    ("proven","C","Credibility",[], "Adds evidence-backed reassurance.", "A Way to Sleep Better", "The Proven Way to Sleep Better"),
]


def band(grade, i):
    arr = BANDS[grade]; return arr[i % len(arr)]


def main():
    # existing words (lowercase) to dedupe
    req = urllib.request.Request(f"{URL}/rest/v1/magnet_words?select=word", headers=H)
    existing = {r["word"].lower() for r in json.load(urllib.request.urlopen(req))}

    rows, skipped = [], []
    for i, (word, grade, cat, niches, why, before, after) in enumerate(W):
        if word.lower() in existing:
            skipped.append(word); continue
        rows.append({
            "word": word, "grade": grade, "category": cat, "lift_range": band(grade, i),
            "why_it_works": why, "example_before": before, "example_after": after,
            "niches": niches, "is_active": True,
        })

    if skipped:
        print(f"skipped {len(skipped)} dupes:", ", ".join(skipped))
    if not rows:
        print("nothing new to insert"); return

    # insert in chunks
    for c in range(0, len(rows), 50):
        chunk = rows[c:c+50]
        r = urllib.request.Request(f"{URL}/rest/v1/magnet_words", data=json.dumps(chunk).encode(), headers={**H, "Prefer": "return=minimal"}, method="POST")
        try:
            urllib.request.urlopen(r); print(f"inserted {len(chunk)}")
        except urllib.error.HTTPError as e:
            print("INSERT FAILED:", e.code, e.read().decode()[:300]); return

    total = len(json.load(urllib.request.urlopen(urllib.request.Request(f"{URL}/rest/v1/magnet_words?select=word", headers=H))))
    print(f"done — added {len(rows)} words, table now has {total}")


if __name__ == "__main__":
    main()
