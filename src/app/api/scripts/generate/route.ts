import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateScript, buildSectionPlan } from "@/lib/ai/claude";
import { checkScriptLimit, incrementGenerationCount, refundGenerationCount } from "@/lib/usage";
import { getMagnetSuggestions } from "@/lib/magnet-word";
import { supabaseAdmin } from "@/lib/db/supabase";
import { joinHookBody } from "@/lib/script-text";
import { getNicheFrameworksBlock, getBendFrameworksBlock, getNicheHookExamplesBlock, getNicheTitleFormulasBlock, normalizeNiche } from "@/lib/viral-frameworks";
import { detectNiche } from "@/lib/niche-detect";
import { getKeptHooksBlock } from "@/lib/hook-picks";
import { saveAnglePick } from "@/lib/angle-picks";
import { autoSelectMode, resolveTechniques } from "@/lib/storytelling";
import { factCheckAgainstSource } from "@/lib/fact-check";
import { reviewAndCorrectScript } from "@/lib/ai/self-review";
import { getActiveVoiceMeta, getVoiceMetaById } from "@/lib/voice-profile";
import { captureFrameworkInBackground } from "@/lib/framework-capture";
// semantic-grounding is now on-demand only (see below) — not run on the generation path.

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
    const { transcript, niche, topic, sourceVideoId, videoLength = "long", targetMinutes, viralMagnetWord, angle, remixFramework, hookType, titleFormula, hookScript, hookWhyItWorks, contentStructure, retentionTriggers, voiceProfileId, sourceNiche, bridgeNiche, companionCta, storytellingMode, storytellingTechniques, sourceMaterial, selectedTitle, softCta, sourceVerdict, topicKind, directorNote } = await req.json();

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
      // This is a REMIX: the source video is the template, and reproducing ITS shape is
      // the entire product. Generic craft guidance in the system prompt describes the
      // form in general; anything below describes THIS video, and wins on conflict.
      parts.push(`REPRODUCE THE SHAPE OF THE SOURCE VIDEO (highest priority). Everything below was measured from the specific video this remix is modeled on. Where any general craft guidance conflicts with it, THIS WINS — copying the source's actual structure, weighting and beat placement is the whole point of a remix. Copy the SHAPE and the MECHANICS, never the wording, the subject, or the source's own metaphors.`);
      // The extracted RECIPE is the best structural instruction available — it is written
      // in exactly the register a prompt wants and describes what this specific video did.
      // It was previously buried as one line among many; it leads now.
      if (remixFramework) parts.push(`THE SOURCE VIDEO'S RECIPE — follow this structure beat for beat, it is what made the original work: ${remixFramework}`);
      if (hookType) parts.push(`HOOK ARCHETYPE (required): the source opened with a ${hookType} hook, and yours must be the same archetype. A "stat" or "controversy" hook means a concrete NUMBER lands in the first two sentences. A "quote" hook means real quoted speech opens the script. Do NOT open by restating the title or the thesis — the viewer just read the title, so repeating it carries zero new information.`);
      if (hookWhyItWorks) parts.push(`WHY THE SOURCE'S HOOK WORKS (reproduce this mechanism, not its wording): ${String(hookWhyItWorks).slice(0, 400)}`);
      if (hookScript) parts.push(`Hook style to mirror (adapt, don't copy): "${String(hookScript).slice(0, 200)}"`);
      if (titleFormula) parts.push(`Title formula: ${titleFormula}`);
      // The extracted timestamps are a WEIGHTING and PLACEMENT signal, not decoration.
      // Previously only the section names and trigger types survived, so a remix copied
      // the source's themes but none of its shape. Convert timestamps to percentages of
      // runtime: the gaps say how long each section runs (which one is the expanded
      // peak), and the trigger positions say where each beat belongs.
      const tsToSec = (t: string): number | null => {
        const m = String(t || "").match(/^(?:(\d+):)?(\d+):(\d{2})$/);
        return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
      };
      const structRows = (Array.isArray(contentStructure) ? contentStructure : []) as any[];
      const secs = structRows.map((s) => tsToSec(s?.timestamp)).filter((n): n is number => n !== null);
      const runtime = secs.length ? Math.max(...secs) : 0;

      if (structRows.length > 0) {
        if (runtime > 0 && secs.length === structRows.length) {
          // Section i runs from its own timestamp to the next one; the last runs to the end.
          const spans = structRows.map((s, i) => {
            const start = tsToSec(s?.timestamp) ?? 0;
            const end = i + 1 < structRows.length ? (tsToSec(structRows[i + 1]?.timestamp) ?? runtime) : runtime * 1.12;
            return { name: s?.section || `Section ${i + 1}`, start, span: Math.max(1, end - start) };
          });
          const totalSpan = spans.reduce((a, b) => a + b.span, 0) || 1;
          const shaped = spans.map((s, i) => {
            const purpose = String(structRows[i]?.purpose || structRows[i]?.description || "").slice(0, 120);
            return `${s.name} (starts ~${Math.round((s.start / (runtime * 1.12)) * 100)}% in, ~${Math.round((s.span / totalSpan) * 100)}% of the runtime)${purpose ? ` — its job in the video: ${purpose}` : ""}`;
          });
          const biggest = [...spans].sort((a, b) => b.span - a.span)[0];
          parts.push(`Content shape to reproduce, WITH ITS WEIGHTING (this is the source's actual pacing, copy the proportions not just the order): ${shaped.join(" → ")}`);
          parts.push(`The source's LONGEST section by far is "${biggest.name}" at roughly ${Math.round((biggest.span / totalSpan) * 100)}% of the whole video. Your equivalent section must dominate the script in the same proportion — that is the scene you tell at full length while everything else stays tight.`);
        } else {
          const sections = structRows.map((s: any) => s.section || "").filter(Boolean);
          if (sections.length) parts.push(`Content structure to follow: ${sections.join(" → ")}`);
        }
      }
      if (retentionTriggers && Array.isArray(retentionTriggers) && retentionTriggers.length > 0) {
        const rows = (retentionTriggers as any[]).filter((t) => t?.trigger);
        const placed = rows.map((t) => {
          const sec = tsToSec(t?.timestamp);
          const pct = runtime > 0 && sec !== null ? Math.round((sec / (runtime * 1.12)) * 100) : null;
          // The "example" is the real moment from the source that performed this beat.
          // It shows HOW that video does the move, which is the thing worth reproducing;
          // the type name alone ("open loop") says nothing about execution.
          const how = String(t?.example || "").slice(0, 140);
          const where = pct === null ? String(t.trigger) : `${t.trigger} at ~${pct}% in`;
          return how ? `${where} — how the source did it: "${how}"` : where;
        });
        if (placed.length) parts.push(`Retention beats to place AT THESE PROPORTIONAL POSITIONS (not just somewhere in the script): ${placed.join("; ")}`);
      }
      enhancedAngle = parts.join(". ") + (angle ? `. ${angle}` : "");
    }

    const maxWords: Record<string, number> = { short: 200, medium: 400, long: 500, ultraLong: 600 };
    const cap = targetMinutes ? Math.round(targetMinutes * 130 / 10) : (maxWords[videoLength] ?? 400);
    const truncated = truncateTranscript(transcript || "", cap);
    console.log(`[generate] length=${videoLength} minutes=${targetMinutes ?? "-"} plan=${plan}`);

    // Niche resolution: if the user left niche blank or typed something that
    // doesn't map to a canonical niche, auto-detect it from the transcript /
    // topic / angle. Otherwise the niche-keyed learning (frameworks, hooks,
    // titles, magnet) silently no-ops on a "general" fallback.
    let resolvedNiche: string = niche || "";
    if (!normalizeNiche(resolvedNiche)) {
      const basis = (typeof transcript === "string" && transcript.trim().length > 100)
        ? transcript
        : [topic, angle].filter(Boolean).join(". ");
      const detected = await detectNiche(basis).catch(() => null);
      if (detected) { resolvedNiche = detected; console.log(`[generate] niche auto-detected: ${detected}`); }
    }

    // Collective learning layer: real viral frameworks from this niche, captured
    // by Viral Remixer usage. For a bend, pull from BOTH source + bridge niches.
    const nicheFrameworks = bridgeNiche
      ? await getBendFrameworksBlock(sourceNiche || resolvedNiche, bridgeNiche).catch(() => null)
      : await getNicheFrameworksBlock(resolvedNiche).catch(() => null);

    // Hook learning for the script's opening line: proven hooks for this niche
    // (view-ranked) + hooks creators kept (feedback loop). Both time-boxed and
    // null-safe; combined into one block the prompt models the hook field on.
    const hookNiche = bridgeNiche || resolvedNiche;
    const [hookExamples, keptHooks, titleFormulas] = await Promise.all([
      getNicheHookExamplesBlock(hookNiche).catch(() => null),
      getKeptHooksBlock(hookNiche).catch(() => null),
      getNicheTitleFormulasBlock(hookNiche).catch(() => null),
    ]);
    const nicheHookExamples = [
      keptHooks ? `Hooks creators kept (weight these highest):\n${keptHooks}` : "",
      hookExamples || "",
    ].filter(Boolean).join("\n\n") || null;

    // Voice matching: per-script selection wins; "default" = no voice;
    // no selection falls back to the user's active profile
    let voiceProfile: string | null = null;
    let voiceName: string | null = null;
    let voiceFingerprint: any = undefined;
    if (voiceProfileId === "default") { /* explicit Skripr Default — no voice */ }
    else {
      const meta = voiceProfileId
        ? await getVoiceMetaById(userId, String(voiceProfileId)).catch(() => null)
        : await getActiveVoiceMeta(userId).catch(() => null);
      if (meta) { voiceProfile = meta.styleGuide; voiceName = meta.name; voiceFingerprint = meta.fingerprint; }
    }
    if (voiceProfile) console.log(`[voice] profile injected: ${voiceName} (${voiceProfile.length} chars)`);

    // Learning loop: if this is a remix of a real YouTube video (New Script URL),
    // bank its framework into the pool. Overlaps generation so it adds ~no
    // wall-time, and skips if the video was already captured. Never blocks.
    const capturePromise: Promise<void> = (sourceVideoId && typeof transcript === "string" && transcript.trim().length > 200)
      ? captureFrameworkInBackground({ videoId: String(sourceVideoId), transcript, title: topic || null })
      : Promise.resolve();

    // Angle feedback loop: generating from an angle is the "I picked this" signal.
    // Bank it (overlapping generation) so future "Suggest Angles" in this niche
    // lean toward angles creators actually choose. Never blocks.
    // For a bend, key the pick to the canonical bridge niche (what the bend
    // angle reader looks up) — NOT the freeform `niche`/audience string, or the
    // pick would be written to a drawer nothing reads from.
    const anglePickNiche = bridgeNiche || resolvedNiche || null;
    const anglePromise: Promise<void> = (typeof angle === "string" && angle.trim().length > 8)
      ? saveAnglePick({
          user_id: userId,
          niche: anglePickNiche,
          topic: topic || null,
          angle_text: angle,
          hook_type: typeof hookType === "string" ? hookType : null,
          audience_emotion: null,
        })
      : Promise.resolve();

    // Storytelling craft layer: resolve once so the same values drive the prompt
    // AND get persisted with the script (the detail page shows them back).
    const resolvedStoryMode = storytellingMode || autoSelectMode(resolvedNiche, topic).id;
    const resolvedStoryTechniques = resolveTechniques(
      Array.isArray(storytellingTechniques) && storytellingTechniques.length ? storytellingTechniques : null
    );

    const scriptPromise = generateScript({
      sourceTranscript: truncated,
      targetTopic: topic || "",
      targetNiche: resolvedNiche || "general",
      sourceTitle: topic || "",
      sourceNiche: resolvedNiche || "general",
      videoLength: videoLength as any,
      targetMinutes: targetMinutes ?? undefined,
      tone: "entertaining",
      ttsOptimized: false,
      viralMagnetWord: magnetWord,
      angle: enhancedAngle || undefined,
      nicheFrameworks: nicheFrameworks || undefined,
      nicheHookExamples: nicheHookExamples || undefined,
      nicheTitleFormulas: titleFormulas || undefined,
      voiceProfile: voiceProfile || undefined,
      voiceName: voiceName || undefined,
      // Section-by-section: the source's measured structure, scaled to the chosen
      // length, so each section is written against its own function and word budget.
      sectionPlan: targetMinutes
        ? buildSectionPlan(contentStructure, retentionTriggers, Math.round(targetMinutes * 150))
        : undefined,
      remixRecipe: remixFramework || undefined,
      // Hook-first inputs: the hook is written and archetype-validated before the body.
      hookArchetype: hookType || undefined,
      hookWhyItWorks: hookWhyItWorks || undefined,
      hookScript: hookScript || undefined,
      voiceFingerprint,
      companionCta: !!companionCta,
      softCta: !!softCta,
      topicKind: topicKind === "explainer" || topicKind === "hypothetical" || topicKind === "claim" ? topicKind : "event",
      sourceVerdict: sourceVerdict === "documented" || sourceVerdict === "partial" || sourceVerdict === "unverified" ? sourceVerdict : undefined,
      // Storytelling engine: honor the user's picks; auto-select the mode when
      // none was sent (old clients / one-click generate). buildStorytellingBlock
      // resolves coherence + core techniques downstream.
      storytellingMode: resolvedStoryMode,
      storytellingTechniques: Array.isArray(storytellingTechniques) ? storytellingTechniques : undefined,
      sourceMaterial: typeof sourceMaterial === "string" && sourceMaterial.trim() ? sourceMaterial.trim() : undefined,
      selectedTitle: typeof selectedTitle === "string" && selectedTitle.trim() ? selectedTitle.trim() : undefined,
      directorNote: typeof directorNote === "string" && directorNote.trim() ? directorNote.trim() : undefined,
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
    // Safety net: the prompt forbids sponsor reads, but if one slips through,
    // drop any paragraph carrying an unambiguous ad marker (URL, promo code,
    // "link in the description", "this video's sponsor", donation match).
    const AD_MARKER = /\b(this (?:video|episode)'?s sponsor|sponsored by|use code|promo code|link in (?:the )?(?:description|bio)|first-time donors|donation matched|matched up to \$|\b\w+\.com\/|go to \w+\.com|visit \w+\.com)\b/i;
    const stripAds = (s: any) => {
      if (typeof s !== "string") return s;
      const kept = s.split(/\n\n+/).filter((p: string) => !AD_MARKER.test(p));
      return (kept.length ? kept : s.split(/\n\n+/)).join("\n\n");
    };
    for (const k of ["fullScript", "script", "body", "content", "hook", "cta"]) {
      if (script[k]) script[k] = stripAds(script[k]);
    }
    if (Array.isArray(script.sections)) script.sections = script.sections
      .filter((s: any) => !AD_MARKER.test(`${s?.title ?? ""} ${s?.content ?? ""}`))
      .map((s: any) => ({ ...s, title: cleanText(s.title), content: cleanText(s.content) }));
    console.log(`[generate] done in ${elapsed}ms`);

    // Self-review: a dedicated accuracy + consistency pass over the finished draft
    // (see src/lib/ai/self-review.ts). Runs BEFORE autosave and the fact scan so
    // the saved, scanned, and returned script is the corrected one. Never blocks:
    // on any failure it returns the draft unchanged.
    let reviewChanges: string[] = [];
    try {
      const reviewBody = (script as any).fullScript || (script as any).script || (script as any).body || (script as any).content || "";
      const reviewed = await reviewAndCorrectScript({
        hook: (script as any).hook || "",
        body: reviewBody,
        title: (script as any).title || undefined,
        sourceMaterial: typeof sourceMaterial === "string" ? sourceMaterial : undefined,
      });
      reviewChanges = reviewed.changes;
      if (reviewed.changes.length) {
        (script as any).hook = reviewed.hook;
        // Write the corrected body into every body field that exists, since render
        // and autosave read them in different precedence orders.
        for (const k of ["fullScript", "script", "body", "content"]) {
          if ((script as any)[k]) (script as any)[k] = reviewed.body;
        }
      }
    } catch (e) { console.error("[self-review] failed:", e); }

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
            voice_name: voiceName,
            source_video_id: sourceVideoId || null,
            storytelling_mode: resolvedStoryMode,
            storytelling_techniques: resolvedStoryTechniques,
          })
          .select("id")
          .single();
        if (saveError) console.error("[autosave] insert failed:", saveError.message);
        savedId = saved?.id ?? null;
      }
    } catch (e) {
      console.error("[autosave] failed:", e);
    }

    await capturePromise.catch(() => {}); // already overlapped generation; ensure it lands
    await anglePromise.catch(() => {});   // bank the picked angle (overlapped generation)
    console.log(`[generate] total ${Date.now() - startTime}ms`);
    // Deterministic fact scan: flag dates/dollar figures in the finished script
    // that are not in the source material it was allowed to use. Catches the
    // date/number confabulation a prompt rule cannot fully prevent.
    const scannedText = [script.hook, script.fullScript, script.script, script.body, script.content, script.cta]
      .filter((x: any) => typeof x === "string").join("\n\n");
    const factCheck = factCheckAgainstSource(scannedText, typeof sourceMaterial === "string" ? sourceMaterial : "");

    // SEMANTIC GROUNDING is an LLM round-trip, so it is OFF the critical generation path — the
    // accumulating generation-tail passes were tipping long builds past the function time limit.
    // The inline SAFETY cut stays deterministic (stripInsinuations in generateScript, regex, no
    // LLM); the LLM culpability/narrative check runs ONLY on demand (the "Check claims" button →
    // /api/scripts/grounding), so it never blocks or slows the build.
    const semanticGrounding: any = undefined;

    return NextResponse.json({ ...script, magnetSuggestions, savedId, factCheck, reviewChanges, semanticGrounding });
  } catch (error: any) {
    console.error("Script generation error:", error.message);
    // Refund the credit — user shouldn't pay for our failure
    await refundGenerationCount(userId, genEventId).catch(e => console.error("[usage] refund failed:", e));
    return NextResponse.json({ error: error.message || "Failed to generate script" }, { status: 500 });
  }
}
