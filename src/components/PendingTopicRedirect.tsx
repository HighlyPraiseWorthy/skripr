"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// If the user arrives here with an idea stashed by the free Video Ideas
// Generator (survives the sign-up redirect), send them straight to the Topic
// Only screen so they can use it right away. The new-script page reads and
// clears the stash and prefills the topic.
export default function PendingTopicRedirect() {
  const router = useRouter();
  useEffect(() => {
    try {
      const t = localStorage.getItem("skripr_pending_topic");
      if (t && t.trim()) router.replace("/dashboard/scripts/new");
    } catch {}
  }, [router]);
  return null;
}
