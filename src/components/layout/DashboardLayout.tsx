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

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();

  useEffect(() => {
    if (!userId) return;
    const stored = localStorage.getItem("skripr_active_user");
    if (stored && stored !== userId) {
      // Different user signed in — clear all skripr state
      SKRIPR_KEYS.forEach(k => localStorage.removeItem(k));
    }
    localStorage.setItem("skripr_active_user", userId);
  }, [userId]);

  return (
    <div className="flex min-h-screen bg-gray-950">
      <DashboardNav />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
