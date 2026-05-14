"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/db/supabase";
import type { Script } from "@/lib/types/script";

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadScripts();
  }, []);

  async function loadScripts() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("scripts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setScripts(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load scripts");
    } finally {
      setLoading(false);
    }
  }

  async function deleteScript(id: string) {
    if (!confirm("Delete this script?")) return;
    setDeleting(id);
    try {
      const { error: delError } = await supabase
        .from("scripts")
        .delete()
        .eq("id", id);
      if (delError) throw delError;
      setScripts((prev) => prev.filter((s) => s.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(null);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white">My Scripts</h1>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-zinc-800/50 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">My Scripts</h1>
          <Link
            href="/scripts/new"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Script
          </Link>
        </div>

        {scripts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📝</div>
            <h2 className="text-lg font-medium text-white mb-2">
              No scripts yet
            </h2>
            <p className="text-zinc-400 mb-6">
              Generate your first viral script to get started
            </p>
            <Link
              href="/scripts/new"
              className="inline-flex px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Generate Script
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {scripts.map((script) => (
              <div
                key={script.id}
                className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-4 hover:border-zinc-600/50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium truncate">
                      {script.title}
                    </h3>
                    <div className="flex gap-3 mt-1.5 text-sm text-zinc-400">
                      {script.niche && (
                        <span className="px-2 py-0.5 bg-zinc-700/50 rounded text-xs">
                          {script.niche}
                        </span>
                      )}
                      <span>{script.word_count} words</span>
                      <span>~{script.estimated_duration}min</span>
                      <span>{formatDate(script.created_at)}</span>
                    </div>
                    {script.structure_pattern && (
                      <div className="mt-1.5">
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-xs">
                          {script.structure_pattern}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Link
                      href={`/scripts/${script.id}`}
                      className="px-3 py-1.5 text-sm text-zinc-300 hover:text-white bg-zinc-700/50 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => deleteScript(script.id)}
                      disabled={deleting === script.id}
                      className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-zinc-700/50 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deleting === script.id ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
