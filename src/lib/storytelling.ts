// Storytelling engine. Distills 12 YouTube storytelling techniques into a craft
// layer that drives generateScript, plus 3 narrative modes and the dependency
// rules that keep a selected set coherent (you can't have a climax with no
// escalation or stakes). Shared by the generator, the recommend endpoint, and
// (Phase 2) the selection UI. Skripr outputs voiceover text, so every directive
// is written for spoken narration — not literal cutaways or visuals.

export interface Technique {
  id: string;
  name: string;
  value: string;       // one-line value, shown to the user in the picker
  directive: string;   // compact instruction injected into the script prompt
  requires?: string[]; // techniques that must also be on for this to cohere
}

export const TECHNIQUES: Technique[] = [
  { id: "suspense", name: "Suspense",
    value: "Holds attention by delaying your best reveal so viewers stay to see it.",
    directive: "Bury your most interesting reveal deeper in the script. Tease it early, then withhold the payoff and narrate around it so the viewer must keep listening to reach it. No delay, no suspense." },
  { id: "foreshadowing", name: "Foreshadowing",
    value: "Plants a hint of something big later, creating a question the viewer needs answered.",
    directive: "Early on, drop a line that hints at something major later (e.g. 'this one habit eventually ruined him'), then don't resolve it until the back half. Think in present vs future timeline: hint now, pay off later." },
  { id: "villain", name: "The Villain",
    value: "Gives the story a clear enemy to fight, which makes the win feel earned.",
    directive: "Give the story a clear antagonist — it need not be a person (a belief, habit, system, the 9-to-5). Start with the villain having the upper hand, narrate the struggle against it (the part viewers crave), and end with the main character defeating it.",
    requires: ["main-character", "stakes"] },
  { id: "setup", name: "The Setup",
    value: "Gives early context so viewers aren't confused, and plants details that pay off later.",
    directive: "In the first ~15%, establish who/what this is about, the mission, the immediate obstacle, and tie it back to the title's promise. Plant one casual detail that becomes important later (Chekhov's gun): if it appears in act one, it fires in act three." },
  { id: "main-character", name: "The Main Character",
    value: "Anchors the story on someone to root for so viewers stay invested.",
    directive: "Anchor the script on one figure (the creator, the viewer, or a subject) with a clear mission and mounting obstacles, revealed gradually. The main character must ultimately succeed." },
  { id: "stakes", name: "Stakes (Loss Aversion)",
    value: "Answers 'why should I keep watching' — the single biggest driver of retention.",
    directive: "Frame value as LOSS, not just gain — what the viewer loses by not knowing this. Every section should pass the test 'what do I lose if I stop watching now.' Prefer loss-aversion framing over aspirational ('the habits quietly draining your savings' beats 'how to save more')." },
  { id: "open-loops", name: "Open Loops",
    value: "Creates curiosity gaps the viewer can only close by watching on.",
    directive: "Open a curiosity gap the script only closes later. Run one main loop plus smaller loops throughout (post-intro: 'number 4 changed everything'; info, event, identity, and escalation loops). Always delay before closing a loop — never open and immediately resolve." },
  { id: "emotional-progression", name: "Emotional Progression",
    value: "Moves viewers through an emotional arc, which is what actually drives retention.",
    directive: "Engineer an emotional arc by position: curiosity at the open, rising tension through the middle, anticipation at the peak, satisfaction (and optional relief or disbelief) at the close. Match the feeling to the moment." },
  { id: "climax", name: "The Climax",
    value: "Gives the script one peak payoff moment worth waiting for.",
    directive: "Structure the script around one peak moment that feels inevitable and worth the wait. Tease it early, build to the highest tension there, then resolve it (the payoff to everything built up — not the same as the outro).",
    requires: ["escalation", "stakes"] },
  { id: "escalation", name: "Escalation",
    value: "Makes each beat bigger than the last so momentum never sags in the middle.",
    directive: "Order the beats so each is bigger, tenser, or more important than the last — small problem, bigger problem, biggest problem — building into the climax. Never let the middle plateau.",
    requires: ["stakes"] },
  { id: "subplots", name: "Subplots",
    value: "Fills the delay before a payoff with something engaging instead of filler.",
    directive: "When you must delay before closing a loop, fill it with a relevant secondary thread — a short story, a 'common mistakes' aside, or a mini case study — not random filler. It must relate to the main point and earn its place.",
    requires: ["open-loops"] },
  { id: "controlled-exposition", name: "Controlled Exposition",
    value: "Reveals the right info at the right time so curiosity never collapses early.",
    directive: "Reveal information deliberately. Cut anything that doesn't move the story forward. Never reveal the biggest payoff too early — curiosity is the engine. Prefer vivid, concrete description over flat telling." },
];

export const TECHNIQUE_IDS = TECHNIQUES.map((t) => t.id);
const BY_ID = new Map(TECHNIQUES.map((t) => [t.id, t]));

// Always-on: these help every script, so they stay selected regardless.
export const CORE_TECHNIQUE_IDS = ["stakes", "open-loops", "emotional-progression"];

export interface Mode {
  id: string;
  name: string;
  blurb: string;
  techniqueIds: string[]; // recommended default set for this mode (core added automatically)
}

export const MODES: Mode[] = [
  { id: "story", name: "Story / Documentary",
    blurb: "Narrative arc with a clear subject and an enemy to overcome.",
    techniqueIds: ["main-character", "villain", "foreshadowing", "escalation", "climax", "suspense"] },
  { id: "listicle", name: "Listicle / Educational",
    blurb: "Value-dense teaching with curiosity gaps and tight information control.",
    techniqueIds: ["open-loops", "controlled-exposition", "stakes", "subplots", "emotional-progression"] },
  { id: "journey", name: "Personal Journey",
    blurb: "A first-person quest with mounting obstacles toward a payoff.",
    techniqueIds: ["setup", "main-character", "subplots", "escalation", "climax"] },
];

const MODE_BY_ID = new Map(MODES.map((m) => [m.id, m]));

// Heuristic auto-pick of a mode from the niche/topic, used when the caller
// doesn't pass one (Auto mode). Keyword-based, niche string is freeform.
export function autoSelectMode(niche?: string | null, topic?: string | null): Mode {
  const s = `${niche || ""} ${topic || ""}`.toLowerCase();
  const story = /(true crime|crime|history|historical|documentary|war|mystery|biograph|story|scandal|disaster)/;
  const journey = /(i tried|i spent|challenge|my journey|30 days|built|i quit|case study|transformation|vlog|experiment)/;
  if (story.test(s)) return MODE_BY_ID.get("story")!;
  if (journey.test(s)) return MODE_BY_ID.get("journey")!;
  return MODE_BY_ID.get("listicle")!; // safe default — finance, self-improvement, how-to, tech, health
}

// Expand a selected set into a coherent one: keep core on, pull in any required
// prerequisites (climax -> escalation -> stakes), dedupe, return in canonical order.
export function resolveTechniques(ids: string[] | null | undefined): string[] {
  const set = new Set<string>([...CORE_TECHNIQUE_IDS, ...(ids || []).filter((id) => BY_ID.has(id))]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...set]) {
      for (const dep of BY_ID.get(id)?.requires || []) {
        if (!set.has(dep)) { set.add(dep); changed = true; }
      }
    }
  }
  return TECHNIQUE_IDS.filter((id) => set.has(id)); // canonical order
}

// Default technique set for a mode (mode picks + core, dependency-resolved).
export function defaultTechniquesForMode(modeId: string): string[] {
  const mode = MODE_BY_ID.get(modeId) || MODES[0];
  return resolveTechniques(mode.techniqueIds);
}

export function getMode(modeId: string | null | undefined): Mode | null {
  return modeId ? MODE_BY_ID.get(modeId) || null : null;
}

// Build the craft block injected into the script prompt. Resolves coherence
// first, so the prompt never asks for an incoherent combo.
export function buildStorytellingBlock(
  modeId: string | null | undefined,
  techniqueIds: string[] | null | undefined
): string {
  const mode = getMode(modeId) || autoSelectMode();
  const resolved = resolveTechniques(techniqueIds && techniqueIds.length ? techniqueIds : mode.techniqueIds);
  const lines = resolved.map((id) => {
    const t = BY_ID.get(id)!;
    return `- ${t.name}: ${t.directive}`;
  });
  return `STORYTELLING DIRECTION — write this script in the "${mode.name}" mode: ${mode.blurb} Weave the following techniques into the narration so the script builds tension and flows. Apply them naturally as spoken word — NEVER label them, announce them, or break the fourth wall:
${lines.join("\n")}`;
}
