import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { tagFactSources, familyInFacts, minorsInFacts, replaceFamilyNames, stripSourceTags, OWN_TAG, FAMILY_TAG } from "@/lib/script-compliance";

// PRODUCER'S NOTE: what a human producer adds after picking a card (seen live: a reviewer wrote "open on
// the ferry, Braveheart quietly in act two, attribute what only he could know, keep his daughter out of
// the opening"). Written from the chosen card + the research, pre-filled and checked in the notes list,
// so a creator who doesn't know what to write still gets it. Never blocks: on failure, no notes.
export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { topic, angle, title, sourceMaterial } = await req.json();
    const facts = tagFactSources(String(sourceMaterial || ""), String(topic || ""));
    if (!facts.trim() || !angle) return NextResponse.json({ notes: [] });
    const own = facts.split("\n").filter((l) => l.includes(OWN_TAG) || l.includes(FAMILY_TAG)).slice(0, 12);
    const family = minorsInFacts(facts);
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 900, temperature: 0.2,
      messages: [{ role: "user", content: `You are the producer of a documentary YouTube video. The creator picked this angle card:
HOOK: ${String(angle).slice(0, 600)}
TITLE: ${String(title || "").slice(0, 120)}

Write the producer's notes the scriptwriter should follow, using ONLY the research below. Exactly these lines, each at most 40 words in one or two complete sentences, no em dashes:
1. OPENING: the specific documented moment the script opens on (the one this card promises) and the first beats in order.
2. ORDER: where the other strong documented moments belong (act two, the reveal, the ending), so the card's promise is paid off and nothing big is spent too early.
3. PAYOFF: what the ending must land on, from the research.
Do not add attribution or privacy notes; those are added separately. Never name anyone who was a minor at the time (say "his son", "his daughter"); adults on the record may be named. A fact tagged [his own account] or [family account] is that person's claim: write it as "he later wrote" or "his son recalled", never as a camera-ready fact. Describe groups in the research's own words (if it says "clients, many of whom came through his church", never "his congregation"). Never invent a detail.

RESEARCH:
"""
${facts.slice(0, 20000)}
"""

Output ONLY JSON: {"opening":"...","order":"...","payoff":"..."}` }],
    });
    const text = msg.content.find((c) => c.type === "text")?.type === "text" ? (msg.content.find((c) => c.type === "text") as any).text as string : "";
    const m = text.match(/\{[\s\S]*\}/);
    const j = m ? JSON.parse(m[0]) : {};
    // Minors by relationship in the notes too (seen live: the ending note named the daughter its own
    // privacy line said not to name).
    // Family by relationship, and never cut mid-sentence (seen live: the "Order" note ended "the 22-page").
    const clean = (t: any) => {
      const s = replaceFamilyNames(stripSourceTags(String(t || "")).replace(/\s*(?:—|–|--)\s*/g, ", ").trim(), facts, String(topic || "")).text;
      if (s.length <= 420) return s;
      const cut = s.slice(0, 420); const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
      return end > 120 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + ".";
    };
    const notes: { source: string; note: string }[] = [];
    if (j.opening) notes.push({ source: "Producer", note: `Open on: ${clean(j.opening)}` });
    if (j.order) notes.push({ source: "Producer", note: `Order: ${clean(j.order)}` });
    if (j.payoff) notes.push({ source: "Producer", note: `Land the ending on: ${clean(j.payoff)}` });
    // Attribution and family privacy are CASE rules, computed for every angle in deriveDirectorNotes;
    // this endpoint only writes the angle's own directions.
    void own; void family;
    return NextResponse.json({ notes });
  } catch (e: any) {
    console.error("[director-note]", e?.message || e);
    return NextResponse.json({ notes: [] });
  }
}
