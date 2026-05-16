import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Script } from "@/lib/types/script";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export default async function ScriptsPage() {
  const { userId } = await auth();
  if (!userId) {
    // Proxy should prevent this, but handle gracefully
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-red-400">Not authenticated</p>
          </div>
        </div>
      </div>
    );
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("scripts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-red-400">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const scripts: Script[] = data || [];

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
            <h2 className="text-lg font-medium text-white mb-2">No scripts yet</h2>
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
                    <h3 className="text-white font-medium truncate">{script.title}</h3>
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
                    <form action={`/api/scripts/${script.id}/delete`} method="POST">
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-zinc-700/50 hover:bg-zinc-700 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </form>
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
