"use client";
import { useState, useEffect } from "react";

type VoiceOption = { id: string; name: string; isActive: boolean };

// Per-script voice picker: lists the user's saved voices + Skripr Default.
// Initializes to the user's active voice; hidden when no voices are saved.
export function VoiceSelect({
  value,
  onChange,
}: {
  value: string | null; // null = not yet initialized; "default" = no voice; otherwise profile id
  onChange: (v: string) => void;
}) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/voice-profile")
      .then(r => r.json())
      .then(d => {
        const list: VoiceOption[] = d.profiles ?? [];
        setVoices(list);
        if (value === null) {
          const active = list.find(v => v.isActive);
          onChange(active ? active.id : "default");
        }
      })
      .catch(() => { if (value === null) onChange("default"); })
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded || voices.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#0d1520", border: "1px solid rgba(77,184,255,0.12)", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
      <span style={{ fontSize: 14 }}>🎙️</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#c3d9ea", letterSpacing: 0.5 }}>VOICE FOR THIS SCRIPT</span>
      <select
        value={value ?? "default"}
        onChange={e => onChange(e.target.value)}
        style={{ marginLeft: "auto", maxWidth: 240, background: "rgba(0,0,0,0.3)", color: "#e8edf5", border: "1px solid rgba(77,184,255,0.2)", borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", cursor: "pointer" }}
      >
        <option value="default">Skripr Default</option>
        {voices.map(v => (
          <option key={v.id} value={v.id}>{v.name}{v.isActive ? " ★" : ""}</option>
        ))}
      </select>
    </div>
  );
}
