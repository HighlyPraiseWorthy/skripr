---
name: seo-voice-qa
description: >
  Final gate before any Skripr SEO copy ships. Use to QA any page, section,
  meta description, FAQ, or CTA written for skripr.app against the voice bible
  and the hard mechanism-accuracy rules. Run this BEFORE building into the repo
  and again BEFORE deploy. Catches the "Skripr finds videos" error, dashes,
  banned SaaS words, fabricated stats, and inaccurate competitor claims.
---

# Skripr voice + brand QA gate

Read `docs/skripr-voice.md` in full before relying on this. This is the
fast checklist; the voice bible is the authority. Fail any item = fix, do not ship.

## Mechanism accuracy (the error we already shipped once — do not reintroduce)

- [ ] The USER brings the proven video or topic. Copy NEVER says Skripr "finds", "discovers", "surfaces", or "knows what's trending."
- [ ] Skripr reverse-engineers WHY a provided video worked (hook, structure, pacing, retention triggers) and writes a fresh script on the user's topic, in their voice.
- [ ] **Outlier Finder** is the ONLY discovery feature, and it is **channel-scoped only**: user gives a channel, it surfaces that channel's breakout videos. Not open-web discovery.
- [ ] The private self-improving / collective-learning layer is NEVER mentioned anywhere public.
- [ ] Approved phrasings for what Skripr extracts: "the formula behind the video", "why it worked", "the hooks and retention patterns", "the viral DNA / the playbook", "retention triggers."

## Voice

- [ ] **No dashes (em or en). Ever.**
- [ ] Short sentences, one idea each. ~fifth-grade reading level.
- [ ] Belief-first: sells/bursts a belief; feature is the proof, outcome is the close.
- [ ] Founder-in-the-trenches tone, not brand-manager. Humanized by default (apply the `humanizer` skill if it reads like AI).
- [ ] No banned SaaS words: game-changing, revolutionary, amazing, unlock, supercharge, leverage, seamless, robust, powerful, streamline, cutting-edge, next-level, elevate.
- [ ] No dated copy tropes: "blank page", "blank doc", "blank canvas", "blank prompt", "blank template", "blinking cursor". Use "from scratch" / "from zero" / "from nothing" instead.

## No fabricated anything (Skripr is pre-traction)

- [ ] No invented stats, user counts, ratings, or results. Real numbers only.
- [ ] Real YouTube data blocks are labeled "Source: public YouTube data" and framed as "the kind of proven video you bring to Skripr", NEVER "videos Skripr found."

## Comparison / alternative pages

- [ ] Competitor's ACTUAL capabilities verified before claiming "X cannot do Y." Never invent a competitor limitation. (See memory `feedback_comparison_accuracy`.)
- [ ] Lead with what the competitor is genuinely good at, then the honest Skripr wedge.
- [ ] Wedge vs general AI (ChatGPT/Gemini/Claude) = "they write from a blank page; you bring Skripr a proven video and it reverse-engineers why it worked" — NOT "Skripr knows what's trending."

## CTA

- [ ] Ends on a funnel CTA to `/sign-up` ("Start free, 2 scripts"). Gate CTAs say "Get Starter/Pro", never "Unlock."
