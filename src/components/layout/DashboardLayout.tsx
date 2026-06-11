"use client";
import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { DashboardNav } from "./DashboardNav";

const SKRIPR_KEYS = [
  "skripr_nb_state",
  "skripr_vm_state",
  "skripr_vr_state",
  "skripr_sg_state",
  "skripr_meta_saved",
];

const STARS = [
  // Top band
  { size: 2, top: "3%",   left: "22%",  delay: "0s",    dur: "4.2s" },
  { size: 2, top: "5%",   left: "38%",  delay: "1.3s",  dur: "5.8s" },
  { size: 2, top: "4%",   left: "55%",  delay: "0.6s",  dur: "3.9s" },
  { size: 2, top: "7%",   left: "68%",  delay: "2.1s",  dur: "6.4s" },
  { size: 2, top: "3%",   left: "82%",  delay: "0.4s",  dur: "4.7s" },
  { size: 2, top: "6%",   left: "94%",  delay: "1.8s",  dur: "5.2s" },
  // Upper-mid
  { size: 2, top: "14%",  left: "20%",  delay: "3.0s",  dur: "4.0s" },
  { size: 2, top: "18%",  left: "35%",  delay: "0.9s",  dur: "6.1s" },
  { size: 2, top: "12%",  left: "50%",  delay: "2.5s",  dur: "3.7s" },
  { size: 2, top: "16%",  left: "64%",  delay: "1.5s",  dur: "5.5s" },
  { size: 2, top: "20%",  left: "78%",  delay: "0.2s",  dur: "4.3s" },
  { size: 2, top: "11%",  left: "91%",  delay: "3.4s",  dur: "6.8s" },
  // Mid-upper
  { size: 2, top: "27%",  left: "25%",  delay: "1.1s",  dur: "4.9s" },
  { size: 2, top: "30%",  left: "42%",  delay: "2.8s",  dur: "3.5s" },
  { size: 2, top: "25%",  left: "57%",  delay: "0.7s",  dur: "5.9s" },
  { size: 2, top: "33%",  left: "72%",  delay: "1.9s",  dur: "4.6s" },
  { size: 2, top: "28%",  left: "86%",  delay: "0.3s",  dur: "6.2s" },
  { size: 2, top: "22%",  left: "97%",  delay: "3.7s",  dur: "5.0s" },
  // Mid
  { size: 2, top: "40%",  left: "21%",  delay: "2.2s",  dur: "3.8s" },
  { size: 2, top: "44%",  left: "37%",  delay: "0.8s",  dur: "5.4s" },
  { size: 2, top: "38%",  left: "53%",  delay: "3.1s",  dur: "4.1s" },
  { size: 2, top: "46%",  left: "67%",  delay: "1.6s",  dur: "6.5s" },
  { size: 2, top: "42%",  left: "81%",  delay: "0.5s",  dur: "3.6s" },
  { size: 2, top: "37%",  left: "95%",  delay: "2.9s",  dur: "5.7s" },
  // Lower-mid
  { size: 2, top: "54%",  left: "24%",  delay: "1.4s",  dur: "4.4s" },
  { size: 2, top: "58%",  left: "41%",  delay: "3.5s",  dur: "6.0s" },
  { size: 2, top: "52%",  left: "59%",  delay: "0.1s",  dur: "5.1s" },
  { size: 2, top: "56%",  left: "75%",  delay: "2.4s",  dur: "3.9s" },
  { size: 2, top: "60%",  left: "89%",  delay: "1.0s",  dur: "4.8s" },
  // Lower
  { size: 2, top: "68%",  left: "28%",  delay: "3.2s",  dur: "6.3s" },
  { size: 2, top: "72%",  left: "46%",  delay: "0.7s",  dur: "5.6s" },
  { size: 2, top: "66%",  left: "62%",  delay: "1.7s",  dur: "4.2s" },
  { size: 2, top: "74%",  left: "79%",  delay: "2.0s",  dur: "3.7s" },
  { size: 2, top: "70%",  left: "93%",  delay: "0.3s",  dur: "5.3s" },
  // Bottom
  { size: 2, top: "82%",  left: "32%",  delay: "3.9s",  dur: "4.5s" },
  { size: 2, top: "86%",  left: "50%",  delay: "1.2s",  dur: "6.1s" },
  { size: 2, top: "80%",  left: "66%",  delay: "2.6s",  dur: "3.8s" },
  { size: 2, top: "88%",  left: "83%",  delay: "0.9s",  dur: "5.0s" },
  { size: 2, top: "93%",  left: "44%",  delay: "1.5s",  dur: "4.3s" },
  { size: 2, top: "96%",  left: "71%",  delay: "3.3s",  dur: "6.7s" },
  // Sidebar band (left: 0-18%)
  { size: 2, top: "8%",   left: "2%",   delay: "0.5s",  dur: "4.8s" },
  { size: 2, top: "15%",  left: "11%",  delay: "2.3s",  dur: "6.1s" },
  { size: 3, top: "24%",  left: "6%",   delay: "1.1s",  dur: "3.9s" },
  { size: 2, top: "32%",  left: "14%",  delay: "3.6s",  dur: "5.3s" },
  { size: 2, top: "41%",  left: "3%",   delay: "0.8s",  dur: "4.4s" },
  { size: 3, top: "50%",  left: "9%",   delay: "2.9s",  dur: "6.6s" },
  { size: 2, top: "59%",  left: "15%",  delay: "1.4s",  dur: "3.7s" },
  { size: 2, top: "67%",  left: "5%",   delay: "0.2s",  dur: "5.9s" },
  { size: 3, top: "76%",  left: "12%",  delay: "3.1s",  dur: "4.2s" },
  { size: 2, top: "85%",  left: "7%",   delay: "1.7s",  dur: "6.0s" },
  { size: 2, top: "92%",  left: "16%",  delay: "2.5s",  dur: "4.6s" },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();

  useEffect(() => {
    if (!userId) return;
    const stored = localStorage.getItem("skripr_active_user");
    if (stored && stored !== userId) {
      SKRIPR_KEYS.forEach(k => localStorage.removeItem(k));
    }
    localStorage.setItem("skripr_active_user", userId);
  }, [userId]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080c12" }}>

      {/* ── STAR FIELD ── */}
      <style>{`
        @keyframes db-star-pulse {
          0%,100% { opacity: 0.15; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(1.3); }
        }
        .db-star {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          z-index: 9999;
          background: radial-gradient(circle, #9ce4ff 0%, #4db8ff 40%, transparent 70%);
        }
      `}</style>

      {STARS.map((s, i) => (
        <div
          key={i}
          className="db-star"
          style={{
            width: s.size,
            height: s.size,
            top: s.top,
            left: s.left,
            animationName: "db-star-pulse",
            animationDuration: s.dur,
            animationDelay: s.delay,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
          }}
        />
      ))}

      <DashboardNav />
      <main style={{ flex: 1, overflowY: "auto", minWidth: 0, position: "relative", zIndex: 1 }}>
        {children}
      </main>
    </div>
  );
}
