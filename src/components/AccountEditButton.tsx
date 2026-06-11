"use client";
import { useClerk } from "@clerk/nextjs";

export function AccountEditButton() {
  const { openUserProfile } = useClerk();
  return (
    <button
      onClick={() => openUserProfile()}
      style={{
        fontSize: 12, fontWeight: 600, color: "#4db8ff",
        textDecoration: "none", padding: "6px 14px", borderRadius: 8,
        background: "rgba(77,184,255,0.08)", border: "1px solid rgba(77,184,255,0.16)",
        cursor: "pointer",
      }}
    >
      Edit →
    </button>
  );
}
