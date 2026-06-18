import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  TECHNIQUES, TECHNIQUE_IDS, MODES, CORE_TECHNIQUE_IDS,
  resolveTechniques, getMode, autoSelectMode,
} from "@/lib/storytelling";

export const maxDuration = 30;

const client = new Anthropic();
const META = new Map(TECHNIQUES.map((t) => [t.id, t]));
const view = (id: string) => { const t = META.get(id)!; return { id: t.id, name: t.name, value: t.value }; };

// Recommends a narrative mode + a ranked, coherent set of storytelling
// techniques for a topic/angle, with one-line value notes for the picker. When
// a source video is provided (upload flow), also detects which techniques the
// source itself used, so the UI can offer "Match the original style" on top.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { topic, niche, angle, sourceTitle, sourceTranscript } = await req.json();
    const hasSource = !!(sourceTitle || sourceTranscript);

    const techList = TECHNIQUES.map((t) => `${t.id} = ${t.name}: ${t.value}`).join("\n");
    const modeList = MODES.map((m) => `${m.id} = ${m.name} (${m.blurb})`).join("\n");

    let mode = autoSelectMode(niche, topic).id;
    let order = [...TECHNIQUE_IDS];
    let recommendedIds: string[] = [];
    let sourceUsed: string[] = [];

    try {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: "You output ONLY valid JSON. No prose, no markdown.",
        messages: [{
          role: "user",
          content: `A creator is scripting a YouTube video.
Topic: "${String(topic || "").slice(0, 160)}"
Niche: ${niche || "general"}
Angle: ${String(angle || "").slice(0, 200)}
${hasSource ? `Source video title: "${String(sourceTitle || "").slice(0, 160)}"\n${sourceTranscript ? `Source transcript (excerpt): "${String(sourceTranscript).slice(0, 900)}"` : ""}` : ""}

NARRATIVE MODES:
${modeList}

STORYTELLING TECHNIQUES (id = name: value):
${techList}

Return ONLY this JSON:
{
  "mode": "<best mode id for this topic>",
  "order": [<ALL technique ids, best-fit first>],
  "recommended": [<the 3-5 ids that best fit this specific topic>]${hasSource ? `,
  "sourceUsed": [<technique ids the SOURCE video itself clearly uses>]` : ""}
}
Use only ids from the lists above.`,
        }],
      });
      const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      if (parsed.mode && getMode(parsed.mode)) mode = parsed.mode;
      const clean = (arr: any): string[] => Array.isArray(arr) ? arr.filter((id: any) => TECHNIQUE_IDS.includes(id)) : [];
      const ord = clean(parsed.order);
      // keep model order, then append any ids it dropped (canonical) so nothing is lost
      order = [...new Set([...ord, ...TECHNIQUE_IDS])];
      recommendedIds = clean(parsed.recommended);
      sourceUsed = clean(parsed.sourceUsed);
    } catch {
      // Haiku/JSON failed — fall back to the mode's default set, heuristic mode.
    }

    // Coherence: recommended must include core + dependencies. Fall back to the
    // mode's defaults if the model returned nothing usable.
    const baseRec = recommendedIds.length ? recommendedIds : (getMode(mode)?.techniqueIds || []);
    const recommended = resolveTechniques(baseRec);
    const sourceStyle = hasSource && sourceUsed.length ? resolveTechniques(sourceUsed) : null;
    const modeObj = getMode(mode)!;

    return NextResponse.json({
      mode: { id: modeObj.id, name: modeObj.name, blurb: modeObj.blurb },
      recommended: recommended.map(view),
      all: order.map(view),
      core: CORE_TECHNIQUE_IDS,
      originalStyle: sourceStyle ? sourceStyle.map(view) : null,
    });
  } catch (e: any) {
    console.error("[storytelling/recommend]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to recommend techniques" }, { status: 500 });
  }
}
