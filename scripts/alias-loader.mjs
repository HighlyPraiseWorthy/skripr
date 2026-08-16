// Minimal resolve hook so the offline test scripts can import modules that use the
// project's "@/..." path alias (which tsconfig resolves but plain node does not).
// Maps "@/lib/foo" -> "<cwd>/src/lib/foo.ts". Only "@/" is rewritten; real scoped
// packages like "@anthropic-ai/sdk" and "@supabase/supabase-js" pass through untouched.
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = resolvePath(process.cwd(), "src", specifier.slice(2) + ".ts");
    return { url: pathToFileURL(abs).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
