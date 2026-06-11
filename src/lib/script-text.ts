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
