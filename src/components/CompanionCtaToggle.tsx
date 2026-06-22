"use client";

// Per-script option: end the script with a "watch my related video (above this
// one or linked in the description)" CTA. Off by default, only creators who
// actually have a companion video should turn it on.
export function CompanionCtaToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#0d1520", border: "1px solid rgba(77,184,255,0.12)", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
      <span style={{ fontSize: 14 }}>🎬</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#c3d9ea", letterSpacing: 0.5 }}>END WITH “WATCH MY RELATED VIDEO” CTA</div>
        <div style={{ fontSize: 11, color: "#7a9bb5", marginTop: 2 }}>Only turn on if you have a related video to point viewers to.</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        style={{
          marginLeft: "auto", flexShrink: 0, width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
          background: value ? "linear-gradient(135deg, #0e6499 0%, #1a8fd1 100%)" : "rgba(255,255,255,0.10)",
          position: "relative", transition: "background 0.15s",
        }}
      >
        <span style={{ position: "absolute", top: 3, left: value ? 27 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
      </button>
    </div>
  );
}
