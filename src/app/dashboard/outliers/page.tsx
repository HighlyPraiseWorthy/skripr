"use client";
import { useState, useMemo, useEffect } from "react";

const C = {
  bg: "#080c12", card: "#0d1520", cardHover: "#111d2e",
  border: "rgba(77,184,255,0.12)", borderAccent: "rgba(77,184,255,0.30)",
  accent: "#1a8fd1", accentDim: "#4db8ff", textBright: "#e8edf5",
  textDim: "#a6c0d8", green: "#34d399",
};

type OutlierAnalysis = {
  outlierType: string[];
  whyItStandsOut: string;
  likelyDriver: string;
  titlePattern: string;
  storyPattern: string;
};
type OutlierVideo = {
  videoId: string; title: string; thumbnail: string; publishedAt: string;
  views: number; durationSec: number; ageDays: number; expectedViews: number; outlierX: number;
  analysis?: OutlierAnalysis;
};
type ChannelPattern = { name: string; kind: "story" | "packaging"; why: string; confidence: string; videoIds: string[] };
type ScanResult = {
  channel: { title: string; thumbnail: string; subscribers: number };
  niche?: string | null;
  medianViews: number;
  medianVpd: number;
  medianDurationMin: number;
  channelPatterns: ChannelPattern[];
  opportunity: string;
  videos: OutlierVideo[];
};

type Opportunity = { title: string; patternTransferred: string; researchAngle: string; whyItFits: string };
type DnaResult = {
  dna: { topic: string; subject: string; storyStructure: string; packaging: string; curiosityMechanism: string };
  whatToBorrow: string[];
  whatNotToCopy: string[];
  opportunities: Opportunity[];
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

const outlierCountOf = (r: ScanResult) => (r.videos || []).filter(v => v.outlierX >= 2).length;

const TYPE_COLOR: Record<string, string> = {
  Topic: "#f87171", Packaging: "#a78bfa", Angle: "#4db8ff",
  Subject: "#fbbf24", Format: "#34d399", Timing: "#fb923c",
};
const CONF_COLOR: Record<string, string> = { High: "#34d399", Moderate: "#4db8ff", Low: "#a6c0d8" };

const EMERGING_MAX_AGE = 3;
const isEmerging = (v: OutlierVideo) => v.ageDays <= EMERGING_MAX_AGE && v.outlierX >= 2;

// Confidence expresses how strongly the content signals support the explanation — NOT the
// odds of virality. Outlier strength and explanation confidence are independent.
function confidenceOf(v: OutlierVideo): { label: string; color: string } {
  if (isEmerging(v)) return { label: "Early signal", color: "#fb923c" };
  if (v.outlierX >= 10) return { label: "High confidence", color: C.green };
  if (v.outlierX >= 4) return { label: "Moderate confidence", color: C.accentDim };
  return { label: "Low confidence", color: C.textDim };
}

export default function OutliersPage() {
  const [channel, setChannel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [selected, setSelected] = useState<OutlierVideo | null>(null);

  async function handleScan() {
    if (!channel.trim()) return;
    setLoading(true); setError(null); setResult(null); setShowContext(false); setSelected(null);
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

  const byId = useMemo(() => {
    const m: Record<string, OutlierVideo> = {};
    for (const v of result?.videos || []) m[v.videoId] = v;
    return m;
  }, [result]);

  const tiers = useMemo(() => {
    const emerging: OutlierVideo[] = [], breakout: OutlierVideo[] = [], strong: OutlierVideo[] = [], context: OutlierVideo[] = [];
    for (const v of result?.videos || []) {
      if (isEmerging(v)) emerging.push(v);
      else if (v.outlierX >= 10) breakout.push(v);
      else if (v.outlierX >= 2) strong.push(v);
      else context.push(v);
    }
    const byX = (a: OutlierVideo, b: OutlierVideo) => b.outlierX - a.outlierX;
    return { emerging: emerging.sort(byX), breakout: breakout.sort(byX), strong: strong.sort(byX), context: context.sort(byX) };
  }, [result]);

  const storyPatterns = (result?.channelPatterns || []).filter(p => p.kind === "story");
  const packagingPatterns = (result?.channelPatterns || []).filter(p => p.kind === "packaging");
  const outlierCount = (result?.videos || []).filter(v => v.outlierX >= 2).length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {result && selected ? (
          <OutlierDnaScreen v={selected} result={result} onBack={() => setSelected(null)} />
        ) : (
        <>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>🎯</span>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, margin: 0 }}>Outlier Finder</h1>
          </div>
          <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>
            Find the videos that broke a channel's normal performance, explain the difference, and turn the pattern into original ideas.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18, maxWidth: 620, margin: "0 auto 18px" }}>
          <input
            value={channel}
            onChange={e => setChannel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleScan()}
            placeholder="Channel URL or @handle (e.g. @fern)"
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
            Pulling uploads, computing expected views, and detecting the channel's winning patterns...
          </div>
        )}

        {result && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 18px", marginBottom: 14 }}>
              {result.channel.thumbnail && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={result.channel.thumbnail} alt="" style={{ width: 44, height: 44, borderRadius: "50%" }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright }}>{result.channel.title}</div>
                <div style={{ fontSize: 12, color: C.textDim }}>
                  {fmt(result.channel.subscribers)} subscribers · typical lifetime ~{fmt(result.medianViews)} views · typical daily pace ~{fmt(result.medianVpd)}/day · ~{result.medianDurationMin} min
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.textDim, textAlign: "right" }}>
                {result.videos.filter(v => v.outlierX >= 2).length} outliers detected
                {result.channelPatterns?.length ? <><br />{result.channelPatterns.length} patterns detected<br /><span style={{ opacity: 0.7 }}>{storyPatterns.length} Story · {packagingPatterns.length} Packaging</span></> : null}
              </div>
            </div>
            <p style={{ fontSize: 11, color: C.textDim, opacity: 0.7, margin: "-8px 0 14px", paddingLeft: 2 }}>
              Expected = a model estimate from the video's age and the channel's daily pace, so it reads lower than typical lifetime views.
            </p>

            {/* Channel-level diagnosis: story vs packaging patterns */}
            {result.channelPatterns?.length ? (
              <div style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.28)", borderRadius: 14, padding: "16px 18px", marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.green, letterSpacing: 0.4, marginBottom: 12 }}>
                  WHAT {result.channel.title.toUpperCase()}'S OUTLIERS HAVE IN COMMON
                </div>
                {storyPatterns.length > 0 && (
                  <PatternGroup label="STORY PATTERNS — what the story is about" patterns={storyPatterns} byId={byId} seedTitle={result.channel.title} seedSubs={result.channel.subscribers} niche={result.niche} totalOutliers={outlierCount} />
                )}
                {packagingPatterns.length > 0 && (
                  <PatternGroup label="PACKAGING PATTERNS — how it is presented" patterns={packagingPatterns} byId={byId} seedTitle={result.channel.title} seedSubs={result.channel.subscribers} niche={result.niche} totalOutliers={outlierCount} />
                )}
                {result.opportunity && (
                  <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: "13px 0 0", paddingTop: 12, borderTop: "1px solid rgba(52,211,153,0.18)" }}>
                    <span style={{ fontWeight: 700, color: C.green }}>Potential opportunity: </span>{result.opportunity}
                  </p>
                )}
                <p style={{ fontSize: 11, color: C.textDim, opacity: 0.75, margin: "8px 0 0", lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700 }}>Hypothesis, not formula:</span> these patterns are observed across the outliers and do not establish that any single element caused the performance. Confidence reflects how strongly the content signals support each one, not the odds of virality.
                </p>
              </div>
            ) : null}

            {tiers.emerging.length > 0 && (
              <Tier title="📈 Emerging" color="#fb923c" desc="Very fresh — a strong number here is current velocity, not a matured result">
                {tiers.emerging.map(v => <Card key={v.videoId} v={v} medianDurationMin={result.medianDurationMin} channelTitle={result.channel.title} onSelect={setSelected} emerging />)}
              </Tier>
            )}
            {tiers.breakout.length > 0 && (
              <Tier title="🔥 Breakout" color="#f87171" desc="10× or more above expected">
                {tiers.breakout.map(v => <Card key={v.videoId} v={v} medianDurationMin={result.medianDurationMin} channelTitle={result.channel.title} onSelect={setSelected} />)}
              </Tier>
            )}
            {tiers.strong.length > 0 && (
              <Tier title="🚀 Strong Outlier" color="#fb923c" desc="2× to 10× above expected">
                {tiers.strong.map(v => <Card key={v.videoId} v={v} medianDurationMin={result.medianDurationMin} channelTitle={result.channel.title} onSelect={setSelected} />)}
              </Tier>
            )}

            {tiers.context.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <button onClick={() => setShowContext(s => !s)}
                  style={{ fontSize: 12, fontWeight: 600, color: C.textDim, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>
                  {showContext ? "Hide" : "Show"} {tiers.context.length} normal / below-expected videos
                </button>
                {showContext && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    {tiers.context.map(v => (
                      <div key={v.videoId} style={{ display: "flex", gap: 12, alignItems: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px" }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.title}</div>
                        <div style={{ fontSize: 12, color: C.textDim }}>{fmt(v.views)} · {ago(v.publishedAt)}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: outlierColor(v.outlierX), minWidth: 40, textAlign: "right" }}>{v.outlierX}×</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}

type CrossSignal = { scanned: number; matched: number; channels: { title: string; matches: boolean; matchedTitle: string }[]; signal: string; verdict: string };
const SIGNAL_META: Record<string, { color: string; label: string }> = {
  repeated: { color: "#34d399", label: "🟢 Repeated across channels" },
  limited: { color: "#fbbf24", label: "🟡 Limited cross-channel signal" },
  "channel-specific": { color: "#a6c0d8", label: "⚪ Channel-specific" },
  weak: { color: "#a6c0d8", label: "⚪ Inconclusive cross-channel signal" },
  none: { color: "#a6c0d8", label: "⚪ No comparison found" },
};

function PatternGroup({ label, patterns, byId, seedTitle, seedSubs, niche, totalOutliers }: { label: string; patterns: ChannelPattern[]; byId: Record<string, OutlierVideo>; seedTitle: string; seedSubs: number; niche?: string | null; totalOutliers: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const [cross, setCross] = useState<Record<number, CrossSignal | "loading" | "error">>({});
  const [showExamples, setShowExamples] = useState<Record<number, boolean>>({});

  async function checkCross(i: number, p: ChannelPattern) {
    if (cross[i]) return;
    setCross(c => ({ ...c, [i]: "loading" }));
    try {
      const exampleTitles = p.videoIds.map(id => byId[id]?.title).filter(Boolean).slice(0, 3);
      const res = await fetch("/api/cross-channel-validate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternName: p.name, patternWhy: p.why, exampleTitles, seedChannelTitle: seedTitle, seedChannelSubs: seedSubs, niche }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCross(c => ({ ...c, [i]: data }));
    } catch {
      setCross(c => ({ ...c, [i]: "error" }));
    }
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textDim, letterSpacing: 0.5, marginBottom: 7 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {patterns.map((p, i) => (
          <div key={i}>
            <div onClick={() => setOpen(open === i ? null : i)} style={{ display: "flex", gap: 10, alignItems: "baseline", cursor: "pointer" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.textBright, minWidth: 22, textAlign: "right" }}>{p.videoIds.length}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.textBright }}>{p.name}</span>
                <span style={{ fontSize: 12.5, color: C.textDim }}> — {p.why}</span>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                  <span style={{ fontWeight: 700, color: CONF_COLOR[p.confidence] || C.textDim }}>{p.confidence} interpretation confidence</span>
                  {" · prevalence "}{p.videoIds.length}/{totalOutliers} outliers
                </div>
              </div>
              <span style={{ fontSize: 11, color: C.textDim }}>{open === i ? "▲" : "▼"}</span>
            </div>
            {open === i && (
              <div style={{ margin: "6px 0 2px 32px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
                  {p.videoIds.map(id => byId[id] && (
                    <div key={id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: C.textDim }}>
                      <span style={{ fontWeight: 700, color: outlierColor(byId[id].outlierX), minWidth: 42 }}>{byId[id].outlierX}×</span>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{byId[id].title}</span>
                    </div>
                  ))}
                </div>
                {/* Cross-channel validation: does this pattern repeat beyond this channel? */}
                {!cross[i] && (
                  <button onClick={() => checkCross(i, p)}
                    style={{ fontSize: 11.5, fontWeight: 700, color: C.accentDim, background: "rgba(77,184,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 11px", cursor: "pointer" }}>
                    Check across channels →
                  </button>
                )}
                {cross[i] === "loading" && <div style={{ fontSize: 11.5, color: C.textDim }}>Scanning comparable channels for this pattern...</div>}
                {cross[i] === "error" && <div style={{ fontSize: 11.5, color: "#fca5a5" }}>Couldn't validate across channels. Try again.</div>}
                {cross[i] && typeof cross[i] === "object" && (() => {
                  const cs = cross[i] as CrossSignal;
                  const meta = SIGNAL_META[cs.signal] || SIGNAL_META.none;
                  return (
                    <div style={{ background: "#0a1220", border: `1px solid ${meta.color}40`, borderRadius: 10, padding: "9px 12px" }}>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: meta.color, marginBottom: 4 }}>{meta.label}</div>
                      <p style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, margin: 0 }}>{cs.verdict}</p>
                      <p style={{ fontSize: 10.5, color: C.textDim, opacity: 0.65, margin: "4px 0 0", lineHeight: 1.4 }}>
                        Comparable channels = channels YouTube surfaces in the same niche with enough long-form uploads to have their own outliers. A rough peer set, not a curated competitor list.
                      </p>
                      {cs.channels?.filter(c => c.matches).length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <button onClick={() => setShowExamples(s => ({ ...s, [i]: !s[i] }))}
                            style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                            {showExamples[i] ? "Hide supporting examples" : `View ${cs.channels.filter(c => c.matches).length} supporting examples →`}
                          </button>
                          {showExamples[i] && (
                            <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 2 }}>
                              {cs.channels.filter(c => c.matches).map((c, j) => (
                                <div key={j} style={{ fontSize: 11.5, color: C.textDim }}>
                                  <span style={{ fontWeight: 700, color: C.textBright }}>{c.title}</span>{c.matchedTitle ? ` — "${c.matchedTitle}"` : ""}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Tier({ title, color, desc, children }: { title: string; color: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${color}22` }}>
        <span style={{ fontSize: 13, fontWeight: 800, color, letterSpacing: 0.6, textTransform: "uppercase" }}>{title}</span>
        <span style={{ fontSize: 12, color: C.textDim }}>{desc}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function Card({ v, emerging, onSelect }: { v: OutlierVideo; medianDurationMin: number; channelTitle: string; emerging?: boolean; onSelect: (v: OutlierVideo) => void }) {
  const durMin = Math.round(v.durationSec / 60);
  const overExpected = v.views - v.expectedViews;
  return (
    <div style={{ background: C.card, border: `1px solid ${v.outlierX >= 2 ? "rgba(251,146,60,0.35)" : C.border}`, borderRadius: 14, padding: "12px 14px" }}>
      {/* Minimal, scannable list card. All the intelligence lives on the Outlier DNA screen. */}
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {v.thumbnail && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={v.thumbnail} alt="" style={{ width: 120, height: 68, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textBright, lineHeight: 1.35, marginBottom: 5 }}>{v.title}</div>
          <div style={{ fontSize: 12, color: C.textDim }}>
            {fmt(v.views)} views · {durMin} min · {ago(v.publishedAt)}
          </div>
          {emerging && (
            <p style={{ fontSize: 11.5, color: "#fb923c", margin: "6px 0 0", lineHeight: 1.4 }}>
              Outperforming the channel's normal early pace. Final performance isn't known yet.
            </p>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: "center", minWidth: 90 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: outlierColor(v.outlierX) }}>{v.outlierX}×</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: 0.5 }}>{emerging ? "EARLY PACE" : "EXPECTED"}</div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 3, lineHeight: 1.3 }}>
            exp ~{fmt(v.expectedViews)} → {fmt(v.views)}
            {overExpected > 0 && <><br /><span style={{ color: C.green }}>+{fmt(overExpected)} above</span></>}
          </div>
        </div>
        <button onClick={() => onSelect(v)}
          style={{ flexShrink: 0, padding: "10px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: "#fff", border: "none", cursor: "pointer", background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)", boxShadow: "0 2px 10px rgba(77,184,255,0.25)" }}>
          View Outlier DNA →
        </button>
      </div>
    </div>
  );
}

// ── Dedicated Outlier DNA screen ─────────────────────────────────────────────
// A full view for one outlier, reusing the data already scanned (no re-scan). Follows the
// epistemic order the analysis is built on: observation -> interpretation -> what was
// different -> DNA -> reusable pattern -> cross-channel validation -> original ideas.
function OutlierDnaScreen({ v, result, onBack }: { v: OutlierVideo; result: ScanResult; onBack: () => void }) {
  const durMin = Math.round(v.durationSec / 60);
  const lenDelta = result.medianDurationMin > 0 ? Math.round(((durMin - result.medianDurationMin) / result.medianDurationMin) * 100) : 0;
  const conf = confidenceOf(v);
  const overExpected = v.views - v.expectedViews;
  const emerging = isEmerging(v);
  const belongsTo = (result.channelPatterns || []).filter(p => p.videoIds.includes(v.videoId));

  const [dna, setDna] = useState<DnaResult | null>(null);
  const [dnaLoading, setDnaLoading] = useState(true);
  const [dnaError, setDnaError] = useState<string | null>(null);
  const [cross, setCross] = useState<CrossSignal | "loading" | "error" | null>(null);
  const [showEx, setShowEx] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setDnaLoading(true); setDnaError(null);
      try {
        const res = await fetch("/api/outlier-opportunities", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: v.title, channelTitle: result.channel.title, durationMin: durMin,
            outlierType: v.analysis?.outlierType || [],
            titlePattern: v.analysis?.titlePattern || "",
            storyPattern: v.analysis?.storyPattern || "",
            niche: (result as any).niche || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        if (alive) setDna(data);
      } catch (e: any) { if (alive) setDnaError(e.message); }
      finally { if (alive) setDnaLoading(false); }
    })();
    return () => { alive = false; };
  }, [v.videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkCross() {
    if (cross) return;
    setCross("loading");
    try {
      const patternName = v.analysis?.storyPattern || v.analysis?.titlePattern || "this outlier's structure";
      const res = await fetch("/api/cross-channel-validate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patternName, patternWhy: v.analysis?.whyItStandsOut || "",
          exampleTitles: [v.title], seedChannelTitle: result.channel.title,
          seedChannelSubs: result.channel.subscribers, niche: result.niche,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCross(data);
    } catch { setCross("error"); }
  }

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: 0.6, margin: "18px 0 8px" }}>{children}</div>
  );

  return (
    <div>
      <button onClick={onBack} style={{ fontSize: 13, fontWeight: 600, color: C.accentDim, background: "transparent", border: "none", cursor: "pointer", padding: "0 0 14px" }}>← Back to outliers</button>

      {/* Header */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
        {v.thumbnail && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={v.thumbnail} alt="" style={{ width: 200, height: 112, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: C.textBright, lineHeight: 1.3, marginBottom: 6 }}>{v.title}</div>
          <div style={{ fontSize: 12.5, color: C.textDim }}>{result.channel.title} · {durMin} min · {ago(v.publishedAt)}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: outlierColor(v.outlierX) }}>{v.outlierX}×</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: 0.5 }}>{emerging ? "EARLY PACE" : "EXPECTED"}</span>
            <span style={{ fontSize: 13, color: C.textDim }}>{fmt(v.expectedViews)} expected → {fmt(v.views)} actual{overExpected > 0 ? ` · +${fmt(overExpected)} above` : ""}</span>
          </div>
          {emerging && <p style={{ fontSize: 12, color: "#fb923c", margin: "8px 0 0", lineHeight: 1.4 }}>Very fresh — this is current velocity, not a matured result. Final performance isn't known yet.</p>}
        </div>
      </div>

      {/* Observation → Interpretation (the epistemic split) */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
        {v.analysis?.whyItStandsOut ? (
          <>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.green, letterSpacing: 0.5, marginBottom: 3 }}>OBSERVATION — WHAT STANDS OUT</div>
            <p style={{ fontSize: 13.5, color: C.textBright, lineHeight: 1.5, margin: "0 0 12px" }}>{v.analysis.whyItStandsOut}</p>
          </>
        ) : null}
        {v.analysis?.likelyDriver ? (
          <>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.accentDim, letterSpacing: 0.5, marginBottom: 3 }}>INTERPRETATION — POSSIBLE DRIVER</div>
            <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.5, margin: 0 }}>{v.analysis.likelyDriver}</p>
          </>
        ) : null}
        {!v.analysis && <p style={{ fontSize: 12.5, color: C.textDim, margin: 0 }}>No pattern analysis was captured for this video (it was below the outlier threshold at scan time).</p>}
      </div>

      {/* What was different — answers "why did this qualify as an outlier?" as labeled signals */}
      <SectionTitle>WHAT WAS DIFFERENT</SectionTitle>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
        {(() => {
          const types = v.analysis?.outlierType || [];
          const rows: [string, string][] = [
            ["Performance", `${v.outlierX}× ${emerging ? "expected early pace" : "above expected"} (${fmt(v.expectedViews)} → ${fmt(v.views)})`],
          ];
          if (types.includes("Packaging") || v.analysis?.titlePattern) rows.push(["Packaging", v.analysis?.titlePattern || "Unusually strong title framing for this channel"]);
          if (types.includes("Subject")) rows.push(["Subject", "A subject category less common in the channel's recent mix"]);
          if (types.includes("Topic")) rows.push(["Topic", "A topic far from the channel's norm"]);
          if (types.includes("Timing")) rows.push(["Timing", "Rides a timely event or renewed interest"]);
          rows.push(["Format", Math.abs(lenDelta) >= 25 ? `${durMin} min (${lenDelta > 0 ? "+" : ""}${lenDelta}% vs the ~${result.medianDurationMin} min norm)` : `${durMin} min · roughly in line with the ~${result.medianDurationMin} min norm`]);
          return rows.map(([k, val]) => (
            <div key={k} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.45 }}><span style={{ fontWeight: 700, color: C.textBright, display: "inline-block", minWidth: 96 }}>{k}</span>{val}</div>
          ));
        })()}
        <div style={{ marginTop: 3 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: conf.color, background: `${conf.color}16`, border: `1px solid ${conf.color}40`, borderRadius: 5, padding: "1px 8px" }}>{conf.label}</span>
        </div>
      </div>

      {/* Evidence link: which channel-level detected patterns this outlier belongs to */}
      {belongsTo.length > 0 && (
        <>
          <SectionTitle>BELONGS TO DETECTED PATTERNS</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {belongsTo.map((p, i) => (
              <div key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: p.kind === "story" ? "#f87171" : "#a78bfa" }}>{p.kind === "story" ? "STORY" : "PACKAGING"}</span>
                <span style={{ fontWeight: 700, color: C.textBright }}>{p.name}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: CONF_COLOR[p.confidence] || C.textDim }}>{p.confidence} confidence</span>
                <span style={{ fontSize: 10.5, color: C.textDim, opacity: 0.75 }}>prevalence {p.videoIds.length}/{outlierCountOf(result)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* DNA + reusable pattern + opportunities (fetched) */}
      {dnaLoading && (
        <div style={{ padding: "20px 0" }}>
          {/* Animated so a slow extract reads as "working, wait" — a glow sweep + gentle wiggle. */}
          <style>{`
            @keyframes dnaShimmer { to { background-position: 200% center; } }
            @keyframes dnaWiggle { 0%,100% { transform: translateY(0) rotate(-0.6deg); } 50% { transform: translateY(-1.5px) rotate(0.6deg); } }
          `}</style>
          <span style={{
            display: "inline-block", fontSize: 13, fontWeight: 700, letterSpacing: 0.2,
            background: "linear-gradient(90deg, #4db8ff 0%, #a78bfa 35%, #e8edf5 50%, #a78bfa 65%, #4db8ff 100%)",
            backgroundSize: "200% auto", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
            animation: "dnaShimmer 1.6s linear infinite, dnaWiggle 1.4s ease-in-out infinite",
          }}>
            Extracting the transferable pattern and original opportunities…
          </span>
        </div>
      )}
      {dnaError && <div style={{ fontSize: 13, color: "#fca5a5", padding: "12px 0" }}>{dnaError}</div>}
      {dna && (
        <>
          <SectionTitle>🧬 OUTLIER DNA</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#f87171", marginBottom: 7 }}>STORY DNA</div>
              {([["Topic", dna.dna.topic], ["Subject", dna.dna.subject], ["Story structure", dna.dna.storyStructure || v.analysis?.storyPattern || ""]] as [string, string][]).filter(([, val]) => val).map(([k, val]) => (
                <div key={k} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.45, marginBottom: 3 }}><span style={{ fontWeight: 700, color: C.textBright }}>{k}: </span>{val}</div>
              ))}
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 5, padding: "1px 7px" }}>EVIDENCE BASIS: TITLE ONLY</span>
                <span style={{ fontSize: 10.5, color: C.textDim, opacity: 0.7 }}>structure inferred from packaging, not the video's content</span>
              </div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#a78bfa", marginBottom: 7 }}>PACKAGING DNA</div>
              {([["Title structure", dna.dna.packaging || v.analysis?.titlePattern || ""], ["Curiosity mechanism", dna.dna.curiosityMechanism]] as [string, string][]).filter(([, val]) => val).map(([k, val]) => (
                <div key={k} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.45, marginBottom: 3 }}><span style={{ fontWeight: 700, color: C.textBright }}>{k}: </span>{val}</div>
              ))}
              <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.45 }}><span style={{ fontWeight: 700, color: C.textBright }}>Format: </span>{durMin} min{Math.abs(lenDelta) >= 25 ? ` (${lenDelta > 0 ? "+" : ""}${lenDelta}% vs norm)` : ""}</div>
            </div>
          </div>

          <SectionTitle>REUSABLE PATTERN</SectionTitle>
          <p style={{ fontSize: 11.5, color: C.textDim, opacity: 0.75, margin: "-4px 0 8px" }}>Structure ≠ subject: borrow the mechanism, not the story.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.green, marginBottom: 6 }}>WHAT TO BORROW</div>
              {dna.whatToBorrow.map((b, i) => <div key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>· {b}</div>)}
            </div>
            <div style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#f87171", marginBottom: 6 }}>WHAT NOT TO COPY</div>
              {dna.whatNotToCopy.map((b, i) => <div key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5 }}>· {b}</div>)}
            </div>
          </div>
        </>
      )}

      {/* Cross-channel validation for this outlier's pattern */}
      <SectionTitle>CROSS-CHANNEL SIGNAL</SectionTitle>
      {!cross && (
        <button onClick={checkCross} style={{ fontSize: 12.5, fontWeight: 700, color: C.accentDim, background: "rgba(77,184,255,0.08)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 14px", cursor: "pointer" }}>
          Does this pattern repeat across channels? →
        </button>
      )}
      {cross === "loading" && <div style={{ fontSize: 12.5, color: C.textDim }}>Scanning comparable channels for this pattern...</div>}
      {cross === "error" && <div style={{ fontSize: 12.5, color: "#fca5a5" }}>Couldn't validate across channels. Try again.</div>}
      {cross && typeof cross === "object" && (() => {
        const meta = SIGNAL_META[cross.signal] || SIGNAL_META.none;
        return (
          <div style={{ background: "#0a1220", border: `1px solid ${meta.color}40`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: meta.color, lineHeight: 1.1 }}>{cross.matched} / {cross.scanned}<span style={{ fontSize: 12, fontWeight: 600, color: C.textDim }}> comparable channels</span></div>
            <div style={{ fontSize: 12, fontWeight: 800, color: meta.color, margin: "2px 0 4px" }}>{meta.label}</div>
            <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: 0 }}>{cross.verdict}</p>
            <p style={{ fontSize: 10.5, color: C.textDim, opacity: 0.65, margin: "4px 0 0", lineHeight: 1.4 }}>
              Comparable channels = a rough peer set YouTube surfaces in the same niche and scale, not a curated competitor list.
            </p>
            {cross.channels?.filter(c => c.matches).length > 0 && (
              <div style={{ marginTop: 6 }}>
                <button onClick={() => setShowEx(s => !s)} style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                  {showEx ? "Hide supporting examples" : `View ${cross.channels.filter(c => c.matches).length} supporting examples →`}
                </button>
                {showEx && (
                  <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 2 }}>
                    {cross.channels.filter(c => c.matches).map((c, j) => (
                      <div key={j} style={{ fontSize: 11.5, color: C.textDim }}><span style={{ fontWeight: 700, color: C.textBright }}>{c.title}</span>{c.matchedTitle ? ` — "${c.matchedTitle}"` : ""}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Original opportunities */}
      {dna && dna.opportunities?.length > 0 && (
        <>
          <SectionTitle>ORIGINAL OPPORTUNITIES</SectionTitle>
          <p style={{ fontSize: 11.5, color: C.textDim, opacity: 0.75, margin: "-4px 0 10px" }}>Apply the observed pattern to a different story — not a remix of this video. These are research angles to investigate, not pre-written plots.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {dna.opportunities.slice(0, 3).map((o, i) => (
              <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textBright, lineHeight: 1.35 }}>{o.title}</div>
                {o.patternTransferred && <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 5 }}><span style={{ fontWeight: 700, color: C.green }}>Pattern transferred: </span>{o.patternTransferred}</div>}
                {o.researchAngle && <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 3, lineHeight: 1.5 }}><span style={{ fontWeight: 700, color: C.accentDim }}>Research angle: </span>{o.researchAngle}</div>}
                {o.whyItFits && <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 3, lineHeight: 1.5 }}><span style={{ fontWeight: 700, color: C.accentDim }}>Why it fits: </span>{o.whyItFits}</div>}
                {(() => {
                  // Carry the outlier's DNA into the script generator as an editable seed:
                  // suggested length (from the outlier) + an angle that borrows the winning
                  // structure. Non-auto-firing prefillTopic channel, so nothing generates yet.
                  const seedAngle = [
                    o.patternTransferred ? `Borrow this proven structure (not the subject): ${o.patternTransferred}.` : "",
                    dna.dna.storyStructure ? `Story shape: ${dna.dna.storyStructure}.` : "",
                    dna.dna.curiosityMechanism ? `Hook: ${dna.dna.curiosityMechanism}.` : "",
                    dna.dna.packaging ? `Title framing: ${dna.dna.packaging}.` : "",
                  ].filter(Boolean).join(" ");
                  const href = `/dashboard/scripts/new?prefillTopic=${encodeURIComponent(o.title)}&seed=outlier&seedMinutes=${durMin}&seedAngle=${encodeURIComponent(seedAngle)}`;
                  // "Copy idea" banks the whole package so an opportunity isn't lost when the
                  // list regenerates: the concept plus a re-enterable link that reopens the
                  // SAME seeded script flow (works across sessions on whatever host you're on).
                  const url = `${(typeof window !== "undefined" ? window.location.origin : "https://skripr.app")}${href}`;
                  const copyText = [
                    o.title, "",
                    o.patternTransferred ? `Pattern transferred: ${o.patternTransferred}` : "",
                    o.researchAngle ? `Research angle: ${o.researchAngle}` : "",
                    o.whyItFits ? `Why it fits: ${o.whyItFits}` : "",
                    "", `Open in Skripr: ${url}`,
                  ].filter((l) => l !== undefined).join("\n");
                  // Rich-text version so pasting into Docs/Notion gives an already-clickable link
                  // (no manual "insert link"); plain text is the fallback for editors that ignore HTML.
                  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
                  const copyHtml = [
                    `<div><strong>${esc(o.title)}</strong></div>`,
                    o.patternTransferred ? `<div><strong>Pattern transferred:</strong> ${esc(o.patternTransferred)}</div>` : "",
                    o.researchAngle ? `<div><strong>Research angle:</strong> ${esc(o.researchAngle)}</div>` : "",
                    o.whyItFits ? `<div><strong>Why it fits:</strong> ${esc(o.whyItFits)}</div>` : "",
                    `<div><a href="${esc(url)}">Open in Skripr →</a></div>`,
                  ].filter(Boolean).join("");
                  const doCopy = async () => {
                    try {
                      const CI = (window as any).ClipboardItem;
                      if (navigator.clipboard && typeof CI !== "undefined") {
                        await navigator.clipboard.write([new CI({
                          "text/html": new Blob([copyHtml], { type: "text/html" }),
                          "text/plain": new Blob([copyText], { type: "text/plain" }),
                        })]);
                      } else {
                        await navigator.clipboard.writeText(copyText);
                      }
                      setCopiedIdx(i); setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 2000);
                    } catch {
                      try { await navigator.clipboard.writeText(copyText); setCopiedIdx(i); setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 2000); } catch {}
                    }
                  };
                  return (
                    <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                      {/* One-move: seeded link + auto=1 -> setup (length/voice/CTA) -> Skripr
                          auto-pilots case+facts, angle, storytelling and generates the finished script.
                          Replaces the old "Research this idea" hop, which this now does end to end. */}
                      <a href={`${href}&auto=1`}
                        style={{ display: "inline-block", fontSize: 12, fontWeight: 800, color: "#fff", textDecoration: "none", padding: "6px 13px", borderRadius: 8, background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)" }}>
                        Make the script →
                      </a>
                      <button
                        onClick={doCopy}
                        style={{ fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "6px 13px", borderRadius: 8, background: copiedIdx === i ? "rgba(52,211,153,0.12)" : "rgba(77,184,255,0.08)", border: `1px solid ${copiedIdx === i ? "rgba(52,211,153,0.35)" : C.border}`, color: copiedIdx === i ? C.green : C.accentDim }}>
                        {copiedIdx === i ? "✓ Copied" : "Copy idea"}
                      </button>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <a href={`/dashboard/viral-remixer?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${v.videoId}`)}`}
          style={{ fontSize: 12, fontWeight: 600, color: C.accentDim, textDecoration: "none" }}>
          Or remix the original video in Viral Remixer →
        </a>
      </div>
    </div>
  );
}
