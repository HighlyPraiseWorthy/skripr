import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { NICHES } from "@/lib/data/niches";

export const maxDuration = 60;

// Outlier DNA + Original Opportunities. Given one outlier video, extract its transferable
// creative DNA (the pattern, not the story), separate what is safe to BORROW from what is
// the channel's own and must NOT be copied, then generate original concepts that reuse the
// pattern on a DIFFERENT subject. This is the "understand the pattern, make something
// original" workflow — the opposite of cloning the winning video.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, outlierType, titlePattern, storyPattern, channelTitle, durationMin, niche } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
  // Keep the opportunities in the SCANNED CHANNEL'S niche so they're videos the creator can actually
  // make, not a jump to an unrelated domain. Resolve a readable niche label when we have the id.
  const nicheName = (NICHES.find((x: any) => x.id === niche)?.name) || (typeof niche === "string" ? niche : "");

  const prompt = `You are a YouTube strategist extracting the reusable CREATIVE DNA of an outlier video, so a creator can build ORIGINAL videos on the same proven pattern without copying it.

OUTLIER VIDEO: "${title}"${channelTitle ? ` (channel: ${channelTitle})` : ""}
${outlierType?.length ? `Outlier type(s): ${outlierType.join(", ")}` : ""}
${titlePattern ? `Title pattern: ${titlePattern}` : ""}
${storyPattern ? `Story pattern: ${storyPattern}` : ""}
${durationMin ? `Length: ${durationMin} min` : ""}

EVIDENCE RULE (critical): you have ONLY the title — no transcript. So DESCRIBE THE STRUCTURE, never assert plot specifics the title doesn't state. "Threat -> pursuit -> capture" (structural shape) is fine; "a prolonged pursuit by federal agents across three countries" (invented specifics) is NOT. Never invent events, names, or a chronology.

1) "dna": the transferable anatomy, each a short phrase:
   - "topic": the broad subject area
   - "subject": the KIND/category of central figure ONLY — do NOT append an inferred consequence. "A criminal figure framed as exceptionally dangerous" is right; "a figure whose power made capture improbable" adds an inference the title never made.
   - "storyStructure": the abstract shape only, an arrow chain, and HEDGE any beat the title only implies (e.g. "Threat established -> pursuit implied -> capture confirmed"). Use the title's OWN outcome word (capture/exposure/etc.), never a stronger interpretation ("collapse", "downfall") the title didn't state.
   - "packaging": the title's STRUCTURE as a template (e.g. "[Extreme characterization] + [subject] + [resolved outcome]")
   - "curiosityMechanism": SHORT — one clause, scannable (e.g. "Outcome revealed; method and path withheld"). Do not invent a new premise the title never made.

2) "whatToBorrow": exactly 3-4 TRANSFERABLE structural elements (mechanism, not subject). For a superlative, describe it as "positions the subject at the extreme end of a meaningful category" — NOT "record-breaking" (a superlative is a characterization, not necessarily a measurable record). Prefer the canonical phrase "outcome-known / mechanism-unknown" for the curiosity element. When you describe the abstract three-beat shape, end on "confirm the resolution", never "confirm the collapse" (do not inject meaning past the title's outcome).

3) "whatNotToCopy": exactly 3-4 source-specific elements that would just clone it — the specific subject, the exact wording, named individuals/events, the original genre/context.

4) "opportunities": EXACTLY 3 concepts that TRANSFER THE MECHANISM to a genuinely DIFFERENT STORY${nicheName ? ` — but ALL WITHIN THE CHANNEL'S NICHE: ${nicheName}. The creator makes ${nicheName} videos, so every opportunity must be a ${nicheName} topic they could actually produce, NOT a jump to an unrelated domain.` : ` within the same broad subject area as the source channel — do NOT jump to an unrelated domain.`} Take a genuinely DIFFERENT subject/story inside that space for each of the three (vary the specific subject, not the niche). NEVER a noun-swap of the source ("World's Most Wanted Hacker" for a drug-lord video is BAD), and never three trivial variations of the exact same story. Do NOT pre-write the story (no invented plot), because the creator hasn't researched it yet. Each opportunity:
   - "title": an original, publishable title (under 65 chars, no em dashes) on a different subject WITHIN the channel's niche. When it uses a superlative, prefer a MEASURABLE one (largest by revenue, most by mortality, biggest by dollar amount) over a subjective one ("most aggressive", "most shocking"), so the creator can actually operationalize it.
   - "patternTransferred": 2-4 words naming the borrowed mechanism, using "outcome-known / mechanism-unknown" where that is the curiosity element (e.g. "Extreme characterization + outcome-known / mechanism-unknown")
   - "researchAngle": one sentence telling the creator what DOCUMENTED case to find and what turning point to look for. If the title uses a superlative/ranking ("world's most", "deadliest", "biggest"), the angle MUST tell them to verify a defensible superlative exists before using it.
   - "whyItFits": one sentence on how it preserves the underlying tension without copying the source

Return ONLY valid JSON, no fences:
{
  "dna": { "topic": "...", "subject": "...", "storyStructure": "...", "packaging": "...", "curiosityMechanism": "..." },
  "whatToBorrow": ["...", "..."],
  "whatNotToCopy": ["...", "..."],
  "opportunities": [ { "title": "...", "patternTransferred": "...", "researchAngle": "...", "whyItFits": "..." } ]
}`;

  try {
    const msg = await new Anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1600,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const data = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("[outlier-opportunities]", e?.message);
    return NextResponse.json({ error: "Failed to extract pattern" }, { status: 500 });
  }
}
