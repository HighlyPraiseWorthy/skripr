// NO-CTA GUARANTEE (2026-10-11). When a creator turns the CTA off, the prompts already say "WRITE NO CTA" and the
// self-review pass cuts asks, but (1) the voice text injected into every writer still carried the creator's CTA
// habits (the prose "CTA style" section and the structured "calls to action go in the middle" rule), and the section
// writer never received the no-CTA setting at all; (2) the only removal was a model pass. These two helpers close
// both gaps: strip CTA guidance from the voice when CTA is off, and a deterministic final sweep of viewer asks.

// Remove the creator's CTA guidance from a voice profile (prose "CTA style" section + structured CTA rule).
export function withoutCtaGuidance(voice: string): string {
  if (!voice) return voice;
  const lines = voice.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const t = line.trim();
    // Start of a CTA section/line: "- CTA style: ...", "CTA style:", "- Calls to action go in the ...".
    if (/^[-*•]?\s*(cta style|calls? to action)\b/i.test(t)) { skipping = true; continue; }
    // A CTA section ends at the next bullet/heading or blank line.
    if (skipping && (t === "" || /^[-*•]\s|^[A-Z][A-Z \-/&]{3,}:|^[A-Z][a-z]+( [a-z]+){0,3}:/.test(t))) skipping = false;
    if (!skipping) out.push(line);
  }
  return `${out.join("\n").trim()}\n\nNO CTA FOR THIS SCRIPT: the creator turned the call to action off. Ignore any subscribe/like/comment/next-video habits of this voice; the script ends on its final narrative line.`;
}

// Sentences that ask the VIEWER to act on the channel (subscribe, like, comment, notifications, another video, the
// description). Story sentences about subscriptions or comments ("Smith paid for subscriptions", "fans subscribed to
// the newsletter", "the judge declined to comment") are not matched: an ask needs a viewer-directed form.
const ASKS: RegExp[] = [
  /\b(?:hit|smash|tap|click|press)\s+(?:that|the)\s+(?:like|subscribe|bell)\b/i,
  /\blike\s+and\s+subscribe\b|\bsubscribe\s+(?:to|for)\s+(?:the|this|my|our)\s+channel\b/i,
  /\b(?:ring|turn on|hit)\s+(?:the|that)?\s*(?:notification|bell)/i,
  /(?:^|[.!?]\s*|\b(?:so|and|please|now|if you[^.!?]{0,60}),?\s+)(?:subscribe|consider subscribing|make sure (?:to|you) subscribe|don'?t forget to (?:subscribe|like|comment))\b/i,
  /\b(?:let me know|tell me|drop (?:a|your) (?:comment|thoughts)|leave (?:a|your) comment|comment below|sound off)\b[^.!?]{0,80}\b(?:comments?|below)\b/i,
  /\bin the comments(?: below)?\b/i,
  /\b(?:check out|watch|click on)\s+(?:my|our|this|that|the)\s+(?:other\s+|next\s+|related\s+)?video\b|\blink(?:ed)?\s+in the description\b|\bthere'?s more where (?:this|that) came from\b|\bsee you in the next (?:one|video)\b/i,
];
export function isCtaAsk(sentence: string): boolean { return ASKS.some((r) => r.test(sentence)); }

export function stripCtaAsks(text: string): { text: string; cut: string[] } {
  const cut: string[] = [];
  const out = (text || "").split(/\n\n+/).map((p) => (p.match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) || [p])
    .filter((s) => { if (isCtaAsk(s)) { cut.push(s.trim()); return false; } return true; }).join("").trim())
    .filter(Boolean).join("\n\n");
  return { text: out, cut };
}
