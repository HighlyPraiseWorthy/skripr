import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db/supabase";
import Link from "next/link";
import type { Script } from "@/lib/types/script";
import { ScriptEditor } from "@/components/ScriptEditor";

const C = {
  bg: "#0b0b17",
  cardBg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  accent: "#818cf8",
  text: "#e2e8f0",
  textDim: "#64748b",
  textBright: "#f1f5f9",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ScriptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) {
    return (
      <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ borderRadius: 20, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", padding: 20 }}>
            <p style={{ color: "#f87171", fontSize: 14 }}>Not authenticated</p>
          </div>
        </div>
      </div>
    );
  }

  let script: Script | null = null;
  let error: string | null = null;

  try {
    const { data, error: fetchErr } = await supabaseAdmin!
      .from("scripts")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (fetchErr) throw fetchErr;
    script = data as Script;
  } catch (e: any) {
    error = e.message;
  }

  if (!script) {
    return (
      <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ borderRadius: 20, background: C.cardBg, border: `1px solid ${C.border}`, padding: 40, textAlign: "center" }}>
            <p style={{ color: C.textDim, fontSize: 15, marginBottom: 20 }}>
              {error ? `Error: ${error}` : "Script not found or you don't have access."}
            </p>
            <Link href="/dashboard/scripts" style={{ color: "#fff", fontSize: 14, fontWeight: 600, padding: "10px 24px", borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)", textDecoration: "none", boxShadow: "0 0 22px rgba(99,102,241,0.30)", display: "inline-block" }}>
              ← Back to Scripts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "fixed", bottom: -180, left: -120, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.09) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 920, margin: "0 auto" }}>
        <Link href="/dashboard/scripts" style={{ color: C.accent, fontSize: 13, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}>
          <span style={{ fontSize: 14 }}>←</span> Back to Scripts
        </Link>

        {/* ── Metadata card ── */}
        <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "24px 28px", marginBottom: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {script.niche && (
              <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.12)", color: "#a5b4fc", letterSpacing: 0.3, textTransform: "uppercase" }}>
                {script.niche}
              </span>
            )}
            <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.08)", color: C.textDim }}>
              {(script.word_count || 0).toLocaleString()} words
            </span>
            <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.08)", color: C.textDim }}>
              ~{Math.round((script.estimated_duration || 0) / 60)} min
            </span>
            <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.08)", color: C.textDim }}>
              Created {formatDate(script.created_at)}
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.textBright, letterSpacing: -0.3, marginBottom: 4 }}>{script.title}</h1>
          {script.topic && <p style={{ color: C.textDim, fontSize: 14, marginBottom: script.niche ? 2 : 0 }}>Topic: {script.topic}</p>}
          {script.niche && <p style={{ color: "#a5b4fc", fontSize: 13, fontWeight: 500 }}>✦ Niche Bend: {script.niche}</p>}
        </div>

        {/* ── Script editor card ── */}
        <div style={{ borderRadius: 18, background: C.cardBg, border: `1px solid ${C.border}`, padding: "22px 28px" }}>
          <ScriptEditor
            scriptId={script.id}
            initialContent={script.content || ""}
            initialVersions={(script.versions as any) || []}
            title={script.title}
          />
        </div>
      </div>
    </div>
  );
}
