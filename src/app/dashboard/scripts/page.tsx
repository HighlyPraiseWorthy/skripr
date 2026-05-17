import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db/supabase";
import Link from "next/link";
import type { Script } from "@/lib/types/script";

const C = {
  bg: "#0b0b17",
  cardBg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  accent: "#818cf8",
  text: "#e2e8f0",
  textDim: "#64748b",
  textBright: "#f1f5f9",
  danger: "#f87171",
  badgeBg: "rgba(99,102,241,0.12)",
  badgeText: "#a5b4fc",
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return "just now";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diffMs)) return "just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function ScriptsPage() {
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

  let scripts: Script[] = [];
  let scriptsError: string | null = null;

  try {
    const { data, error } = await supabaseAdmin!
      .from("scripts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    scripts = data || [];
  } catch (e: any) {
    scriptsError = e.message;
  }

  return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      <div aria-hidden style={{ position: "fixed", top: -180, right: -120, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.15) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "fixed", bottom: -200, left: -140, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,0.10) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textBright, letterSpacing: -0.4 }}>My Scripts</h1>
          <Link href="/dashboard/scripts/new" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, background: "linear-gradient(135deg,#6366f1 0%,#7c3aed 50%,#a855f7 100%)", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none", boxShadow: "0 0 22px rgba(99,102,241,0.30)" }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>New Script
          </Link>
        </div>

        {scriptsError && (
          <div style={{ borderRadius: 14, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", padding: "14px 18px", marginBottom: 20 }}>
            <p style={{ color: C.danger, fontSize: 13 }}>Error loading scripts: {scriptsError}</p>
          </div>
        )}

        {scripts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "72px 24px", borderRadius: 24, background: C.cardBg, border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
            <div aria-hidden style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "60%", height: 2, background: "linear-gradient(90deg,transparent,#6366f1,transparent)", borderRadius: 2 }} />
            <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 18, filter: "drop-shadow(0 0 16px rgba(99,102,241,0.40)) drop-shadow(0 0 32px rgba(99,102,241,0.18))" }}>✦</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: C.textBright, marginBottom: 8, letterSpacing: -0.3 }}>No scripts yet</h2>
            <p style={{ color: C.textDim, fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>Generate your first viral script to get started</p>
            <Link href="/dashboard/scripts/new" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 14, background: "linear-gradient(135deg,#6366f1 0%,#7c3aed 50%,#a855f7 100%)", color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none", boxShadow: "0 0 30px rgba(99,102,241,0.35)" }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>✦</span>Generate Script
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {scripts.map((script) => (
              <div key={script.id} style={{ borderRadius: 16, backgroundColor: C.cardBg, border: `1px solid ${C.border}`, padding: "20px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textBright, marginBottom: 8, letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {script.title}
                    </h3>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      {script.niche && (
                        <span style={{ padding: "3px 10px", borderRadius: 8, backgroundColor: C.badgeBg, color: C.badgeText, fontSize: 11, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>
                          {script.niche}
                        </span>
                      )}
                      <span style={{ color: C.textDim, fontSize: 13 }}>{(script.word_count || 0).toLocaleString()} words</span>
                      <span style={{ color: C.textDim, fontSize: 13 }}>~{script.estimated_duration || 5} min</span>
                      {script.created_at && <span style={{ color: C.textDim, fontSize: 13 }}>{timeAgo(script.created_at)}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <Link href={`/dashboard/scripts/${script.id}`} style={{ padding: "7px 16px", borderRadius: 10, backgroundColor: "rgba(99,102,241,0.10)", color: C.accent, fontSize: 13, fontWeight: 500, textDecoration: "none", border: "1px solid rgba(99,102,241,0.18)" }}>
                      View
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
