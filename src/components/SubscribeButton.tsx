"use client";

import { useState } from "react";

export function SubscribeButton({ priceId, style }: { priceId: string; style?: React.CSSProperties }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!priceId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} style={style}>
      {loading ? "Redirecting…" : "Upgrade to Pro"}
    </button>
  );
}
