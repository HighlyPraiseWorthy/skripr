// Auto-derived Director's notes.
//
// A human reviewer, checking these scripts by hand, found that almost every note
// they wrote was not editorial judgement but DERIVATION: a rule applied to a
// property the research already carries. "Keep the attribution", "state both sides
// of the dispute", "don't imply a win when the case collapsed", "these ranks are
// distinct" — each is computable from the fact set, the case type, or the angle.
//
// This module computes those notes so an ordinary user gets the same guidance the
// reviewer was supplying by hand, pre-filled into the Director's-note field with a
// short reason for each. The user can uncheck any line. Two sources named in the
// reviewer's spec are deliberately NOT computed here yet: contamination (needs the
// user's recent-script entities) and slot-derived climax/act-three (needs the
// structural-slots card change). Those are follow-ups, flagged in the UI copy.

export interface DirectorNote {
  // Short provenance label shown to the user, e.g. "From your facts", "Case type: MC".
  source: string;
  // The instruction itself, written the way it will read in the note field.
  note: string;
  // Whether it starts checked. Everything derived from the actual research starts on;
  // standing channel defaults also start on. Nothing here is speculative.
  on: boolean;
}

// Pull the fact lines out of the assembled source material. buildSourceMaterial in
// ResearchStep emits "- <fact> (source: <url>)" lines plus a case header; we only
// need the prose to pattern-match against, so a lowercased blob is enough.
function factText(sourceMaterial?: string): string {
  return (sourceMaterial || "").toLowerCase();
}

const CASE_TYPES: { test: RegExp; label: string; note: string }[] = [
  {
    test: /\b(motorcycle club|biker|hells angels|mongols|outlaw club|full[- ]patch|\bprospect\b|hang[- ]?around|clubhouse)\b/,
    label: "Case type: motorcycle club",
    note: "Hang-around, prospect and full-patch member are distinct ranks. Use them in order and never merge them (no \"fully patched prospect\").",
  },
  {
    test: /\b(espionage|spy|classified|security clearance|satellite|kgb|\bcia\b|\bnsa\b|state secrets|microfilm|defector)\b/,
    label: "Case type: espionage",
    note: "Clearance, classification and compartmentalization are distinct facts. Keep them precise and don't inflate access.",
  },
  {
    test: /\b(cartel|sicario|\bplaza\b|drug traffick|kingpin|smuggl|narco)\b/,
    label: "Case type: cartel",
    note: "Plaza, sicario and distribution cell are specific roles. Don't blur them into generic \"gang\" language.",
  },
  {
    test: /\b(mafia|\bmob\b|cosa nostra|made man|\bcapo\b|consigliere|crime family|wiseguy)\b/,
    label: "Case type: mafia",
    note: "Associate, made man, capo and boss are distinct ranks. Keep the hierarchy straight.",
  },
];

/**
 * Derive Director's notes from the grounded research and the chosen angle. Pure and
 * deterministic so it can be unit-tested offline. Order: fact-derived rules first
 * (most specific to this script), then case-type vocabulary, then the angle-derived
 * climax cue, then standing channel defaults.
 */
export function deriveDirectorNotes(input: { sourceMaterial?: string; angle?: string; caseName?: string; slot?: string; topicKind?: "event" | "explainer" | "hypothetical" | "claim" }): DirectorNote[] {
  const notes: DirectorNote[] = [];
  const t = factText(input.sourceMaterial);
  const hasFacts = t.trim().length > 0;

  if (hasFacts) {
    // Attribution. A fact carried as "X said / claimed / wrote / denied" is a report,
    // not a settled fact, and the script must keep that framing (the arson rule).
    if (/\b(said|claimed|wrote|recalled|alleged|reportedly|according to|denied|testified|maintains?|insists?)\b/.test(t)) {
      notes.push({ source: "From your facts", on: true, note: "Some facts are attributed (\"X said…\"). Keep the attribution — don't promote them into settled fact." });
    }
    // Contested / disputed material. State both sides, resolve neither.
    if (/\b(disput|conflicting|contradict|unresolved|never (?:fully )?resolved|denied that|both accounts)\b/.test(t)) {
      notes.push({ source: "From your facts", on: true, note: "A key point is disputed. State both accounts and resolve neither; the unresolved version is stronger." });
    }
    // Contested CAUSE — a destructive INCIDENT whose cause was investigated but never
    // proven. Deliberately narrow: it must name a physical incident (arson, fire,
    // bombing) AND explicitly say the cause was unproven. It must NOT fire on "death
    // threats" or generic "threats" (no contested cause there) — that was the Queen
    // false positive that hedged the aftermath into mush.
    if (/\b(arson|burned down|set (?:on )?fire|firebomb\w*|explosion|bombing)\b/.test(t)
        && /(never (?:proven|charged|attributed|solved|identified)|no one was (?:charged|arrested)|cause (?:was )?(?:disputed|unknown|never)|remains unsolved|investigated but)/.test(t)) {
      notes.push({ source: "From your facts", on: true, note: "The cause of that incident was investigated and never proven. Narrate the event but do not name a culprit." });
    }
    // Living person tied to an unproven allegation. Name the outcome, don't assert.
    // BUT a plea or conviction IS the documented outcome — the allegation is no longer
    // "unproven", so this note (and the Villain suppression it drives) must NOT fire. It
    // was disabling the Villain for Tavon White and Michael Smith, both of whom pleaded
    // guilty. Proven guilt clears it.
    // Narrow to INDIVIDUAL verdicts (a plea, a guilty finding, an admission). Deliberately
    // NOT bare "conviction(s)": an aggregate takedown count ("53 convictions") is usually
    // co-defendants, and must not clear an allegation about the central figure.
    const provenGuilt = /\b(pleaded|pled|plead) (?:guilty|no contest)|guilty plea|found guilty|admitted (?:guilt|to (?:the )?(?:charge|crime|scheme|fraud|allegation))/i.test(t);
    if (!provenGuilt && (/\b(alleged|accused|suspected of)\b|claimed (?:he|she|they|\w+) (?:snorted|used|committed|did|killed|smuggl|trafficked|dealt|stole|took)|reportedly (?:committed|did)/.test(t))) {
      notes.push({ source: "From your facts", on: true, note: "Don't assert unproven allegations about a named, living person. Name the documented outcome instead." });
    }
    // Outcome that did NOT hold. Don't imply a clean win.
    if (/\b(collapsed|fell apart|dismissed|overturned|acquitted|thrown out|pleaded to (?:far )?lesser|charges reduced|hung jury|mistrial|largely (?:fell|collapsed))\b/.test(t)) {
      notes.push({ source: "From your facts", on: true, note: "The case did not fully hold. Don't imply a clean win; state what was and wasn't proven." });
    }
  }

  // Science-shaped accuracy rules. A science explainer's failure mode is not a
  // fabricated auditor, it is smoothing a model into a fact and dropping the units.
  const scienceSlot = ["premise", "mechanism", "scale", "consequence", "open-question"].includes((input.slot || "").toLowerCase());
  const looksScientific = /\b(model(?:s|led|ing)?|simulation|hypothes\w+|theory|estimated|approximately|per (?:second|year)|degrees|kilometers|kelvin|joules|orders of magnitude|researchers|study|studies)\b/.test(t);
  if (hasFacts && (scienceSlot || looksScientific)) {
    notes.push({ source: "Science accuracy", on: true, note: "Keep every number with its unit and say what was measured. Never round a figure into a bigger, rounder one for effect." });
    notes.push({ source: "Science accuracy", on: true, note: "Distinguish measured from modelled. If the record says simulations or estimates, say so — never state a projection as an observed fact or imply consensus where the literature is split." });
  }
  // Correlational findings are the commonest way a science script overclaims: a study
  // finds a link, the script says it causes. Fires on the language of association.
  if (hasFacts && /\b(associat\w+|correlat\w+|linked to|more likely to|risk factor|observational|self-report\w*|survey|cohort)\b/.test(t)) {
    notes.push({ source: "From your facts", on: true, note: "These findings are correlational. Say people who do X report more Y — never that X causes, drives, or rewires anything. Do not upgrade a link into a cause." });
  }

  // Case-type vocabulary lock.
  const domainHay = `${input.caseName || ""} ${t}`.toLowerCase();
  for (const ct of CASE_TYPES) {
    if (ct.test.test(domainHay)) { notes.push({ source: ct.label, on: true, note: ct.note }); break; }
  }

  // Angle-derived climax cue. When the facts contain a clear terminal event (a
  // takedown, verdict, capture, arrests/convictions), point the climax at it AND
  // ask for it staged as a scene — the one instruction the generator keeps missing.
  // The peak belongs to the CHOSEN ANGLE, not to whatever ending exists in the facts.
  // Hardcoding "the takedown/verdict" pointed a MECHANISM card (the gun to the head) at
  // the wrong scene — the same mistake a human reviewer made by hand, which the
  // generator was right to ignore. Derive the aim from the card's structural slot.
  const slot = (input.slot || "").toLowerCase();
  // Some slot notes presuppose a SHAPE that must actually be in the facts. Asking for "a
  // documented sequence with timescales" on a fact set that contains no timescale and no
  // ordered steps sent the writer hunting for a timeline that doesn't exist (it misfired
  // four times in a row, then landed only on the nicotine set, which really had one). So
  // read the fact set first and only ask for what it can support.
  const hasTimescale = /\b(\d+(?:\.\d+)?\s*(?:second|minute|hour|day|week|month|year|decade|millisecond|microsecond)s?|half-?life|per (?:second|minute|hour|day|year)|within (?:a|\d)|over (?:the )?(?:next |following )?\d)\b/i.test(t);
  const hasSequence = /\b(first|then|next|afterwards?|subsequently|followed by|stage|phase|step|leads? to|in order|sequence|eventually|finally|begins? with|ends? with)\b/i.test(t);
  const hasComparison = /\b(more than|compared (?:to|with)|equivalent to|the size of|as (?:much|many|big|large) as|times (?:more|larger|bigger|the|as)|combined|bigger than|greater than|dwarf|orders of magnitude)\b/i.test(t);
  // The consequence peak: only ask for the ordered-timeline treatment when the facts
  // carry an order or a timescale; otherwise ask for the consequences without inventing a
  // sequence the sources don't establish.
  const consequenceNote = (hasTimescale || hasSequence)
    ? "Weight the peak on the documented sequence of what actually happens, in order, with its timescales. Do not compress it into a list."
    : "Weight the peak on the documented consequences — what the facts actually establish. Do not invent an ordered timeline or timescales the sources don't give.";
  // The scale peak: the "documented comparison" line only makes sense when a comparison
  // is present; without one, ask for the figure to be made felt on its own terms.
  const scaleNote = hasComparison
    ? "Build the peak around making the numbers FELT — the documented comparison, walked through slowly, is the payoff. Do not rush past the figure."
    : "Build the peak around making the numbers FELT — sit on the key figure, restate what it means. Use a documented comparison only if the facts contain one; do not invent one.";
  // The "mechanism" slot exists in BOTH shapes, but its peak is different. An EXPLAINER's
  // mechanism is explained patiently in causal order (a pharmacology video has no scene
  // that "nearly came apart" and no takedown); an EVENT's mechanism is a scene. Pick by
  // the fact set's shape so a science explainer never gets the crime-story note.
  // Content/kind signal, NOT the slot name: "mechanism" is a slot in both shapes, so
  // keying on the slot list misfired a crime-story note onto a pharmacology explainer.
  const explainerShape = (!!input.topicKind && input.topicKind !== "event") || looksScientific;
  const mechanismNote = explainerShape
    ? "Build the peak on the mechanism itself, explained patiently and in causal order — the clearest step-by-step walkthrough of how it works IS the payoff. Do not stage it as a dramatic scene or a takedown; an explainer has no such moment."
    : "Stage the climax on the peak moment of the mechanism itself — the scene where it nearly came apart — beat by beat, as the longest section. Not the takedown.";
  const SLOT_PEAK: Record<string, string> = {
    // Explainer shape: the "peak" is the mechanism explained patiently, not a scene.
    premise: "Spend the length on making the question feel urgent and concrete before answering it. Do not resolve it early.",
    scale: scaleNote,
    consequence: consequenceNote,
    "open-question": "Weight the peak on what is genuinely unsettled. State clearly what is measured versus modelled, and do not resolve what the evidence leaves open.",
    mechanism: mechanismNote,
    setup: "Stage the climax on the moment access was finally won, beat by beat, as the longest section. Not the takedown.",
    climax: "Stage the climax on the peak documented moment this angle is built on, beat by beat, as the longest section by a wide margin. Slow it down.",
    aftermath: "Stage the peak on the moment the cost lands, beat by beat, as the longest section. The ending is what it did to the person, not the verdict.",
    contested: "Stage the peak on the disputed moment itself, beat by beat, stating both accounts and resolving neither.",
  };
  if (hasFacts && slot && SLOT_PEAK[slot]) {
    notes.push({ source: "Your angle", on: true, note: SLOT_PEAK[slot] });
  } else if (hasFacts && /\b(takedown|raid|arrests?|convict|verdict|captured|sentenc|indict|tak-?down)\b/.test(t)) {
    notes.push({ source: "Your angle", on: true, note: "Stage the climax on the documented ending (the takedown/verdict) as a beat-by-beat scene, not a one-line summary. Then land the aftermath." });
  }

  // Standing channel defaults — set once, true for every script, so the user never
  // has to type them. (When Voice Match stores per-channel defaults, read them here.)
  notes.push({ source: "Channel default", on: true, note: "No glamour, no invented dialogue, open on the problem, and keep the aftermath honest about cost." });

  return notes;
}

// Compose the final free-text note that goes to generation: the checked derived
// notes first, then whatever the user typed. Kept here so the picker and any test
// build the string the same way.
export function composeDirectorNote(checked: string[], freeform: string): string | undefined {
  const parts = [...checked.map((n) => `- ${n}`), freeform.trim()].filter(Boolean);
  return parts.length ? parts.join("\n") : undefined;
}
