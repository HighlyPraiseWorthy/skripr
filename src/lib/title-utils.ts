// Hard guarantee backing the EXPERT_ATTRIBUTION_RULE prompt instruction: even if
// the model slips, we never SHOW a generated title that carries the SOURCE
// video's named expert onto a different topic. We strip only the exact source
// expert — an intentional swap to a different, fitting expert is left alone.

// Words that can trail a title after a dash but are NOT a person (so we don't
// mistake "- Full Breakdown" for an expert and start stripping legit clauses).
const FORMAT_WORDS = /\b(breakdown|explained|explainer|guide|documentary|story|edition|full|part|review|reaction|tutorial|analysis|deep dive|the truth|exposed)\b/i;

// Pull a trailing "- First Last" person name off the source title, if present.
// Conservative: 2–4 capitalized tokens, not a format phrase. Returns null when
// the trailing segment doesn't look like a real person's name.
export function extractTrailingExpert(title: string | null | undefined): string | null {
  if (!title) return null;
  const m = title.match(/[-–—]\s*([A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){1,3})\s*$/);
  if (!m) return null;
  const cand = m[1].trim();
  if (FORMAT_WORDS.test(cand)) return null;
  const words = cand.split(/\s+/);
  if (words.length < 2 || words.length > 4) return null;
  return cand;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Remove a trailing "- <sourceExpert>" (any dash variant) from a generated
// title. No-op when there's no source expert or the title doesn't carry it.
export function stripCarriedExpert(title: string, sourceExpert: string | null): string {
  if (!title || !sourceExpert) return title;
  return title
    .replace(new RegExp(`\\s*[-–—]\\s*${escapeRegex(sourceExpert)}\\s*$`, "i"), "")
    .trim();
}
