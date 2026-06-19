import { Anthropic } from "@anthropic-ai/sdk";
import { NICHES } from "@/lib/data/niches";

// Classify free text (transcript / topic / angle) into ONE canonical niche id,
// so the niche-keyed learning (frameworks, hooks, titles, magnet stats) fires
// even when the user doesn't pick a niche. Returns null on failure or if the
// model returns something off-list; callers fall back gracefully.

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return _client;
}

export async function detectNiche(text: string): Promise<string | null> {
  const basis = (text || "").trim();
  if (basis.length < 20) return null;
  try {
    const list = NICHES.map((n) => `${n.id}: ${n.name}`).join("\n");
    const msg = await client().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16,
      messages: [{
        role: "user",
        content: `Classify this YouTube content into ONE niche. Reply with ONLY the niche id (e.g. "personal-finance"), nothing else.\n\nNICHES (id: name):\n${list}\n\nCONTENT:\n"${basis.slice(0, 900)}"`,
      }],
    });
    const raw = (msg.content[0]?.type === "text" ? msg.content[0].text : "")
      .trim().toLowerCase().replace(/[^a-z-]/g, "");
    return NICHES.some((n) => n.id === raw) ? raw : null;
  } catch {
    return null;
  }
}
