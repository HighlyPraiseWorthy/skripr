// RETENTION DNA (Phase 1 of the timing guide, 2026-10-07). Measures WHEN information moments happen in a
// video, from its timed captions: questions opened and closed, re-hooks (and what caused them), mini and major
// reveals, the turn, new evidence, repetition. The model only labels numbered caption lines; code converts the
// line numbers to real seconds, so no position is ever estimated by the model.
//
// Principle (reviewer + creator): research decides what a script says; winning-video data guides WHEN it says
// it. These are observed patterns with confidence, never rules, and never a reason to add a beat the research
// can't support.
import { Anthropic } from "@anthropic-ai/sdk";
import { YoutubeTranscript } from "youtube-transcript";

export interface TimedLine { i: number; t: number; text: string }
export const EVENT_KINDS = ["question_open", "question_close", "rehook", "mini_reveal", "major_reveal", "turn", "evidence", "escalation", "new_entity", "context", "repetition", "sponsor"] as const;
export const REHOOK_MECHANISMS = ["new_question", "surprising_fact", "contradiction", "escalation", "new_character", "new_evidence", "consequence", "comparison", "future_promise"] as const;
export const OPENING_TYPES = ["before_outcome", "during_outcome", "outcome_mechanism_withheld", "outcome_explanation_withheld", "outcome_fully_explained", "no_outcome"] as const;
export interface RetentionEvent { t: number; line: number; kind: string; mechanism?: string; question?: string; magnitude?: number; newInfo?: boolean }
export interface RetentionDNA {
  version: 1; analyzedAt: string; durationSec: number; lines: number;
  opening: { type: string; entry: string; firstQuestionT: number | null; firstNumberT: number | null; firstNamedT: number | null };
  events: RetentionEvent[];
}

// Caption segments merged into ~20-word lines, each keeping the second it starts at.
export async function getTimedLines(videoId: string): Promise<TimedLine[]> {
  let segs: { text: string; offset: number }[] = [];
  for (const opts of [{ lang: "en" }, undefined] as any[]) {
    try { segs = (await YoutubeTranscript.fetchTranscript(videoId, opts)).map((s: any) => ({ text: String(s.text || ""), offset: Number(s.offset) || 0 })); if (segs.length) break; } catch { /* next */ }
  }
  if (!segs.length && process.env.SUPADATA_API_KEY) {
    try {
      const r = await fetch(`https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=en`, { headers: { "x-api-key": process.env.SUPADATA_API_KEY }, signal: AbortSignal.timeout(20000) });
      if (r.ok) { const d: any = await r.json(); segs = (Array.isArray(d?.content) ? d.content : []).map((s: any) => ({ text: String(s.text || ""), offset: Number(s.offset) || 0 })); }
    } catch { /* none */ }
  }
  // youtube-transcript reports milliseconds for most tracks, seconds for some: normalize by the last offset.
  const last = segs.length ? segs[segs.length - 1].offset : 0;
  const toSec = (o: number) => (last > 20000 ? o / 1000 : o);
  const lines: TimedLine[] = [];
  let buf = "", start = 0;
  for (const s of segs) {
    const txt = s.text.replace(/\s+/g, " ").replace(/&amp;#39;|&#39;/g, "'").replace(/&amp;/g, "&").trim();
    if (!txt) continue;
    if (!buf) start = toSec(s.offset);
    buf = buf ? `${buf} ${txt}` : txt;
    if (buf.split(" ").length >= 20) { lines.push({ i: lines.length, t: Math.round(start), text: buf }); buf = ""; }
  }
  if (buf) lines.push({ i: lines.length, t: Math.round(start), text: buf });
  return lines;
}

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export async function analyzeRetention(input: { title: string; lines: TimedLine[]; durationSec?: number; model?: string }): Promise<RetentionDNA | null> {
  const lines = input.lines.slice(0, 900);
  if (lines.length < 20) return null;
  const durationSec = input.durationSec || (lines[lines.length - 1].t + 10);
  const numbered = lines.map((l) => `[L${l.i} ${mmss(l.t)}] ${l.text}`).join("\n");
  const msg = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "", timeout: 180_000, maxRetries: 1 }).messages.create({
    model: input.model || "claude-haiku-4-5-20251001", max_tokens: 12000, temperature: 0,
    messages: [{ role: "user", content: `You are mapping the INFORMATION FLOW of a YouTube video, "${String(input.title).slice(0, 150)}", from its timed transcript (each line is [L<number> <time>]). Label the lines where these moments happen. Use ONLY line numbers from the transcript.

EVENT KINDS:
- question_open: the narration creates a question the viewer now wants answered (explicit or implied). Give it a short id in "question".
- question_close: a previously opened question gets answered. Use the SAME "question" id.
- rehook: attention is deliberately renewed (a tease, a new stakes line, "but that's not the strangest part"). Give "mechanism": one of ${REHOOK_MECHANISMS.join(", ")}.
- mini_reveal: a smaller payoff or discovery before the main one. "magnitude" 1-3.
- major_reveal: the central payoff, the biggest discovery or answer. "magnitude" 4.
- turn: the story or argument changes direction.
- evidence: a concrete document, number, quote, or primary-source detail is introduced.
- escalation: the stakes or scale rise.
- new_entity: an important new person, organization, or place enters.
- context: background or explanation with no new development.
- repetition: restates something already established with nothing new.
- sponsor: an ad read (give the line where it starts and the line where it ends, both as sponsor).
For every event also give "newInfo": true if the line adds genuinely new information.
Mark the meaningful moments, not every line: typically 30-80 events for a 10-20 minute video.

OPENING: classify how the video opens, relative to the story's main outcome:
"type": one of ${OPENING_TYPES.join(", ")}; "entry": one of scene, claim, question, surprising_fact, contradiction, outcome, anecdote, quote, problem, explanation; and the line numbers of the first question, the first specific number, and the first named person or entity (null if none in the first 3 minutes).

TRANSCRIPT:
${numbered}

Output ONLY JSON: {"opening":{"type":"...","entry":"...","firstQuestionLine":3,"firstNumberLine":5,"firstNamedLine":1},"events":[{"line":3,"kind":"question_open","question":"q1","newInfo":true}]}` }],
  });
  const text = msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
  let j: any = null;
  try { j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); }
  catch { // salvage a cut-off reply: keep every complete event
    const body = text.slice(text.indexOf("{"));
    const cut = body.lastIndexOf("},");
    try { j = cut > 0 ? JSON.parse(body.slice(0, cut + 1) + "]}") : null; } catch { j = null; }
  }
  if (!j) return null;
  const tOf = (l: any) => { const n = Number(l); return Number.isInteger(n) && lines[n] ? lines[n].t : null; };
  const events: RetentionEvent[] = (Array.isArray(j.events) ? j.events : [])
    .filter((e: any) => EVENT_KINDS.includes(e?.kind) && tOf(e.line) !== null)
    .map((e: any) => ({ t: tOf(e.line)!, line: Number(e.line), kind: e.kind,
      ...(e.mechanism && REHOOK_MECHANISMS.includes(e.mechanism) ? { mechanism: e.mechanism } : {}),
      ...(e.question ? { question: String(e.question).slice(0, 20) } : {}),
      ...(Number.isFinite(Number(e.magnitude)) ? { magnitude: Number(e.magnitude) } : {}),
      newInfo: !!e.newInfo }))
    .sort((a: RetentionEvent, b: RetentionEvent) => a.t - b.t);
  const o = j.opening || {};
  return {
    version: 1, analyzedAt: new Date().toISOString(), durationSec, lines: lines.length,
    opening: { type: OPENING_TYPES.includes(o.type) ? o.type : "no_outcome", entry: String(o.entry || "").slice(0, 30),
      firstQuestionT: tOf(o.firstQuestionLine), firstNumberT: tOf(o.firstNumberLine), firstNamedT: tOf(o.firstNamedLine) },
    events,
  };
}
