import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateScript } from "@/lib/ai/claude";
import { checkScriptLimit, incrementGenerationCount, refundGenerationCount } from "@/lib/usage";
import { getMagnetSuggestions } from "@/lib/magnet-word";
import { supabaseAdmin } from "@/lib/db/supabase";
import { joinHookBody } from "@/lib/script-text";
import { getNicheFrameworksBlock } from "@/lib/viral-frameworks";

export const maxDuration = 300;

function truncateTranscript(text: string, maxWords = 400): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Hard block — check limit before burning API credits
  const { allowed, plan, used, limit } = await checkScriptLimit(userId);
  if (!allowed) {
    return NextResponse.json({
      error: plan === "free"
        ? `You've used your ${limit} free scripts this month. Upgrade to keep generating.`
        : `You've hit your monthly script limit (${used}/${limit}). Upgrade your plan for more.`,
      limitReached: true,
      plan,
    }, { status: 403 });
  }

  // Count the attempt now — enforce at event level, prevents free retries on failures
  const genEventId = await incrementGenerationCount(userId).catch(e => { console.error("[usage] increment failed:", e); return null; });

  const startTime = Date.now();

  try {
    const { transcript, niche, topic, sourceVideoId, videoLength = "long", targetMinutes, viralMagnetWord, angle, remixFramework, hookType, titleFormula, hookScript, contentStructure, retentionTriggers } = await req.json();

    // Free plan: scripts capped at 10 minutes — longer scripts are a paid feature
    if (plan === "free" && targetMinutes && targetMinutes > 10) {
      await refundGenerationCount(userId, genEventId).catch(e => console.error("[usage] refund failed:", e));
      return NextResponse.json({
        error: "Free scripts are capped at 10 minutes. Upgrade to Starter to generate scripts up to 20 minutes.",
        limitReached: true,
        plan,
      }, { status: 403 });
    }

    // Magnet words are a Starter+ feature — the UI gates them, enforce server-side too
    const magnetWord = plan === "free" ? undefined : (viralMagnetWord || undefined);

    // Build enhanced angle from Viral Remixer framework
    let enhancedAngle: string | undefined = angle || undefined;
    if (remixFramework || hookType || titleFormula || hookScript || contentStructure || retentionTriggers) {
      const parts: string[] = [];
      if (hookType) parts.push(`Open with a ${hookType} hook`);
      if (hookScript) parts.push(`Hook style to mirror (adapt, don't copy): "${String(hookScript).slice(0, 200)}"`);
      if (titleFormula) parts.push(`Title formula: ${titleFormula}`);
      if (remixFramework) parts.push(`Viral framework: ${remixFramework}`);
      if (contentStructure && Array.isArray(contentStructure) && contentStructure.length > 0) {
        const sections = (contentStructure as any[]).map((s: any) => s.section || "").filter(Boolean);
        if (sections.length) parts.push(`Content structure to follow: ${sections.join(" → ")}`);
      }
      if (retentionTriggers && Array.isArray(retentionTriggers) && retentionTriggers.length > 0) {
        const triggers = (retentionTriggers as any[]).map((t: any) => t.trigger || "").filter(Boolean);
        if (triggers.length) parts.push(`Retention mechanics to include: ${triggers.join(", ")}`);
      }
      enhancedAngle = parts.join(". ") + (angle ? `. ${angle}` : "");
    }

    const maxWords: Record<string, number> = { short: 200, medium: 400, long: 500, ultraLong: 600 };
    const cap = targetMinutes ? Math.round(targetMinutes * 130 / 10) : (maxWords[videoLength] ?? 400);
    const truncated = truncateTranscript(transcript || "", cap);
    console.log(`[generate] length=${videoLength} minutes=${targetMinutes ?? "-"} plan=${plan}`);

    // Collective learning layer: real viral frameworks from this niche,
    // captured by Viral Remixer usage. Time-boxed; null when none match.
    const nicheFrameworks = await getNicheFrameworksBlock(niche).catch(() => null);

    const scriptPromise = generateScript({
      sourceTranscript: truncated,
      targetTopic: topic || "",
      targetNiche: niche || "general",
      sourceTitle: topic || "",
      sourceNiche: niche || "general",
      videoLength: videoLength as any,
      targetMinutes: targetMinutes ?? undefined,
      tone: "entertaining",
      ttsOptimized: false,
      viralMagnetWord: magnetWord,
      angle: enhancedAngle || undefined,
      nicheFrameworks: nicheFrameworks || undefined,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Script generation timed out — our AI is taking longer than expected. Could you wait a moment and then try again?")), 290000)
    );

    const script = await Promise.race([scriptPromise, timeoutPromise]) as any;
    const elapsed = Date.now() - startTime;
    // Belt-and-suspenders over the prompt instructions: strip em dashes and any
    // stage-direction markers ([PAUSE], [EMPHASIS], etc.) — scripts must be pure
    // speakable text that pastes straight into AI voiceover tools
    const cleanText = (s: any) => typeof s === "string"
      ? s.replace(/—/g, ", ").replace(/\s,\s/g, ", ")
          .replace(/\[\/?[A-Z][A-Z _-]*\]/g, "")
          .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ")
      : s;
    for (const k of ["hook", "title", "fullScript", "script", "body", "content", "cta"]) {
      if (script[k]) script[k] = cleanText(script[k]);
    }
    // Only split genuine walls of text — a real run-on paragraph — into full
    // flowing paragraphs (~4-5 sentences each). Leave normal paragraphs alone so
    // the script reads smooth, not choppy.
    const reflow = (s: any) => {
      if (typeof s !== "string") return s;
      return s.split(/\n\n+/).map((p: string) => {
        if (p.length < 900) return p;
        const sents = p.match(/[^.!?]+[.!?]+["')\]]*\s*/g) || [p];
        const chunks: string[] = [];
        let cur = "";
        let n = 0;
        for (const sent of sents) {
          cur += sent;
          n++;
          if (n >= 5 || cur.length > 600) { chunks.push(cur.trim()); cur = ""; n = 0; }
        }
        if (cur.trim()) chunks.push(cur.trim());
        return chunks.join("\n\n");
      }).join("\n\n");
    };
    for (const k of ["fullScript", "script", "body", "content"]) {
      if (script[k]) script[k] = reflow(script[k]);
    }
    if (Array.isArray(script.sections)) script.sections = script.sections.map((s: any) => ({
      ...s, title: cleanText(s.title), content: cleanText(s.content),
    }));
    console.log(`[generate] done in ${elapsed}ms`);

    let magnetSuggestions: import("@/lib/magnet-word").MagnetSuggestion[] = [];
    try {
      magnetSuggestions = await getMagnetSuggestions(script.title || "", niche || "general");
    } catch (e) {
      console.error("[magnet] suggestion error:", e);
    }
    // Auto-save — the user's work should never depend on them clicking Save
    let savedId: string | null = null;
    try {
      if (supabaseAdmin) {
        const t = (script as any).title || topic || "Untitled Script";
        const h = (script as any).hook || "";
        // Same field priority as the extension pass in claude.ts — fullScript first,
        // so the extended body (not a shorter duplicate field) is what gets saved
        const b = (script as any).fullScript || (script as any).script || (script as any).body || (script as any).content || "";
        const content = joinHookBody(h, b);
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        const { data: saved, error: saveError } = await supabaseAdmin
          .from("scripts")
          .insert({
            user_id: userId,
            title: t,
            content,
            niche: niche || null,
            topic: topic || null,
            word_count: wordCount,
            // integer column, stored as seconds — the UI renders Math.round(x / 60) min
            estimated_duration: targetMinutes ? targetMinutes * 60 : null,
            source_video_id: sourceVideoId || null,
          })
          .select("id")
          .single();
        if (saveError) console.error("[autosave] insert failed:", saveError.message);
        savedId = saved?.id ?? null;
      }
    } catch (e) {
      console.error("[autosave] failed:", e);
    }

    console.log(`[generate] total ${Date.now() - startTime}ms`);
    return NextResponse.json({ ...script, magnetSuggestions, savedId });
  } catch (error: any) {
    console.error("Script generation error:", error.message);
    // Refund the credit — user shouldn't pay for our failure
    await refundGenerationCount(userId, genEventId).catch(e => console.error("[usage] refund failed:", e));
    return NextResponse.json({ error: error.message || "Failed to generate script" }, { status: 500 });
  }
}
