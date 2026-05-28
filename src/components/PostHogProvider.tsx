"use client";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: "https://app.posthog.com",
      capture_pageview: false,
      persistence: "localStorage",
    });
  }, []);
  return <PHProvider client={posthog}>{children}</PHProvider>;
}

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!pathname) return;
    let url = window.origin + pathname;
    if (searchParams.toString()) url += "?" + searchParams.toString();
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);
  return null;
}
