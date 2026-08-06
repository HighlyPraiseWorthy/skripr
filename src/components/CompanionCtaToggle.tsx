"use client";

// Per-script CTA options. Both default to off: a script should ask for as little
// as possible unless the creator opts in.

function ToggleRow({
  icon, label, help, value, onChange,
}: { icon: string; label: string; help: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#0d1520", border: "1px solid rgba(77,184,255,0.12)", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#c3d9ea", letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 11, color: "#7a9bb5", marginTop: 2, lineHeight: 1.5 }}>{help}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        aria-label={label}
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

// Per-script option: end the script with a "watch my related video (above this
// one or linked in the description)" CTA. Off by default, only creators who
// actually have a companion video should turn it on.
export function CompanionCtaToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <ToggleRow
      icon="🎬"
      label={"END WITH “WATCH MY RELATED VIDEO” CTA"}
      help="Only turn on if you have a related video to point viewers to."
      value={value}
      onChange={onChange}
    />
  );
}

// Per-script option: a second, earlier CTA around the 60-70% mark. This used to
// always be on, which meant every script asked for a subscribe AND a comment
// twice and read like it ended twice. Now it is opt-in, and when on, the early
// one is capped at a single line with no comment prompt.
export function SoftCtaToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <ToggleRow
      icon="📉"
      label="ADD AN EARLY SOFT CTA (60-70% MARK)"
      help="Retention usually dips near the end, before your real ending lands. A one-line nudge there catches viewers who will not make it to the outro. Leave off to keep a single ask at the end."
      value={value}
      onChange={onChange}
    />
  );
}
