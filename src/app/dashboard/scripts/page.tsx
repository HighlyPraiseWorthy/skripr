import { auth } from "@clerk/nextjs/server";
import { checkScriptLimit } from "@/lib/usage";
import { supabaseAdmin } from "@/lib/db/supabase";
import Link from "next/link";
import type { Script } from "@/lib/types/script";
import { EmptyStateGuide } from "@/components/EmptyStateGuide";
import { ScriptList } from "@/components/ScriptList";

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

function getResetDate(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

  const usageData = await checkScriptLimit(userId).catch(() => ({ used: 0, limit: 2, plan: "free", allowed: true }));
  const usageUsed = usageData.used;
  const usageLimit = usageData.limit;
  const usagePlan = usageData.plan;
  const usagePct = usageLimit === Infinity ? 0 : Math.min(100, Math.round((usageUsed / usageLimit) * 100));
  const usageColor = usagePct >= 100 ? "#f87171" : usagePct >= 80 ? "#f59e0b" : "#818cf8";

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

        {/* ─── Usage Bar ─── */}
        {usageLimit !== Infinity && (
          <div style={{ marginBottom: 24, borderRadius: 14, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)", padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>Scripts this month</span>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(99,102,241,0.12)", color: C.badgeText, textTransform: "uppercase" as const, fontWeight: 700 }}>{usagePlan}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: usageColor }}>{usageUsed} / {usageLimit}</span>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Resets {getResetDate()}</div>
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 6, background: "rgba(99,102,241,0.12)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${usagePct}%`, borderRadius: 6, background: usageColor, transition: "width 0.4s ease" }} />
            </div>
            {usagePct >= 100 && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#f87171" }}>Monthly limit reached</span>
                <a href="/dashboard/settings" style={{ fontSize: 12, fontWeight: 600, color: "#818cf8", textDecoration: "none" }}>Upgrade →</a>
              </div>
            )}
            {usagePct >= 80 && usagePct < 100 && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 12, color: "#f59e0b" }}>{usageLimit - usageUsed} script{usageLimit - usageUsed !== 1 ? "s" : ""} left this month</span>
              </div>
            )}
          </div>
        )}

        {scriptsError && (
          <div style={{ borderRadius: 14, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", padding: "14px 18px", marginBottom: 20 }}>
            <p style={{ color: C.danger, fontSize: 13 }}>Error loading scripts: {scriptsError}</p>
          </div>
        )}

        {scripts.length === 0 ? (
          <EmptyStateGuide />
        ) : (
          <ScriptList scripts={scripts} />
        )}
      </div>
    </div>
  );
}
