"use client";
import { useState } from "react";
import Link from "next/link";

const C = {
  bg: "#080c12", card: "#0d1520", borderAccent: "rgba(77,184,255,0.30)",
  accent: "#1a8fd1", accentDim: "#4db8ff", text: "#e8edf5", muted: "#d2e2f2", dim: "#bcd2e8",
  green: "#00d4a0",
};

type Verdict = {
  id: "too-early" | "reach" | "click" | "open" | "structure" | "healthy";
  label: string;
  title: string;
  meaning: string;
  fix: string;
  links: { href: string; label: string }[];
  skriprCta: boolean;
};

type ChannelVideo = { videoId: string; title: string; thumbnail: string; views: number; publishedAt: string; ageDays: number; viewsPerDay: number };
type ChannelData = { channel: { title: string; thumbnail: string; subscribers: number }; medianViews: number; videos: ChannelVideo[] };

const fmtV = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : `${v}`;

// Accept numbers the way Studio shows them: "10.2K", "1.2M", "10,200", "3.5%".
function parseNum(s: string): number {
  const cleaned = s.trim().toLowerCase().replace(/,/g, "").replace(/%$/, "").trim();
  const m = cleaned.match(/^(\d+(?:\.\d+)?)\s*([km])?$/);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  return m[2] === "k" ? n * 1e3 : m[2] === "m" ? n * 1e6 : n;
}

// The same diagnostic tree we apply by hand in creator threads:
// impressions measure reach, CTR measures the click, retention measures the hold.
// Deterministic on purpose: instant, free, and the logic is the product.
function diagnose(days: number, impressions: number, ctr: number, avg: number, drop: string, traffic: string): { primary: Verdict; note: string | null } {
  const v = (verdict: Verdict, note: string | null = null) => ({ primary: verdict, note });

  if (days < 3 && impressions < 2000) {
    return v({
      id: "too-early",
      label: "Too early to call",
      title: "This is not a flop yet. It is day " + Math.max(days, 0) + ".",
      meaning: "YouTube tests videos in waves, and the first couple of days tell you very little unless impressions already spiked. Small channels often see the real test start days later.",
      fix: "Wait until day 3 to 7 before judging. Watch impressions first. If they climb and CTR holds, you are fine. If impressions stay flat after a week, run this again and the picture will be clearer.",
      links: [],
      skriprCta: false,
    });
  }

  if (impressions < 500) {
    const packagingToo = ctr > 0 && ctr < 4;
    return v({
      id: "reach",
      label: "Reach leak",
      title: "Your video never really got shown.",
      meaning: "Impressions measure reach, and yours are low. The algorithm is not grading your quality. It tests every video on a small group, and if the early clicks are weak or the topic pool is small, it stops offering it out.",
      fix: "The lever is the promise, not the production. Broaden the question your title asks, not the topic. Quick test: strip the proper nouns out of your title. If the question still pulls a stranger, it is broad enough. If it collapses, the pool was always going to be small.",
      links: [
        { href: "/youtube-video-ideas-generator", label: "Free Video Ideas Generator" },
        { href: "/youtube-title-generator", label: "Free Title Generator" },
      ],
      skriprCta: false,
    }, packagingToo ? "Your CTR is also low, which points the same direction. The packaging never earned a bigger test." : (traffic === "search" ? "Mostly search traffic on top of low impressions usually means the topic itself is capped. Search demand has a ceiling." : null));
  }

  if (ctr < 3) {
    return v({
      id: "click",
      label: "Click leak",
      title: "People saw it and did not click.",
      meaning: "Your impressions are fine, so YouTube offered the video out. A CTR under 3 percent means the title and thumbnail did not earn the click. This is the most common leak, and the most fixable.",
      fix: traffic === "browse"
        ? "Your traffic is mostly Browse and Suggested, where the thumbnail does more work than the title. Test a stronger thumbnail before touching anything else, and keep the title as one clean promise a stranger would click."
        : "Rework the packaging as one clean promise a stranger would click. Lead with the most interesting part, keep it under 60 characters, and make the thumbnail show the payoff, not the setup.",
      links: [
        { href: "/youtube-title-generator", label: "Free Title Generator" },
        { href: "/youtube-tag-generator", label: "Free Tag Generator" },
      ],
      skriprCta: false,
    });
  }

  if (drop === "first30") {
    return v({
      id: "open",
      label: "Open leak",
      title: "They clicked, then left in the first 30 seconds.",
      meaning: "The click worked, so the promise landed. Losing people right after means the opening did not deliver that promise fast enough. A drop in the first seconds is usually a thumbnail to first-frame mismatch or throat-clearing before the thing they came for.",
      fix: "Make the first frame show what the thumbnail promised, and make the first spoken line pay off the title instead of setting it up. Cut the greeting, the logo, and the housekeeping. Say the part you were saving for the middle, first.",
      links: [
        { href: "/youtube-hook-generator", label: "Free Hook Generator" },
      ],
      skriprCta: true,
    });
  }

  if (avg < 35) {
    const middle = drop === "middle";
    return v({
      id: "structure",
      label: "Structure leak",
      title: middle ? "They stayed past the open, then drifted away." : "The video is not holding people.",
      meaning: middle
        ? "Mid-video drops are a script problem, not an editing problem. Every exit timestamp is a line that did not earn the next one. The usual cause is closing your open loops too early, so nothing is pulling the viewer forward."
        : "Average view duration this low means the video leaks somewhere. Open your retention graph, find the sharp dips, and read what the script was doing at those exact timestamps. That is where a line failed to earn the next one.",
      fix: "Structure the script around open loops. Pose the question early, pay it off late, and re-hook before every payoff. This is the one leak that better cameras and tighter editing cannot fix, because it lives in the writing.",
      links: [],
      skriprCta: true,
    });
  }

  if (ctr < 5) {
    return v({
      id: "healthy",
      label: "No major leak",
      title: "These numbers are not a flop.",
      meaning: "Reach, clicks, and retention are all in a workable range. The video did its job. When everything is healthy and views still feel low, the ceiling is usually the size of the topic, not a leak in the video.",
      fix: "The lever now is the next video, not this one. Pick a topic with a broader question, keep the packaging sharp, and let this one keep collecting views in the background. There is upside left in CTR too, so a thumbnail test is worth it.",
      links: [
        { href: "/youtube-video-ideas-generator", label: "Free Video Ideas Generator" },
      ],
      skriprCta: true,
    });
  }

  return v({
    id: "healthy",
    label: "No leak found",
    title: "This video is doing its job.",
    meaning: "Reach, clicks, and retention all look healthy. If views still feel low, you are not looking at a broken video. You are looking at a topic pool that is smaller than you hoped, or a video that simply needs more time.",
    fix: "Do not touch this one. Point the energy at the next video: a broader question, the same quality, and the same packaging discipline. Winning videos are usually a pattern, not a lottery ticket.",
    links: [
      { href: "/youtube-video-ideas-generator", label: "Free Video Ideas Generator" },
    ],
    skriprCta: true,
  });
}

export default function FlopDiagnostic() {
  const [mode, setMode] = useState<"channel" | "manual">("channel");

  // Channel mode
  const [channelInput, setChannelInput] = useState("");
  const [loadingChannel, setLoadingChannel] = useState(false);
  const [channelData, setChannelData] = useState<ChannelData | null>(null);
  const [selected, setSelected] = useState<ChannelVideo | null>(null);

  // Shared numbers
  const [days, setDays] = useState("");
  const [impressions, setImpressions] = useState("");
  const [ctr, setCtr] = useState("");
  const [avg, setAvg] = useState("");
  const [drop, setDrop] = useState("unsure");
  const [traffic, setTraffic] = useState("unsure");

  const [result, setResult] = useState<{ primary: Verdict; note: string | null } | null>(null);
  const [critique, setCritique] = useState<string | null>(null);
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadChannel() {
    if (!channelInput.trim()) { setError("Paste your channel link or @handle first."); return; }
    setLoadingChannel(true); setError(null); setChannelData(null); setSelected(null); setResult(null); setCritique(null);
    try {
      const res = await fetch("/api/flop-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "channel", channel: channelInput.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setChannelData(data);
    } catch (e: any) {
      setError(e?.message || "Could not load that channel. Try the numbers-only mode.");
    } finally {
      setLoadingChannel(false);
    }
  }

  function pickVideo(v: ChannelVideo) {
    setSelected(v);
    setDays(String(v.ageDays));
    setResult(null); setCritique(null);
  }

  function run() {
    const d = parseNum(days), i = parseNum(impressions), c = parseNum(ctr), a = parseNum(avg);
    if (!days.trim() || !impressions.trim() || !ctr.trim() || !avg.trim()) {
      setError("Fill in all four numbers from YouTube Studio first. Estimates are fine.");
      return;
    }
    if (Number.isNaN(d) || d < 0) { setError("Days since upload should be a number, like 7."); return; }
    if (Number.isNaN(i) || i < 0) { setError("Impressions should be a number. Shorthand like 10.2k works too."); return; }
    if (Number.isNaN(c) || c < 0 || c > 100) { setError("CTR is a percent between 0 and 100, like 3.5."); return; }
    if (Number.isNaN(a) || a < 0 || a > 100) { setError("Average % viewed is a percent between 0 and 100. If Studio shows you a view duration in minutes, use the percentage next to it instead."); return; }
    setError(null);
    const diag = diagnose(d, i, c, a, drop, traffic);
    setResult(diag);
    setCritique(null);

    // Personalized title read, only when we know the actual video.
    if (mode === "channel" && selected) {
      setCritiqueLoading(true);
      fetch("/api/flop-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "critique", title: selected.title, verdict: diag.primary.id, channelName: channelData?.channel.title || "" }),
      })
        .then((r) => r.json())
        .then((data) => { if (data.critique) setCritique(data.critique); })
        .catch(() => {})
        .finally(() => setCritiqueLoading(false));
    }
  }

  // The user's own proven winner: best recent performer that is not the flop.
  const winner = (() => {
    if (!channelData || !selected) return null;
    const others = channelData.videos.filter((x) => x.videoId !== selected.videoId && x.views >= channelData.medianViews);
    if (!others.length) return null;
    const top = [...others].sort((a, b) => b.viewsPerDay - a.viewsPerDay)[0];
    return top.views > selected.views ? top : null;
  })();

  const medianRatio = channelData && selected && channelData.medianViews > 0
    ? selected.views / channelData.medianViews
    : null;

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 15, outline: "none",
  } as const;
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: C.dim, letterSpacing: 0.4, marginBottom: 7, textTransform: "uppercase" as const };
  const tabStyle = (active: boolean) => ({
    flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
    background: active ? "rgba(77,184,255,0.12)" : "transparent",
    border: active ? "1px solid rgba(77,184,255,0.35)" : "1px solid rgba(255,255,255,0.08)",
    color: active ? C.accentDim : C.dim,
  } as const);

  const numberInputs = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Days since upload</label>
          <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" placeholder="e.g. 7" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Impressions</label>
          <input value={impressions} onChange={(e) => setImpressions(e.target.value)} placeholder="e.g. 1200 or 10.2k" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>CTR (%)</label>
          <input value={ctr} onChange={(e) => setCtr(e.target.value)} inputMode="decimal" placeholder="e.g. 3.5" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Average % viewed</label>
          <input value={avg} onChange={(e) => setAvg(e.target.value)} inputMode="decimal" placeholder="e.g. 32" style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Where does the retention graph drop?</label>
          <select value={drop} onChange={(e) => setDrop(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="unsure">Not sure</option>
            <option value="first30">In the first 30 seconds</option>
            <option value="middle">Spread through the middle</option>
            <option value="end">Mostly near the end</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Where do views come from?</label>
          <select value={traffic} onChange={(e) => setTraffic(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="unsure">Not sure</option>
            <option value="browse">Mostly Browse and Suggested</option>
            <option value="search">Mostly Search</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
      </div>
      <button onClick={run} style={{
        width: "100%", height: 50, borderRadius: 12, border: "none",
        background: "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)",
        color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer",
      }}>
        Diagnose my video
      </button>
      <p style={{ fontSize: 12, color: C.dim, textAlign: "center", margin: "10px 0 0" }}>
        The numbers are on your video's Analytics tab in YouTube Studio. Benchmarks are rough guides for small channels, not laws.
      </p>
    </>
  );

  return (
    <div style={{ background: C.card, border: `1px solid ${C.borderAccent}`, borderRadius: 18, padding: "24px 24px 26px" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button style={tabStyle(mode === "channel")} onClick={() => { setMode("channel"); setError(null); }}>Pick from my channel</button>
        <button style={tabStyle(mode === "manual")} onClick={() => { setMode("manual"); setError(null); }}>Enter numbers only</button>
      </div>

      {mode === "channel" && (
        <>
          <label style={labelStyle}>Your channel link or @handle</label>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadChannel()}
              placeholder="youtube.com/@yourchannel"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={loadChannel} disabled={loadingChannel} style={{
              padding: "0 20px", borderRadius: 10, border: "none", whiteSpace: "nowrap",
              background: loadingChannel ? "rgba(77,184,255,0.14)" : "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)",
              color: loadingChannel ? C.accentDim : "#fff", fontSize: 14, fontWeight: 700, cursor: loadingChannel ? "wait" : "pointer",
            }}>
              {loadingChannel ? "Loading..." : "Load videos"}
            </button>
          </div>

          {channelData && !selected && (
            <>
              <div style={{ fontSize: 13, color: C.dim, marginBottom: 10 }}>Pick the video that flopped:</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 6, maxHeight: 340, overflowY: "auto", paddingRight: 4 }}>
                {channelData.videos.map((v) => (
                  <button key={v.videoId} onClick={() => pickVideo(v)} style={{ textAlign: "left", background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.14)", borderRadius: 12, padding: 10, cursor: "pointer" }}>
                    {v.thumbnail && (
                      <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", background: "#0a1220", marginBottom: 8 }}>
                        <img src={v.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => (e.currentTarget.style.display = "none")} />
                      </div>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.35, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.title}</div>
                    <div style={{ fontSize: 12, color: C.dim }}>{fmtV(v.views)} views · {v.ageDays}d ago</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {selected && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ width: 90, height: 51, borderRadius: 8, overflow: "hidden", background: "#0a1220", flexShrink: 0 }}>
                <img src={selected.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => (e.currentTarget.style.display = "none")} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.title}</div>
                <div style={{ fontSize: 12.5, color: C.dim, marginTop: 3 }}>
                  {fmtV(selected.views)} views · {selected.ageDays}d ago
                  {medianRatio !== null && (
                    <span style={{ marginLeft: 8, padding: "1px 8px", borderRadius: 6, fontWeight: 700, background: medianRatio < 0.8 ? "rgba(239,68,68,0.10)" : "rgba(0,212,160,0.10)", color: medianRatio < 0.8 ? "#fca5a5" : C.green, border: `1px solid ${medianRatio < 0.8 ? "rgba(239,68,68,0.25)" : "rgba(0,212,160,0.25)"}` }}>
                      {medianRatio.toFixed(1)}x your channel median
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => { setSelected(null); setResult(null); setCritique(null); }} style={{ background: "none", border: "none", color: C.dim, fontSize: 12, cursor: "pointer", textDecoration: "underline", flexShrink: 0 }}>change</button>
            </div>
          )}

          {selected && (
            <>
              <div style={{ fontSize: 13, color: C.dim, marginBottom: 12 }}>Now the three private numbers only you can see, from this video's Analytics tab in Studio:</div>
              {numberInputs}
            </>
          )}
        </>
      )}

      {mode === "manual" && numberInputs}

      {error && (
        <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: 14 }}>{error}</div>
      )}

      {result && (
        <div style={{ marginTop: 22 }}>
          <div style={{ background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.25)", borderRadius: 14, padding: "22px 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.accentDim, textTransform: "uppercase", marginBottom: 8 }}>{result.primary.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1.25, marginBottom: 12 }}>{result.primary.title}</div>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, margin: "0 0 14px" }}>{result.primary.meaning}</p>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(0,212,160,0.06)", border: "1px solid rgba(0,212,160,0.22)", marginBottom: result.note ? 14 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 5 }}>The fix</div>
              <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.7, margin: 0 }}>{result.primary.fix}</p>
            </div>
            {result.note && (
              <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.6, margin: 0 }}>Also worth knowing: {result.note}</p>
            )}
          </div>

          {(critiqueLoading || critique) && (
            <div style={{ marginTop: 14, background: "rgba(77,184,255,0.04)", border: "1px solid rgba(77,184,255,0.16)", borderRadius: 14, padding: "18px 22px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.accentDim, textTransform: "uppercase", marginBottom: 8 }}>About your title</div>
              {critiqueLoading && !critique ? (
                <p style={{ fontSize: 14, color: C.dim, margin: 0 }}>Reading your title...</p>
              ) : (
                <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{critique}</p>
              )}
            </div>
          )}

          {result.primary.links.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
              {result.primary.links.map((l) => (
                <Link key={l.href} href={l.href} style={{ fontSize: 14, fontWeight: 700, color: C.accentDim, background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.25)", borderRadius: 10, padding: "10px 16px", textDecoration: "none" }}>
                  {l.label} →
                </Link>
              ))}
            </div>
          )}

          <div style={{ marginTop: 18, padding: "20px 22px", borderRadius: 14, background: "rgba(77,184,255,0.06)", border: "1px solid rgba(77,184,255,0.22)", textAlign: "center" }}>
            {winner ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Your channel already has a proven winner.</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>
                  "{winner.title}" ({fmtV(winner.views)} views) is your best recent performer. Skripr can reverse-engineer why it worked and write your next script from it, in your voice. Two scripts free, no card.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                  {result.primary.skriprCta ? "The next script is the lever." : "When you are ready for the next one."}
                </div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>
                  Skripr writes your next script from a video already proven to work, in your voice, with the hook and re-hooks built in. Two scripts free, no card.
                </div>
              </>
            )}
            <Link href="/sign-up" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 10, background: C.accentDim, color: C.bg, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>Start free, 2 scripts</Link>
          </div>
        </div>
      )}
    </div>
  );
}
