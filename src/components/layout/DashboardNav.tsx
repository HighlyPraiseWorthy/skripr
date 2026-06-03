"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useState, useEffect } from "react";

const C = {
  bg: "#111113",
  border: "#27272a",
  text: "#f4f4f5",
  muted: "#a1a1aa",
  sub: "#71717a",
  hoverBg: "rgba(255,255,255,0.06)",
  activeBg: "rgba(139,92,246,0.15)",
  activeBorder: "rgba(139,92,246,0.25)",
  violet: "#8b5cf6",
};

const navItems = [
  {
    href: "/dashboard/scripts",
    label: "My Scripts",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
    ),
  },
  {
    href: "/dashboard/niche-bend",
    label: "Niche Bend",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M13 10V3L4 14h7v7l9-11h-7z" />
    ),
  },
  {
    href: "/dashboard/viral-remixer",
    label: "Viral Remixer",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    ),
  },
  {
    href: "/dashboard/compliance",
    label: "Compliance",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    ),
  },
  {
    href: "/dashboard/metadata",
    label: "Metadata",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    ),
  },
  {
    href: "/dashboard/educate",
    label: "Learn",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    ),
  },
];

const navLinkBase: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "8px 12px", borderRadius: 10, fontSize: 14, fontWeight: 500,
  transition: "background 120ms ease, color 120ms ease",
  cursor: "pointer", textDecoration: "none",
};

const navItemActive: React.CSSProperties = {
  ...navLinkBase, color: C.text, background: C.activeBg,
  border: `1px solid ${C.activeBorder}`,
  boxShadow: "inset 0 0 0 1px rgba(139,92,246,0.12)",
};

const navItemInactive: React.CSSProperties = { ...navLinkBase, color: C.sub };

type UsageData = { used: number; limit: number; plan: string; limitReached: boolean; isAdmin: boolean };

export function DashboardNav() {
  const pathname = usePathname();
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/user/usage").then(r => r.json()).then(setUsage).catch(() => {});
  }, [pathname]); // refetch on nav to catch updates

  const remaining = usage ? Math.max(0, usage.limit - usage.used) : null;
  const pct = usage ? Math.min(100, (usage.used / usage.limit) * 100) : 0;
  const barColor = pct >= 100 ? "#f87171" : pct >= 70 ? "#fb923c" : "#6366f1";
  const textColor = usage?.limitReached ? "#f87171" : pct >= 70 ? "#fb923c" : C.sub;

  return (
    <nav style={{
      width: 260, minHeight: "100vh", display: "flex", flexDirection: "column",
      background: C.bg, borderRight: `1px solid ${C.border}`,
    }}>

      {/* ── Logo ── */}
      <div style={{ padding: "20px 20px 14px" }}>
        <Link href="/dashboard/scripts"
          style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 55%, #ec4899 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1, letterSpacing: -0.5 }}>S</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: -0.3 }}>Skripr</span>
        </Link>
      </div>

      {/* ── Usage indicator ── */}
      <div style={{ padding: "0 20px 14px", borderBottom: `1px solid ${C.border}` }}>
        {!usage ? (
          /* skeleton while loading */
          <div style={{ height: 3, borderRadius: 3, background: "rgba(255,255,255,0.05)" }} />
        ) : usage.isAdmin ? (
          <div style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", letterSpacing: 0.3 }}>
            ∞ Unlimited
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Scripts / month
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: textColor }}>
                {usage.limitReached ? "Limit reached" : `${remaining} left`}
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3, background: barColor,
                width: `${pct}%`, transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ fontSize: 10, color: C.sub, marginTop: 5 }}>
              {usage.used} of {usage.limit} used · resets {getResetDate()}
            </div>
          </>
        )}
      </div>

      {/* ── Nav items ── */}
      <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              style={isActive ? navItemActive : navItemInactive}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = C.hoverBg;
                  (e.currentTarget as HTMLElement).style.color = C.text;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = C.sub;
                }
              }}
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"
                style={{ flexShrink: 0, width: 16, height: 16 }}>
                {item.icon}
              </svg>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: "12px 12px", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 4 }}>
        <Link href="/dashboard/settings"
          style={{ ...navLinkBase, color: C.sub, marginBottom: 4 }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = C.hoverBg;
            (e.currentTarget as HTMLElement).style.color = C.text;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = C.sub;
          }}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, width: 16, height: 16 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Settings</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10 }}>
          <UserButton appearance={{
            elements: {
              userButtonAvatarBox: { width: 28, height: 28, borderRadius: 8 },
              userButtonTrigger: { width: 28, height: 28, borderRadius: 8 },
              userButtonPopoverCard: { borderRadius: 12 },
              userButtonText: { color: "#71717a" },
            },
          }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: C.sub }}>Account</span>
        </div>
      </div>
    </nav>
  );
}

function getResetDate(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
