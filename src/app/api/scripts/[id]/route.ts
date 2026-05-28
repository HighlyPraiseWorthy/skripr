import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/db/supabase";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { content?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { content, title } = body;

  // Title-only update (fast path — no versioning needed)
  if (title && !content) {
    if (typeof title !== "string" || title.trim().length === 0)
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    const { error: titleErr } = await supabaseAdmin!
      .from("scripts")
      .update({ title: title.trim() })
      .eq("id", id)
      .eq("user_id", userId);
    if (titleErr) return NextResponse.json({ error: titleErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, title: title.trim() });
  }

  if (!content || typeof content !== "string")
    return NextResponse.json({ error: "Content required" }, { status: 400 });

  const { data: current, error: fetchErr } = await supabaseAdmin!
    .from("scripts")
    .select("content, word_count, versions")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !current) return NextResponse.json({ error: "Script not found" }, { status: 404 });

  const versions = (current.versions || []) as any[];
  const snapshotLabel = versions.length === 0 ? "Original (AI Generated)" : `Edit ${versions.length}`;

  const snapshot = {
    content: current.content,
    savedAt: new Date().toISOString(),
    label: snapshotLabel,
    wordCount: current.word_count || 0,
  };

  const updatedVersions = [...versions, snapshot];
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  const updatePayload: Record<string, unknown> = { content, word_count: wordCount, versions: updatedVersions };
  if (title && typeof title === "string" && title.trim()) updatePayload.title = title.trim();

  const { error: updateErr } = await supabaseAdmin!
    .from("scripts")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", userId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, wordCount, versions: updatedVersions });
}
