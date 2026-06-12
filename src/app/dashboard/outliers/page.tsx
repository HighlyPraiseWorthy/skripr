"use client";
import { useState } from "react";

const C = {
  bg: "#080c12", card: "#0d1520", cardHover: "#111d2e",
  border: "rgba(77,184,255,0.12)", borderAccent: "rgba(77,184,255,0.30)",
  accent: "#1a8fd1", accentDim: "#4db8ff", textBright: "#e8edf5",
  textDim: "#7a9bb5", green: "#34d399",
};

type OutlierVideo = {
  videoId: string; title: string; thumbnail: string; publishedAt: string;
  views: number; durationSec: number; outlierX: number;
};
type ScanResult = {
  channel: { title: string; thumbnail: string; subscribers: number };
  medianViews: number;
  videos: OutlierVideo[];
};

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(n);

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 31) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

const outlierColor = (x: number) =>
  x >= 5 ? "#f87171" : x >= 2 ? "#fb923c" : x >= 1 ? C.green : C.textDim;

export default function OutliersPage() {
  const [channel, setChannel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function handleScan() {
    if (!channel.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/channel-outliers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>🎯</span>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, margin: 0 }}>Outlier Finder</h1>
          </div>
          <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>
            Scan any channel for videos massively outperforming its baseline — then remix the winners.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <input
            value={channel}
            onChange={e => setChannel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleScan()}
            placeholder="Channel URL or @handle (e.g. @kurzgesagt)"
            style={{ flex: 1, height: 48, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.textBright, padding: "0 16px", fontSize: 14, outline: "none" }}
          />
          <button
            onClick={handleScan}
            disabled={loading || !channel.trim()}
            style={{ height: 48, padding: "0 26px", borderRadius: 12, border: "none", cursor: loading ? "wait" : "pointer", fontSize: 14, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", opacity: loading || !channel.trim() ? 0.6 : 1, boxShadow: "0 4px 16px rgba(77,184,255,0.25)" }}
          >
            {loading ? "Scanning..." : "Scan Channel"}
          </button>
        </div>

        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "50px 0", color: C.textDim, fontSize: 13 }}>
            Pulling the channel's recent uploads and computing the baseline...
          </div>
        )}

        {result && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px", marginBottom: 16 }}>
              {result.channel.thumbnail && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={result.channel.thumbnail} alt="" style={{ width: 44, height: 44, borderRadius: "50%" }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright }}>{result.channel.title}</div>
                <div style={{ fontSize: 12, color: C.textDim }}>
                  {fmt(result.channel.subscribers)} subscribers · channel baseline {fmt(result.medianViews)} views per long-form video
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.textDim, textAlign: "right" }}>
                {result.videos.filter(v => v.outlierX >= 2).length} outliers<br />found
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.videos.map(v => (
                <div key={v.videoId} style={{ display: "flex", gap: 14, alignItems: "center", background: C.card, border: `1px solid ${v.outlierX >= 2 ? "rgba(251,146,60,0.35)" : C.border}`, borderRadius: 14, padding: "12px 14px" }}>
                  {v.thumbnail && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={v.thumbnail} alt="" style={{ width: 120, height: 68, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.textBright, lineHeight: 1.35, marginBottom: 5 }}>{v.title}</div>
                    <div style={{ fontSize: 12, color: C.textDim }}>
                      {fmt(v.views)} views · {Math.round(v.durationSec / 60)} min · {ago(v.publishedAt)}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "center", minWidth: 64 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: outlierColor(v.outlierX) }}>{v.outlierX}x</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: 0.5 }}>VS BASELINE</div>
                  </div>
                  <a
                    href={`/dashboard/viral-remixer?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${v.videoId}`)}`}
                    style={{ flexShrink: 0, padding: "10px 16px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: "#fff", textDecoration: "none", background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", boxShadow: "0 2px 10px rgba(77,184,255,0.25)" }}
                  >
                    Remix This →
                  </a>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
