import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateScript, buildSectionPlan, buildTopicBlueprint, generateHookFirst, writeSection, assembleFinalizeScript, reconcileTitle, dropOpeningEchoes, sceneFactsOwnedElsewhere, type SectionSpec } from "@/lib/ai/claude";
import { checkScriptLimit, incrementGenerationCount, refundGenerationCount } from "@/lib/usage";
import { getMagnetSuggestions } from "@/lib/magnet-word";
import { supabaseAdmin } from "@/lib/db/supabase";
import { joinHookBody } from "@/lib/script-text";
import { getNicheFrameworksBlock, getBendFrameworksBlock, getNicheHookExamplesBlock, getNicheTitleFormulasBlock, getNicheOutlierPatterns, normalizeNiche } from "@/lib/viral-frameworks";
import { detectNiche } from "@/lib/niche-detect";
import { getKeptHooksBlock } from "@/lib/hook-picks";
import { saveAnglePick } from "@/lib/angle-picks";
import { autoSelectMode, resolveTechniques } from "@/lib/storytelling";
import { factCheckAgainstSource } from "@/lib/fact-check";
import { reviewAndCorrectScript } from "@/lib/ai/self-review";
import { finalCheck } from "@/lib/ai/final-check";
import { getActiveVoiceMeta, getVoiceMetaById, SKRIPR_HOUSE_VOICE } from "@/lib/voice-profile";
import { captureFrameworkInBackground } from "@/lib/framework-capture";
import { chooseStructure, STRUCTURE_FAMILIES_ENABLED, type ChosenStructure } from "@/lib/structure-families";
import { researchCentralScene, quotedPhrases } from "@/lib/research";
import { vetAngles } from "@/lib/ai/angle-vet";
import { splitSentences, tagFactSources, replaceFamilyNames, minorsInFacts } from "@/lib/script-compliance";
// semantic-grounding is now on-demand only (see below) — not run on the generation path.

export const maxDuration = 300;

function truncateTranscript(text: string, maxWords = 400): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
}

// CHUNKED GENERATION — write ONE section (mode:"section"). Cheap, stateless, and fast (<30s), so
// no single request runs long. The client loops this over the section plan, passing the running
// tail so each section continues the last. NO tail passes run here — every silent-fix + safety
// pass runs once, later, in mode:"finalize" on the assembled whole. A failed write retries once,
// then fails with a clear message; it never silently drops to an ungrounded fallback.
// Scene facts travel inside the blueprint; every step that writes or CHECKS the script must see them
// as part of the research, or the fact check would remove true scene details as "unsupported".
function withSceneFacts(material: string | undefined, plan: any[] | undefined): string | undefined {
  const scene = Array.isArray(plan) ? [...new Set(plan.flatMap((p: any) => (Array.isArray(p?.sceneFacts) ? p.sceneFacts : [])))] : [];
  if (!scene.length) return material;
  return [material || "", ...scene].filter(Boolean).join("\n");
}

async function handlePolishMode(userId: string, raw: any) {
  try {
    const { hook, body, title, sourceMaterial, blueprint, savedId, topic } = raw || {};
    if (typeof body !== "string" || !body.trim()) return NextResponse.json({ error: "Nothing to check." }, { status: 400 });
    const facts = withSceneFacts(typeof sourceMaterial === "string" && sourceMaterial.trim() ? sourceMaterial.trim() : undefined, Array.isArray(blueprint) ? blueprint : undefined) || "";
    // The page's body already OPENS with the hook paragraph. Check the rest as the body and the hook as
    // the hook, then put them back together; otherwise the check saw the hook twice and cut the body's
    // copy as a re-staged opening (seen live: a script that began "That's the surface.").
    const hookText = typeof hook === "string" ? hook.trim() : "";
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const paras = body.split(/\n\n+/);
    const opensWithHook = !!hookText && paras.length > 1 && norm(paras[0]).startsWith(norm(hookText).split(" ").slice(0, 8).join(" "));
    const rest = opensWithHook ? paras.slice(1).join("\n\n") : body;
    const checked = await finalCheck({ hook: hookText, body: rest, title: typeof title === "string" ? title : undefined, facts, subject: typeof topic === "string" ? topic : "" });
    const res = { ...checked, body: opensWithHook ? `${checked.hook}\n\n${checked.body}` : checked.body };
    // Keep the saved copy in step with what the creator sees.
    if (res.status === "ok" && res.changes.length && supabaseAdmin && typeof savedId === "string" && savedId) {
      const content = opensWithHook ? res.body : joinHookBody(res.hook, res.body);
      const { error } = await supabaseAdmin.from("scripts")
        .update({ content, word_count: content.split(/\s+/).filter(Boolean).length })
        .eq("id", savedId).eq("user_id", userId);
      if (error) console.error("[final-check] save failed:", error.message);
    }
    return NextResponse.json({ hook: res.hook, body: res.body, changes: res.changes, status: res.status });
  } catch (e: any) {
    console.error("[final-check] route error:", e?.message || e);
    return NextResponse.json({ error: "Final check failed." }, { status: 500 });
  }
}

async function handleSectionMode(userId: string, raw: any) {
  try {
    const { topic, selectedTitle, sourceMaterial, remixFramework, contentStructure, retentionTriggers, targetMinutes, voiceProfileId, sectionIndex, priorTail, priorText, blueprint, directorNote, presetHook } = raw;
    const index = Number(sectionIndex);
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "Invalid section index." }, { status: 400 });
    }
    if (!targetMinutes) {
      return NextResponse.json({ error: "A section build needs a target length." }, { status: 400 });
    }
    // TOPIC path: the client passes back the STORY BLUEPRINT computed once at plan time (an LLM plan
    // is not deterministic, so it can't be re-derived per call). REMIX path: no blueprint travels, so
    // re-derive the deterministic measured plan as before. Either way we end with a stable plan[index].
    const plan: SectionSpec[] = Array.isArray(blueprint) && blueprint.length >= 2
      ? (blueprint as SectionSpec[])
      : buildSectionPlan(contentStructure, retentionTriggers, Math.round(targetMinutes * 150));
    if (!plan || plan.length < 2) {
      return NextResponse.json({ error: "This video has no measurable section structure — use the one-shot path." }, { status: 409 });
    }
    if (index >= plan.length) {
      return NextResponse.json({ error: `Section ${index} is out of range (${plan.length} sections).` }, { status: 400 });
    }

    // Voice: same resolution as the one-shot path, so a section reads in the chosen voice from the
    // first word (voice is not a finishing touch — the finalize voice pass only refines it).
    let voiceProfile: string | null = null;
    if (voiceProfileId !== "default") {
      const meta = voiceProfileId
        ? await getVoiceMetaById(userId, String(voiceProfileId)).catch(() => null)
        : await getActiveVoiceMeta(userId).catch(() => null);
      if (meta) voiceProfile = meta.styleGuide;
    }
    // No custom Voice Match profile → use the Skripr HOUSE voice, not a generic narrator, so a
    // default-voice script still has a recognizable Skripr identity.
    if (!voiceProfile) voiceProfile = SKRIPR_HOUSE_VOICE;

    const facts = withSceneFacts(typeof sourceMaterial === "string" && sourceMaterial.trim() ? sourceMaterial.trim() : undefined, Array.isArray(blueprint) ? blueprint : undefined);
    const context = {
      topic: topic || "",
      // Reconcile the placeholder title against the researched facts BEFORE the section-writer sees
      // it, so the hook draws its duration/pronoun from the corrected title, not the guess.
      title: reconcileTitle(selectedTitle || topic || "", facts),
      sourceMaterial: facts,
      recipe: remixFramework || undefined,
      voice: voiceProfile || undefined,
      previousTail: typeof priorTail === "string" ? priorTail : "",
      // Everything the earlier sections already narrated, so this one can't re-tell it, and the facts
      // the plan assigned to LATER sections, so a twist or the climax can't leak early.
      // The hook plays first, so it is already told (seen live: section 1 re-staged the DMV scene the
      // hook had just opened on).
      alreadyTold: [typeof presetHook === "string" ? presetHook : "", typeof priorText === "string" ? priorText : ""].filter((x) => x.trim()).join("\n\n"),
      openingHook: typeof presetHook === "string" && presetHook.trim() ? presetHook.trim() : undefined,
      reservedFacts: plan.slice(index + 1).flatMap((p) => p.assignedFacts || []),
      otherPoints: plan.filter((_, k) => k !== index).map((p) => p.point || "").filter(Boolean),
      directorNote: typeof directorNote === "string" && directorNote.trim() ? directorNote.trim() : undefined,
    };

    if (index === 0) console.log(`[generate] section mode directorNote=${context.directorNote ? `yes chars=${context.directorNote.length} :: "${context.directorNote.slice(0, 160).replace(/\s+/g, " ")}"` : "none"}`);
    let text = "";
    for (let attempt = 0; attempt < 2 && !text; attempt++) {
      try {
        text = await writeSection(plan[index], index, plan.length, context);
      } catch (e) {
        console.error(`[section] index ${index} attempt ${attempt + 1} failed:`, (e as any)?.message);
      }
    }
    if (!text) {
      return NextResponse.json({ error: "That section didn't come back — please try generating again." }, { status: 502 });
    }
    // The tail the next section continues from — the same 40-word window the one-shot loop uses.
    const tail = text.split(/\s+/).slice(-40).join(" ");
    return NextResponse.json({ mode: "section", index, total: plan.length, name: plan[index].name, text, tail });
  } catch (e: any) {
    console.error("[section] mode failed:", e?.message);
    return NextResponse.json({ error: e?.message || "Section generation failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const routeStartedAt = Date.now(); // for the finalize deadline (measured from ROUTE start)
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw: any = await req.json().catch(() => ({}));
  // Tag facts that come only from the subject's or his family's own account, once, where they enter, so
  // every writer and checker downstream sees it.
  if (typeof raw?.sourceMaterial === "string" && raw.sourceMaterial.trim()) raw.sourceMaterial = tagFactSources(raw.sourceMaterial, String(raw.topic || ""));
  // CHUNKED GENERATION (the 20-min timeout fix): the one long request is split into a short
  // plan call, one short call per section, and a finalize call. Mode discriminates them.
  const mode: "full" | "plan" | "section" | "finalize" | "polish" =
    raw?.mode === "plan" || raw?.mode === "section" || raw?.mode === "finalize" || raw?.mode === "polish" ? raw.mode : "full";

  // A section write is cheap and stateless and must NOT count against usage — the plan call at
  // the head of the chunked build already counted the script. Handle it before any limit logic.
  if (mode === "section") return handleSectionMode(userId, raw);
  // The final check runs on a FINISHED script (already counted at finalize), as its own request so it
  // gets its own time budget instead of squeezing into finalize's.
  if (mode === "polish") return handlePolishMode(userId, raw);

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

  // Count the COMPLETING call, once per finished script: a one-shot "full", or the "finalize" of
  // a chunked build. "plan" checks the limit (above) but does NOT increment — so if chunking
  // fails partway and the client falls back to a one-shot "full", the script is still counted
  // exactly once, never twice. (The limit check already ran for every mode here, blocking an
  // over-limit user before any section API credits are burned.)
  const genEventId = (mode === "full" || mode === "finalize")
    ? await incrementGenerationCount(userId).catch(e => { console.error("[usage] increment failed:", e); return null; })
    : null;

  const startTime = Date.now();

  try {
    const { transcript, niche, topic, sourceVideoId, videoLength = "long", targetMinutes, viralMagnetWord, angle, remixFramework, hookType, titleFormula, hookScript, hookWhyItWorks, contentStructure, retentionTriggers, voiceProfileId, sourceNiche, bridgeNiche, companionCta, storytellingMode, storytellingTechniques, sourceMaterial, selectedTitle, softCta, noCta, sourceVerdict, topicKind, directorNote, sourceEntities } = raw;

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
    console.log(`[generate] mode=${mode} directorNote=${typeof directorNote === "string" && directorNote.trim() ? `yes chars=${directorNote.trim().length} :: "${directorNote.trim().slice(0, 160).replace(/\s+/g, " ")}"` : "none"}`);

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
    const frameworksBase = bridgeNiche
      ? await getBendFrameworksBlock(sourceNiche || resolvedNiche, bridgeNiche).catch(() => null)
      : await getNicheFrameworksBlock(resolvedNiche).catch(() => null);
    // Deeper Outlier learning: the story engines that recurred among real over-performers
    // in this niche, so the script's arc can lean on proven STRUCTURE (never their wording).
    const outlierPatterns = await getNicheOutlierPatterns(bridgeNiche || resolvedNiche).catch(() => null);
    const nicheFrameworks = [frameworksBase, outlierPatterns].filter(Boolean).join("\n\n") || null;

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
    if (voiceProfileId === "default") { /* explicit Skripr Default — house voice applied below */ }
    else {
      const meta = voiceProfileId
        ? await getVoiceMetaById(userId, String(voiceProfileId)).catch(() => null)
        : await getActiveVoiceMeta(userId).catch(() => null);
      if (meta) { voiceProfile = meta.styleGuide; voiceName = meta.name; voiceFingerprint = meta.fingerprint; }
    }
    // No custom Voice Match profile → fall to the Skripr HOUSE voice (a deliberate signature), not a
    // generic narrator, so "Skripr Default" still sounds like Skripr.
    if (!voiceProfile) { voiceProfile = SKRIPR_HOUSE_VOICE; voiceName = "Skripr House"; }
    if (voiceProfile) console.log(`[voice] profile injected: ${voiceName} (${voiceProfile.length} chars)`);

    // Learning loop: if this is a remix of a real YouTube video (New Script URL),
    // bank its framework into the pool. Overlaps generation so it adds ~no
    // wall-time, and skips if the video was already captured. Never blocks.
    // Skip on finalize: the plan call at the head of this chunked build already fired both
    // learning loops, so re-firing here would double-count (capture dedupes, but the angle pick
    // would be banked twice).
    const capturePromise: Promise<void> = (mode !== "finalize" && sourceVideoId && typeof transcript === "string" && transcript.trim().length > 200)
      ? captureFrameworkInBackground({ videoId: String(sourceVideoId), transcript, title: topic || null })
      : Promise.resolve();

    // Angle feedback loop: generating from an angle is the "I picked this" signal.
    // Bank it (overlapping generation) so future "Suggest Angles" in this niche
    // lean toward angles creators actually choose. Never blocks.
    // For a bend, key the pick to the canonical bridge niche (what the bend
    // angle reader looks up) — NOT the freeform `niche`/audience string, or the
    // pick would be written to a drawer nothing reads from.
    const anglePickNiche = bridgeNiche || resolvedNiche || null;
    const anglePromise: Promise<void> = (mode !== "finalize" && typeof angle === "string" && angle.trim().length > 8)
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

    // SECTION PLAN. Remix mode measures the SOURCE video's structure. Topic/phenomenon mode has no
    // source to measure, so when there is no measurable structure we synthesize a fact-assigned STORY
    // BLUEPRINT from the approved research: beats that escalate toward a thesis, each with its own
    // disjoint slice of facts and word budget, so the draft arrives near length with facts already
    // spread — the refill loop stops being load-bearing. Computed ONCE here (one-shot "full" path),
    // so there is no per-section-call non-determinism. Falls back to undefined (one-shot writer) if
    // the blueprint can't be built. The chunked "section" mode keeps its deterministic buildSectionPlan.
    let resolvedSectionPlan: SectionSpec[] | undefined;
    let chosenStructure: ChosenStructure | null = null;
    if (Array.isArray(raw.blueprint) && raw.blueprint.length >= 2) {
      // The client echoed back the blueprint from the plan call (finalize mode) — reuse it verbatim,
      // never rebuild (an LLM plan is not deterministic, and finalize just needs the same section set).
      resolvedSectionPlan = raw.blueprint as SectionSpec[];
    } else if (targetMinutes) {
      const measured = buildSectionPlan(contentStructure, retentionTriggers, Math.round(targetMinutes * 150));
      if (measured.length >= 2) {
        resolvedSectionPlan = measured;
      } else if (mode !== "finalize") {
        // Topic/phenomenon: synthesize the story blueprint. Only for "plan" and one-shot "full" —
        // finalize with no measured structure reaches here without a blueprint, and that's fine
        // (assembleFinalizeScript works off the client-provided sections; no plan needed to stitch).
        const bpMaterial = typeof sourceMaterial === "string" && sourceMaterial.trim() ? sourceMaterial.trim() : undefined;
        // WINNING STRUCTURE (data-driven): the story shape from this niche's (or, without enough data, all
        // niches') outlier winners that THIS research can fill. The creator's pick from the storytelling step
        // wins ("structureFamilyId", or "none" for Skripr's own planner); otherwise Skripr chooses.
        // The creator already saw and kept a structure in the storytelling step: use exactly that one.
        if (!STRUCTURE_FAMILIES_ENABLED) { /* shelved: Skripr's own planner */ }
        else if (raw.structure && typeof raw.structure === "object" && Array.isArray(raw.structure.stages) && raw.structure.stages.length >= 4) {
          chosenStructure = raw.structure as ChosenStructure;
          console.log(`[generate] structure (creator's pick): "${chosenStructure.name}"`);
        } else if (raw.structureFamilyId !== "none" && bpMaterial) {
          chosenStructure = await chooseStructure({ niche: resolvedNiche, facts: bpMaterial.split("\n").map((l: string) => l.replace(/^-\s*/, "").trim()).filter(Boolean), angle: enhancedAngle, topic: topic || "", familyId: typeof raw.structureFamilyId === "string" ? raw.structureFamilyId : null }).catch(() => null);
          if (chosenStructure) console.log(`[generate] structure: ${chosenStructure.source} "${chosenStructure.name}" (${chosenStructure.scope}, fit ${chosenStructure.fit})`);
        }
        const bp = await buildTopicBlueprint(bpMaterial, Math.round(targetMinutes * 165), targetMinutes, enhancedAngle, { hookType: hookType || undefined, storytelling: resolvedStoryMode, directorNote: typeof directorNote === "string" && directorNote.trim() ? directorNote.trim() : undefined, structure: chosenStructure ? { name: chosenStructure.name, stages: chosenStructure.stages } : undefined });
        if (bp.length >= 2 && bp[0]?.concept) {
          // CENTRAL-SCENE RESEARCH: the documented specifics of the concept's central moment, so the
          // writer renders the real scene instead of inventing one. Opening + final beats get them.
          const existing = (bpMaterial || "").split("\n").filter(Boolean);
          // The scene facts go to the OPENING beat, so research exactly that beat's moment, dated by the
          // year its own assigned facts are about.
          const yrs = [bp[0].name, bp[0].point, ...(bp[0].assignedFacts || [])].flatMap((t) => (String(t || "").match(/\b(1[89]\d{2}|20\d{2})\b/g) || []).map(Number));
          const tally = new Map<number, number>(); yrs.forEach((y) => tally.set(y, (tally.get(y) || 0) + 1));
          const momentYear = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
          const momentText = [bp[0].point, bp[0].name].filter(Boolean).join(": ") || bp[0].concept;
          // BEAT-POINT VETTING, in parallel with scene research. The planner writes each beat's point
          // itself, and concept mode assigns only facts that SERVE the point, so a false point silently
          // drops the fact that refutes it (seen live, LeFevre: "the entire family was living inside a
          // lie they had no knowledge of" while the research says she told her husband months before the
          // arrest; the script then stated the false version). Same evidence-gated check as the cards.
          const planned = bp.map((b) => ({ point: b.point, name: b.name, assignedFacts: [...(b.assignedFacts || [])] }));
          const vetP = vetAngles([String(bp[0].concept || ""), ...bp.map((b) => String(b.point || ""))], bpMaterial || "").catch(() => [] as string[][]);
          const found = await researchCentralScene(topic || "", momentText, existing, momentYear).catch(() => []);
          const vet = await vetP;
          const fixNote = (ws: string[]) => ` CORRECTION FROM THE RESEARCH (the script states the research version, never the conflicting wording): ${ws.join(" | ")}`;
          const refuting = (ws: string[]) => ws.flatMap((w) => { const m = w.match(/conflicts with your research: "([^"]+?)(?:…)?"$/); if (!m) return []; const key = m[1].slice(0, 80); return existing.filter((f) => f.includes(key)).slice(0, 1); });
          const conceptW = vet[0] || [];
          if (conceptW.length) bp.forEach((b) => { b.concept = `${b.concept}${fixNote(conceptW)}`; });
          bp.forEach((b, i) => {
            const ws = vet[i + 1] || [];
            if (!ws.length) return;
            b.point = `${b.point || ""}${fixNote(ws)}`;
            for (const f of [...refuting(ws), ...refuting(conceptW)]) if (!(b.assignedFacts || []).includes(f)) b.assignedFacts = [...(b.assignedFacts || []), f];
          });
          const flagged = vet.reduce((n, w) => n + (w?.length || 0), 0);
          if (flagged) console.log(`[blueprint] point-vet corrected ${flagged} claim(s) :: ${vet.flat().map((w) => w.slice(0, 160)).join(" || ")}`);
          const own = sceneFactsOwnedElsewhere(found.map((f) => f.fact), planned);
          if (own.moved.length) console.log(`[scene-research] left ${own.moved.length} fact(s) to the later beat that owns them :: ${own.moved.map((f) => f.slice(0, 100)).join(" || ")}`);
          const scene = found.filter((f) => own.keep.includes(f.fact));
          if (scene.length) {
            const lines = scene.map((f) => (f.source ? `${f.fact} (source: ${f.source})` : f.fact));
            // Opening beat ONLY. Giving the same scene to the final beat too made the script tell the
            // arrest twice (and put the scene on the opening's own "reserved for later" list). The final
            // beat returns to the moment as a callback; it doesn't re-explain how it happened.
            bp[0].sceneFacts = lines;
            bp[0].assignedFacts = [...(bp[0].assignedFacts || []), ...lines];
            // Spoken lines at the central moment (scene facts first, then any assigned fact quoting it).
            const quotes = [...new Set(scene.flatMap((f) => quotedPhrases(f.fact)))].filter((q) => q.split(/\s+/).length <= 20).slice(0, 4);
            if (quotes.length) bp.forEach((b) => { b.centralQuotes = quotes; });
          }
        }
        if (bp.length >= 2 && bp[0]?.concept) {
          const gone: string[] = [];
          const echoes = dropOpeningEchoes(bp, gone);
          if (echoes) console.log(`[blueprint] dropped ${echoes} later-beat facts that restate the cold open :: ${gone.map((f) => f.slice(0, 120)).join(" || ")}`);
        }
        if (bp.length >= 2) {
          resolvedSectionPlan = bp;
          const assigned = bp.reduce((n, b) => n + (b.assignedFacts?.length || 0), 0);
          console.log(`[blueprint] topic story blueprint: ${bp.length} beats, ${assigned} facts assigned, target ${Math.round(targetMinutes * 165)} words`);
        }
      }
    }

    const scriptInput: Parameters<typeof generateScript>[0] = {
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
      // Section-by-section: remix uses the source's measured structure; topic uses the synthesized
      // story blueprint (resolved just above), each section written against its own budget + facts.
      sectionPlan: resolvedSectionPlan,
      remixRecipe: remixFramework || undefined,
      // Hook-first inputs: the hook is written and archetype-validated before the body.
      hookArchetype: hookType || undefined,
      hookWhyItWorks: hookWhyItWorks || undefined,
      hookScript: hookScript || undefined,
      voiceFingerprint,
      companionCta: !!companionCta,
      softCta: !!softCta,
      noCta: !!noCta,
      topicKind: topicKind === "explainer" || topicKind === "hypothetical" || topicKind === "claim" ? topicKind : "event",
      sourceVerdict: sourceVerdict === "documented" || sourceVerdict === "partial" || sourceVerdict === "unverified" ? sourceVerdict : undefined,
      // Storytelling engine: honor the user's picks; auto-select the mode when
      // none was sent (old clients / one-click generate). buildStorytellingBlock
      // resolves coherence + core techniques downstream.
      storytellingMode: resolvedStoryMode,
      storytellingTechniques: Array.isArray(storytellingTechniques) ? storytellingTechniques : undefined,
      sourceMaterial: withSceneFacts(typeof sourceMaterial === "string" && sourceMaterial.trim() ? sourceMaterial.trim() : undefined, resolvedSectionPlan),
      selectedTitle: typeof selectedTitle === "string" && selectedTitle.trim() ? selectedTitle.trim() : undefined,
      directorNote: typeof directorNote === "string" && directorNote.trim() ? directorNote.trim() : undefined,
      sourceEntities: Array.isArray(sourceEntities) ? sourceEntities.filter((e: any) => typeof e === "string") : undefined,
      routeStartedAt,
    };

    // PLAN mode: the head of a chunked build. Return the presetHook (one cheap hook call) and the
    // number of sections so the client can loop. Does not increment usage — the completing
    // "finalize" (or a fallback "full") is what counts. If the source has no measurable structure
    // (plan < 2 sections), tell the client to fall back to the one-shot path.
    if (mode === "plan") {
      const planned = scriptInput.sectionPlan;
      if (!planned || planned.length < 2) {
        // No measurable structure — the client falls back to the one-shot path, which counts.
        return NextResponse.json({ mode: "plan", total: 0, presetHook: null, title: scriptInput.selectedTitle || topic || "" });
      }
      // Reconcile the placeholder title against the researched facts NOW, so the preset hook is
      // written from the corrected duration/pronoun and the client displays the corrected title.
      const planFacts = withSceneFacts(typeof sourceMaterial === "string" && sourceMaterial.trim() ? sourceMaterial.trim() : undefined, scriptInput.sectionPlan);
      const reconciledTitle = reconcileTitle(scriptInput.selectedTitle || topic || "", planFacts);
      const presetHook = await generateHookFirst({
        title: reconciledTitle,
        topic: topic || "",
        hookType: hookType || undefined,
        hookWhyItWorks: hookWhyItWorks || undefined,
        hookScript: hookScript || undefined,
        // The SPECIFIC angle the creator picked on the angle page — so the hook delivers THAT angle
        // (curiosity gap vs reframe vs myth-bust) instead of every type grabbing the same top fact.
        anglePremise: typeof raw.anglePremise === "string" ? raw.anglePremise : undefined,
        anglePayoff: typeof raw.anglePayoff === "string" ? raw.anglePayoff : undefined,
        angleQuestion: typeof raw.angleQuestion === "string" ? raw.angleQuestion : undefined,
        // Learned, view-ranked, creator-kept hooks for this niche — so the hook writer improves from
        // analyzed viral videos, the same signal the angle + body writers already use.
        nicheHookExamples: nicheHookExamples || undefined,
        sourceMaterial: planFacts,
        voiceProfile: voiceProfile || undefined,
        directorNote: typeof directorNote === "string" && directorNote.trim() ? directorNote.trim() : undefined,
      });
      // Return the blueprint ONLY when it is a synthesized topic plan (carries assignedFacts). The
      // remix measured plan re-derives deterministically per section call, so it need not travel.
      const isBlueprint = planned.some((s) => Array.isArray(s.assignedFacts));
      return NextResponse.json({ mode: "plan", total: planned.length, presetHook, title: reconciledTitle, blueprint: isBlueprint ? planned : undefined,
        structure: chosenStructure ? { name: chosenStructure.name, source: chosenStructure.source, scope: chosenStructure.scope, fit: chosenStructure.fit, evidence: chosenStructure.evidence } : undefined });
    }

    let script: any;
    if (mode === "finalize") {
      // The client looped the sections; assemble them and run the ENTIRE generation tail on the
      // joined body (assembleFinalizeScript -> finalizeScript). No section writing happens here,
      // so this call is passes-only and fits comfortably in the time budget.
      const sections = Array.isArray(raw.sections) ? raw.sections : [];
      if (sections.length < 2) {
        return NextResponse.json({ error: "No sections were provided to finalize." }, { status: 400 });
      }
      script = await assembleFinalizeScript(scriptInput, sections, typeof raw.presetHook === "string" ? raw.presetHook : null);
    } else {
      const scriptPromise = generateScript(scriptInput);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Script generation timed out — our AI is taking longer than expected. Could you wait a moment and then try again?")), 290000)
      );
      script = await Promise.race([scriptPromise, timeoutPromise]) as any;
    }
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
        // Abbreviation-aware split ("U.S.", "Gov.", "Mr."), and never break while a quote is open (seen
        // live: "Deputy U." / "S. Marshal" and a governor's quote split across two paragraphs).
        const sents = splitSentences(p);
        const chunks: string[] = [];
        let cur = "";
        let n = 0;
        for (const sent of sents) {
          cur += (cur ? " " : "") + sent;
          n++;
          const quoteOpen = ((cur.match(/"/g) || []).length % 2 === 1) || ((cur.match(/“/g) || []).length > (cur.match(/”/g) || []).length);
          if (!quoteOpen && (n >= 5 || cur.length > 600)) { chunks.push(cur.trim()); cur = ""; n = 0; }
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
      // The family rule wins over the accuracy reviewer (seen live: it "restored Hannah's name, which was
      // replaced with 'his daughter'"). Re-apply it, and never show a note about restoring a name.
      const famFacts = typeof sourceMaterial === "string" ? sourceMaterial : "";
      const famNames = minorsInFacts(famFacts).flatMap((f) => [f.first, f.name]);
      reviewed.hook = replaceFamilyNames(reviewed.hook, famFacts, topic || "").text;
      reviewed.body = replaceFamilyNames(reviewed.body, famFacts, topic || "").text;
      reviewed.changes = reviewed.changes.filter((c: string) => !famNames.some((n) => n && c.includes(n)) && !/\brestor\w* .{0,20}name/i.test(c));
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
