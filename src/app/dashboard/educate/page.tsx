"use client";

import Link from "next/link";

const C = {
  bg: "#0b0b17",
  cardBg: "#12122a",
  border: "rgba(99,102,241,0.12)",
  accent: "#818cf8",
  text: "#e2e8f0",
  textDim: "#64748b",
  textBright: "#f1f5f9",
};

const lessons = [
  { title: "The 8 Hook Types That Keep Viewers Watching", category: "Hooks", level: "Beginner", duration: "5 min" },
  { title: "How to Structure a Viral Script", category: "Script Writing", level: "Beginner", duration: "8 min" },
  { title: "Niche Bending: Breaking Out of Your Algorithm Bubble", category: "Growth", level: "Intermediate", duration: "6 min" },
  { title: "Avoiding Demonetization: What YouTube's AI Actually Flags", category: "Compliance", level: "Intermediate", duration: "10 min" },
  { title: "TTS Optimization: Making AI Voice Sound Human", category: "Production", level: "Beginner", duration: "7 min" },
  { title: "Thumbnail Psychology: What Makes People Click", category: "Thumbnails", level: "Intermediate", duration: "6 min" },
  { title: "Retention Beats: The Secret to 70%+ Audience Retention", category: "Script Writing", level: "Advanced", duration: "12 min" },
  { title: "Metadata Mastery: Titles, Tags, and Descriptions That Rank", category: "SEO", level: "Beginner", duration: "8 min" },
];

const levelColor = (level: string) =>
  level === "Beginner"
    ? { bg: "rgba(52,211,153,0.12)", color: "#34d399" }
    : level === "Intermediate"
      ? { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" }
      : { bg: "rgba(248,113,113,0.12)", color: "#f87171" };

export default function EducatePage() {
  return (
    <div style={{ padding: 28, minHeight: "100vh", background: C.bg }}>
      <div aria-hidden style={{ position: "fixed", top: -160, right: -100, width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "fixed", bottom: -180, left: -120, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.09) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textBright, letterSpacing: -0.4, marginBottom: 6 }}>Learn</h1>
          <p style={{ color: C.textDim, fontSize: 15, lineHeight: 1.6 }}>Master the skills that grow faceless YouTube channels</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {lessons.map((lesson, i) => {
            const lc = levelColor(lesson.level);
            return (
              <Link
                key={i}
                href="#"
                style={{
                  display: "block",
                  borderRadius: 18,
                  background: C.cardBg,
                  border: `1px solid ${C.border}`,
                  padding: "20px 22px",
                  textDecoration: "none",
                  transition: "background 200ms, border-color 200ms, transform 200ms",
                  cursor: "pointer",
                }}
                onMouseEnter={(e: any) => {
                  const el = e.currentTarget;
                  el.style.background = "#1a1a3a";
                  el.style.borderColor = "rgba(99,102,241,0.28)";
                  el.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e: any) => {
                  const el = e.currentTarget;
                  el.style.background = C.cardBg;
                  el.style.borderColor = C.border;
                  el.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: lc.bg, color: lc.color, letterSpacing: 0.2 }}>{lesson.level}</span>
                  <span style={{ fontSize: 12, color: C.textDim }}>{lesson.duration}</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: C.textBright, marginBottom: 4, lineHeight: 1.4 }}>{lesson.title}</h3>
                <p style={{ fontSize: 13, color: C.textDim }}>{lesson.category}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
