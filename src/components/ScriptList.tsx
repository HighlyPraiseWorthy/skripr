"use client";
import Link from "next/link";
import { useState, useMemo } from "react";
import type { Script } from "@/lib/types/script";

const C = {
  cardBg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  accent: "#818cf8",
  textDim: "#64748b",
  textBright: "#f1f5f9",
  badgeBg: "rgba(99,102,241,0.12)",
  badgeText: "#a5b4fc",
  inputBg: "#1a1a3a",
};

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

export function ScriptList({ scripts }: { scripts: Script[] }) {
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
    fontSize: 13,
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
        <p style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>
          {filtered.length} of {scriptList.length} scripts
          {search && <span> matching "{search}"</span>}
          {filterNiche !== "all" && <span> in {filterNiche}</span>}
          <button
            onClick={() => { setSearch(""); setFilterNiche("all"); }}
            style={{ marginLeft: 8, fontSize: 11, color: C.accent, background: "none", border: "none", cursor: "pointer" }}
          >
            Clear ✕
          </button>
        </p>
      )}

      {/* ── Empty search state ── */}
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 24px", borderRadius: 14, background: C.cardBg, border: `1px solid ${C.border}` }}>
          <p style={{ color: C.textDim, fontSize: 14, margin: 0 }}>No scripts match your search.</p>
        </div>
      )}

      {/* ── Script cards ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(script => (
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
                  <span style={{ color: C.textDim, fontSize: 13 }}>~{Math.round((script.estimated_duration || 0) / 60) || 1} min</span>
                  {script.created_at && <span style={{ color: C.textDim, fontSize: 13 }}>{timeAgo(script.created_at)}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                <Link
                  href={`/dashboard/scripts/${script.id}`}
                  style={{ padding: "7px 16px", borderRadius: 10, backgroundColor: "rgba(99,102,241,0.10)", color: C.accent, fontSize: 13, fontWeight: 500, textDecoration: "none", border: "1px solid rgba(99,102,241,0.18)" }}
                >
                  View
                </Link>
                {confirmDelete === script.id ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#f87171" }}>Delete?</span>
                    <button
                      onClick={() => handleDelete(script.id)}
                      disabled={deleting === script.id}
                      style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#dc2626", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
                    >
                      {deleting === script.id ? "…" : "Yes"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={{ fontSize: 11, color: C.textDim, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(script.id)}
                    style={{ fontSize: 11, color: "#64748b", background: "none", border: "1px solid rgba(248,113,113,0.20)", borderRadius: 6, padding: "4px 9px", cursor: "pointer" }}
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
