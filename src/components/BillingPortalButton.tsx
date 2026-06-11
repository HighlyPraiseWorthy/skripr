"use client";

export function BillingPortalButton() {
  return (
    <button
      onClick={async () => {
        const res = await fetch("/api/stripe/portal", { method: "POST" });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else if (data.redirect) window.location.href = data.redirect;
      }}
      style={{
        padding: "10px 20px",
        borderRadius: 12,
        background: "rgba(77,184,255,0.09)",
        color: "#4db8ff",
        fontSize: 13,
        fontWeight: 500,
        border: "1px solid rgba(77,184,255,0.16)",
        cursor: "pointer",
      }}
    >
      Open Billing Portal
    </button>
  );
}
