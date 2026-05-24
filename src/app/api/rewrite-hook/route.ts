import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Anthropic } from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getAnthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  return client;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { hook, topic, niche } = await req.json();
    if (!hook) return NextResponse.json({ error: "Hook required" }, { status: 400 });

    const response = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `You are a YouTube hook writer. Rewrite this hook for a script about "${topic || "the given topic"}"${niche ? ` in the ${niche} niche` : ""}.

Current hook:
"${hook}"

Write ONE completely different hook. Must be:
- Different opening pattern than the current hook
- 1-2 sentences max
- Grabs attention in the first 3 words
- NEVER start with: "In this video", "Today we", "Welcome back", "Have you ever"
- Use one of: bold claim, shocking stat, provocative question, vivid scene, counterintuitive statement

Respond with ONLY the new hook text. No quotes, no explanation.`,
      }],
    });

    const raw = response.content[0];
    if (raw.type !== "text") return NextResponse.json({ error: "Bad response" }, { status: 500 });
    const cleanHook = raw.text.trim().replace(/—/g, ", ").replace(/\s,\s/g, ", ");
    return NextResponse.json({ hook: cleanHook });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
