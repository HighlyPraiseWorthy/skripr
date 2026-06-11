"use client";
import { useState, useEffect } from "react";

const STAGES: [number, string][] = [
  [0, "Analyzing your angle..."],
  [12, "Writing the hook..."],
  [30, "Drafting story segments..."],
  [55, "Adding retention beats..."],
  [75, "Extending to full length..."],
  [90, "Polishing the script..."],
];

// No real progress signal exists (one long API call), so this simulates progress:
// an asymptotic curve that reaches ~95% at expectedMs and creeps from there.
// The page swaps phase on response, so the bar never has to fake hitting 100%.
export default function GenerationProgress({
  label,
  sub,
  expectedMs = 90000,
  fullScreen = true,
}: {
  label?: string;
  sub?: string;
  expectedMs?: number;
  fullScreen?: boolean;
}) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      setPct(Math.min(95, 95 * (1 - Math.exp((-3 * elapsed) / expectedMs))));
    }, 200);
    return () => clearInterval(id);
  }, [expectedMs]);

  const stage = [...STAGES].reverse().find(([p]) => pct >= p)?.[1] ?? STAGES[0][1];

  const inner = (
    <>
      {label && <div style={{ fontSize: 15, fontWeight: 600, color: "#4db8ff" }}>{label}</div>}
      {sub && <div style={{ fontSize: 12, color: "#7a9bb5" }}>{sub}</div>}
      <div style={{ width: 320, maxWidth: "80vw" }}>
        <div style={{ height: 8, borderRadius: 4, background: "rgba(77,184,255,0.12)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: 4,
              background: "linear-gradient(90deg, #1a8fd1, #4db8ff)",
              transition: "width 0.25s ease",
              boxShadow: "0 0 12px rgba(77,184,255,0.45)",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 12, color: "#7a9bb5" }}>{stage}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4db8ff", fontVariantNumeric: "tabular-nums" }}>
            {Math.round(pct)}%
          </span>
        </div>
      </div>
    </>
  );

  if (!fullScreen) {
    return (
      <div style={{ display: "flex", alignItems: "center", flexDirection: "column", gap: 14 }}>{inner}</div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080c12",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 14,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {inner}
    </div>
  );
}
