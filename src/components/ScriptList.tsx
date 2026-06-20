"use client";
import Link from "next/link";
import { useState, useMemo } from "react";
import type { Script } from "@/lib/types/script";
import { NICHES } from "@/lib/data/niches";

// Saved niches are freeform text; the tool pages' niche <select> uses canonical
// NICHES ids — resolve so the prefilled niche actually preselects.
function resolveNicheId(raw?: string | null): string {
  if (!raw) return "";
  const s = raw.toLowerCase().trim();
  const exact = NICHES.find(n => n.id === s || n.name.toLowerCase() === s);
  if (exact) return exact.id;
  const partial = NICHES.find(n => s.includes(n.id) || s.includes(n.name.toLowerCase()) || n.name.toLowerCase().includes(s));
  return partial ? partial.id : "";
}

// Hand the script off to Metadata / Compliance with its fields prefilled.
function sendToTool(path: string, script: Script) {
  try {
    sessionStorage.setItem("skripr_prefill", JSON.stringify({
      title: script.title || "",
      script: (script as any).content || "",
      niche: resolveNicheId(script.niche),
    }));
  } catch {}
  window.location.href = path;
}

const C = {
  cardBg: "#0d1520",
  border: "rgba(77,184,255,0.11)",
  accent: "#4db8ff",
  textDim: "#7a9bb5",
  textBright: "#e8edf5",
  badgeBg: "rgba(77,184,255,0.11)",
  badgeText: "#7ed8ff",
  inputBg: "#0a1220",
};

// Niche is freeform — sometimes a clean canonical niche, sometimes a long
// audience sentence. Show the canonical name when it resolves, otherwise clamp
// so a stray sentence can't blow up the card.
function nicheLabel(raw?: string | null): string {
  if (!raw) return "";
  const id = resolveNicheId(raw);
  if (id) return NICHES.find(n => n.id === id)?.name || raw;
  const t = raw.trim();
  return t.length > 26 ? t.slice(0, 26).trimEnd() + "…" : t;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "just now";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff)) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ScriptList({ scripts, isPaid = false }: { scripts: Script[]; isPaid?: boolean }) {
  const [search, setSearch] = useState("");
  const [filterNiche, setFilterNiche] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "words">("newest");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [scriptList, setScriptList] = useState(scripts);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/scripts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setScriptList(prev => prev.filter(s => s.id !== id));
      }
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }

  const niches = useMemo(() => {
    const set = new Set(scripts.map(s => s.niche).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [scripts]);

  const filtered = useMemo(() => {
    return scriptList
      .filter(s => {
        const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase());
        const matchNiche = filterNiche === "all" || s.niche === filterNiche;
        return matchSearch && matchNiche;
      })
      .sort((a, b) => {
        if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return (b.word_count || 0) - (a.word_count || 0);
      });
  }, [scriptList, search, filterNiche, sortBy]);

  const inputStyle = {
    background: C.inputBg,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    color: C.textBright,
    fontSize: 15,
    padding: "8px 12px",
    outline: "none",
  } as const;

  return (
    <div>
      {/* ── Search + Filter row ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search scripts…"
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
        {niches.length > 0 && (
          <select
            value={filterNiche}
            onChange={e => setFilterNiche(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="all">All niches</option>
            {niches.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="words">Most words</option>
        </select>
      </div>

      {/* ── Results count ── */}
      {(search || filterNiche !== "all") && (
        <p style={{ fontSize: 14, color: C.textDim, marginBottom: 12 }}>
          {filtered.length} of {scriptList.length} scripts
          {search && <span> matching "{search}"</span>}
          {filterNiche !== "all" && <span> in {filterNiche}</span>}
          <button
            onClick={() => { setSearch(""); setFilterNiche("all"); }}
            style={{ marginLeft: 8, fontSize: 13, color: C.accent, background: "none", border: "none", cursor: "pointer" }}
          >
            Clear ✕
          </button>
        </p>
      )}

      {/* ── Empty search state ── */}
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 24px", borderRadius: 14, background: C.cardBg, border: `1px solid ${C.border}` }}>
          <p style={{ color: C.textDim, fontSize: 16, margin: 0 }}>No scripts match your search.</p>
        </div>
      )}

      {/* ── Script cards ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(script => (
          <div key={script.id} style={{ borderRadius: 16, backgroundColor: C.cardBg, border: `1px solid ${C.border}`, padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "#e8edf5", marginBottom: 8, letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {script.title}
                </h3>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  {script.niche && (
                    <span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "3px 10px", borderRadius: 8, backgroundColor: C.badgeBg, color: C.badgeText, fontSize: 13, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>
                      {nicheLabel(script.niche)}
                    </span>
                  )}
                  <span style={{ color: "#8abadc", fontSize: 15 }}>{(script.word_count || 0).toLocaleString()} words</span>
                  <span style={{ color: "#8abadc", fontSize: 15 }}>~{Math.round((script.estimated_duration || 0) / 60) || 1} min</span>
                  {script.created_at && <span style={{ color: "#8abadc", fontSize: 15 }}>{timeAgo(script.created_at)}</span>}
                  {script.voice_name && (
                    <span title="Voice Match used for this script" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 8, background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.3)", color: "#c4b5fd", fontSize: 13, fontWeight: 600 }}>
                      🎙 {script.voice_name}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                {isPaid && (
                  <>
                    <button
                      onClick={() => sendToTool("/dashboard/metadata", script)}
                      title="Generate metadata for this script"
                      style={{ padding: "7px 13px", borderRadius: 10, backgroundColor: "rgba(77,184,255,0.07)", color: C.accent, fontSize: 14, fontWeight: 500, border: "1px solid rgba(77,184,255,0.16)", cursor: "pointer" }}
                    >
                      🏷 Metadata
                    </button>
                    <button
                      onClick={() => sendToTool("/dashboard/compliance", script)}
                      title="Check this script for demonetization risk"
                      style={{ padding: "7px 13px", borderRadius: 10, backgroundColor: "rgba(77,184,255,0.07)", color: C.accent, fontSize: 14, fontWeight: 500, border: "1px solid rgba(77,184,255,0.16)", cursor: "pointer" }}
                    >
                      🛡 Compliance
                    </button>
                  </>
                )}
                <Link
                  href={`/dashboard/scripts/${script.id}`}
                  style={{ padding: "7px 16px", borderRadius: 10, backgroundColor: "rgba(77,184,255,0.09)", color: C.accent, fontSize: 15, fontWeight: 500, textDecoration: "none", border: "1px solid rgba(77,184,255,0.16)" }}
                >
                  View
                </Link>
                {confirmDelete === script.id ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#f87171" }}>Delete?</span>
                    <button
                      onClick={() => handleDelete(script.id)}
                      disabled={deleting === script.id}
                      style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "#dc2626", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
                    >
                      {deleting === script.id ? "…" : "Yes"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={{ fontSize: 13, color: C.textDim, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(script.id)}
                    style={{ fontSize: 13, color: "#7a9bb5", background: "none", border: "1px solid rgba(248,113,113,0.20)", borderRadius: 6, padding: "4px 9px", cursor: "pointer" }}
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
