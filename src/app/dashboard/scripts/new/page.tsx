"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/db/supabase";

type Step = "url" | "transcript" | "generating" | "result";

interface TranscriptData {
  youtubeUrl: string;
  videoId: string;
  transcript: string;
  wordCount: number;
  estimatedDuration: number;
  segmentCount: number;
}

interface GeneratedScript {
  title: string;
  content: string;
  hook: string;
  fullScript?: string;
  sections?: unknown[];
  structurePattern?: string;
  niche?: string;
  wordCount: number;
  estimatedDuration: number;
}

export default function NewScriptPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("url");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [niche, setNiche] = useState("");
  const [topic, setTopic] = useState("");
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null);
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function extractTranscript() {
    setError(null);
    setStep("transcript");

    try {
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to extract transcript");
      }

      setTranscriptData({
        youtubeUrl,
        videoId: data.videoId,
        transcript: data.transcript,
        wordCount: data.wordCount,
        estimatedDuration: data.estimatedDuration,
        segmentCount: data.segmentCount,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to extract transcript");
      setStep("url");
    }
  }

  async function generateScript() {
    if (!transcriptData) return;
    setError(null);
    setStep("generating");

    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptData.transcript,
          niche: niche || undefined,
          topic: topic || undefined,
          sourceVideoId: transcriptData.videoId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate script");
      }

      setGeneratedScript({
        title: data.title,
        content: data.fullScript || data.content,
        hook: data.hook,
        structurePattern: data.sections?.length ? `${data.sections.length}-section` : undefined,
        niche: data.niche || niche,
        wordCount: data.wordCount,
        estimatedDuration: data.estimatedDuration,
      });
      setStep("result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate script");
      setStep("transcript");
    }
  }

  async function saveScript() {
    if (!generatedScript || !transcriptData) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/scripts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: generatedScript.title,
          content: generatedScript.content,
          niche: generatedScript.niche,
          topic: topic || null,
          wordCount: generatedScript.wordCount,
          estimatedDuration: generatedScript.estimatedDuration,
          sourceVideoId: transcriptData.videoId,
          structurePattern: generatedScript.structurePattern,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save script");
      }

      router.push("/scripts");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save script");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard/scripts"
          className="text-zinc-400 hover:text-white text-sm mb-4 inline-block"
        >
          &larr; Back to Scripts
        </Link>

        <h1 className="text-2xl font-bold text-white mb-6">New Script</h1>

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Step 1: URL Input */}
        {step === "url" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                YouTube Video URL
              </label>
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Niche (optional)
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g., fitness, tech, cooking"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Topic (optional)
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., morning routine, product review"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={extractTranscript}
              disabled={!youtubeUrl.trim()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl font-medium transition-colors"
            >
              Extract Transcript
            </button>
          </div>
        )}

        {/* Step 2: Transcript Review */}
        {step === "transcript" && transcriptData && (
          <div className="space-y-4">
            <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-4">
              <div className="flex gap-4 text-sm text-zinc-400 mb-3">
                <span>{transcriptData.wordCount} words</span>
                <span>~{transcriptData.estimatedDuration}min</span>
                <span>{transcriptData.segmentCount} segments</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {transcriptData.transcript.slice(0, 2000)}
                  {transcriptData.transcript.length > 2000 && "..."}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("url")}
                className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={generateScript}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
              >
                Generate Script
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Generating */}
        {step === "generating" && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4 animate-pulse">✨</div>
            <h2 className="text-lg font-medium text-white mb-2">
              Generating your script...
            </h2>
            <p className="text-zinc-400 text-sm">
              Analyzing transcript and crafting viral content
            </p>
          </div>
        )}

        {/* Step 4: Result */}
        {step === "result" && generatedScript && (
          <div className="space-y-4">
            <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-4">
              <div className="flex gap-2 mb-3">
                {generatedScript.niche && (
                  <span className="px-2 py-0.5 bg-zinc-700/50 text-zinc-300 rounded text-xs">
                    {generatedScript.niche}
                  </span>
                )}
                {generatedScript.structurePattern && (
                  <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-xs">
                    {generatedScript.structurePattern}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-zinc-700/50 text-zinc-300 rounded text-xs">
                  {generatedScript.wordCount} words
                </span>
                <span className="px-2 py-0.5 bg-zinc-700/50 text-zinc-300 rounded text-xs">
                  ~{generatedScript.estimatedDuration}min
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mb-3">
                {generatedScript.title}
              </h2>
              {generatedScript.hook && (
                <div className="mb-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                  <p className="text-xs text-indigo-400 font-medium mb-1">HOOK</p>
                  <p className="text-white text-sm">{generatedScript.hook}</p>
                </div>
              )}
              <div className="max-h-96 overflow-y-auto">
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {generatedScript.content}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("transcript")}
                className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-medium transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={saveScript}
                disabled={saving}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
              >
                {saving ? "Saving..." : "Save Script"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
