import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db/supabase";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "placeholder" });
  }
  return anthropicClient;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: script } = await supabaseAdmin!
    .from("scripts")
    .select("content, title, niche")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });

  const preview = (script.content || "").slice(0, 1800);

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    messages: [{
      role: "user",
      content: `You are a YouTube title optimization expert. Based on this script, generate exactly 5 viral YouTube title variations.

Rules:
- Each title must be under 70 characters
- Use curiosity gaps, numbers, or emotional triggers to maximize CTR
- Vary the format: question, stat-led, bold claim, listicle, personal story
- Each title must directly reflect the script content — no misleading clickbait
- Make them feel spoken and real, not corporate

Current title: "${script.title}"
Niche: ${script.niche || "general"}
Script opening:
${preview}

Return ONLY a valid JSON array of exactly 5 title strings. No explanation, no markdown fences, just the raw JSON array.`,
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";

  let titles: string[] = [];
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) titles = parsed.slice(0, 5).map(String);
  } catch {
    titles = raw
      .split("\n")
      .map(l => l.replace(/^[\s"\[\]\d\.\-\*,]+/, "").replace(/[",\]]+$/, "").trim())
      .filter(l => l.length > 10)
      .slice(0, 5);
  }

  return NextResponse.json({ titles });
}
