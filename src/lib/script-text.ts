// The model usually opens fullScript with the hook verbatim, modulo whitespace and
// smart-quote differences — so naive hook+body concatenation duplicates the opening
// paragraph. Compare normalized text before joining.
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

export function bodyStartsWithHook(body: string, hook: string): boolean {
  if (!body || !hook) return false;
  return norm(body).startsWith(norm(hook));
}

export function joinHookBody(hook: string, body: string): string {
  if (!hook) return body || "";
  if (!body) return hook;
  return bodyStartsWithHook(body, hook) ? body : [hook, body].join("\n\n");
}

// HOUSE RULE: the em dash (—) is banned from every piece of user-facing text Skripr generates.
// Replace it with a comma + space and tidy the punctuation/spacing that can produce. IMPORTANT:
// only the EM dash (U+2014) and horizontal bar (U+2015) are touched — the EN dash (U+2013) is left
// alone so numeric ranges stay correct ("1982–84", "$20,000–$35,000", "1.5–2.1%"). Use this on any
// model output before it reaches the UI (scripts, hooks, titles, angle premises, explanations,
// warnings). Safe to call on any value; non-strings pass through unchanged.
export function stripEmDashes<T>(s: T): T {
  if (typeof s !== "string") return s;
  const out = (s as string)
    .replace(/\s*[—―]\s*/g, ", ")       // word — word  ->  word, word
    .replace(/\s+,/g, ",")                 // stray space before a comma
    .replace(/,\s*,/g, ", ")               // doubled comma
    .replace(/,\s*([.!?;:])/g, "$1")       // comma butting other punctuation
    .replace(/ {2,}/g, " ");
  return out as unknown as T;
}
