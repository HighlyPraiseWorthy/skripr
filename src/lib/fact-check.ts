// Deterministic post-generation fact scan.
//
// The closed-world prompt rule tells the script to state no specific that is not
// in the provided source material, but a prompt rule leaks: the model reliably
// recalls named entities yet confabulates precise DATES and DOLLAR FIGURES (it
// wrote "March 6, 1980" for an escape the same script then dates to "nineteen
// months" before an August 1981 recapture, which only works from January). A
// prompt cannot guarantee this away, so we catch it mechanically: pull every
// date and money figure out of the finished script and flag any that does not
// appear in the source material the script was allowed to use.
//
// Scope is deliberately limited to what regex detects with near-zero false
// positives. Named people are NOT scanned here: reliable name detection needs
// the facts to spell every name, which they do not, so it would flag the
// protagonist on every line. Dates and money are the highest-value, lowest-noise
// catch, and they are exactly the category the model gets wrong.

export interface FactCheckResult {
  unverified: string[]; // human-readable specifics not found in the source material
}

// Normalize for containment checks: lowercase, collapse whitespace, strip commas
// inside numbers so "76,000" matches "76000", and unify the various dashes.
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS = "(?:january|february|march|april|may|june|july|august|september|october|november|december)";

// Pull candidate specifics out of a piece of prose.
function extractSpecifics(text: string): string[] {
  const out = new Set<string>();
  const push = (v?: string | null) => { if (v && v.trim()) out.add(v.trim()); };

  // Full dates: "January 21, 1980" / "21 January 1980" / "January 1980"
  for (const m of text.matchAll(new RegExp(`${MONTHS}\\s+\\d{1,2},?\\s+\\d{4}`, "gi"))) push(m[0]);
  for (const m of text.matchAll(new RegExp(`\\d{1,2}\\s+${MONTHS}\\s+\\d{4}`, "gi"))) push(m[0]);
  for (const m of text.matchAll(new RegExp(`${MONTHS}\\s+\\d{4}`, "gi"))) push(m[0]);

  // Dollar figures: "$70,000", "$4.3 billion", "$15,000". Commas only between
  // digits, so a trailing "$70,000, with..." does not swallow the comma.
  for (const m of text.matchAll(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:billion|million|thousand|k)?\b/gi)) push(m[0].trim());

  return [...out];
}

/**
 * Flag dates and dollar figures in the script that are not present in the source
 * material. When there is NO source material, the script is running ungrounded
 * (an explainer with no research, say), so there is nothing to check against and
 * we return nothing rather than flagging every number.
 */
export function factCheckAgainstSource(scriptText: string, sourceMaterial?: string): FactCheckResult {
  if (!sourceMaterial || !sourceMaterial.trim()) return { unverified: [] };
  const haystack = norm(sourceMaterial);
  const seen = new Set<string>();
  const unverified: string[] = [];

  for (const raw of extractSpecifics(scriptText || "")) {
    const key = norm(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    // A year alone is weak evidence, so for a bare "Month YYYY" or "$N" also
    // accept the source containing just the number, which covers reworded facts.
    const bareNumber = key.replace(/[^0-9]/g, "");
    if (haystack.includes(key)) continue;
    if (bareNumber.length >= 4 && haystack.includes(bareNumber)) continue;
    unverified.push(raw);
  }
  return { unverified };
}
