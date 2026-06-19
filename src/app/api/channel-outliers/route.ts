import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { fetchChannelLongform } from "@/lib/youtube-channel";
import { captureOutlierTitles } from "@/lib/viral-frameworks";
import { NICHES } from "@/lib/data/niches";

export const maxDuration = 60;

// Auto-classify the channel's niche from its name + top titles, so captured
// outlier titles land in the right niche pool. Cheap, best-effort, null on fail.
async function classifyNiche(channelTitle: string, titles: string[]): Promise<string | null> {
  try {
    const ids = NICHES.map((n) => n.id).join(", ");
    const msg = await new Anthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 20,
      system: "You output ONLY one niche id from the provided list, nothing else.",
      messages: [{
        role: "user",
        content: `Channel: "${channelTitle}"\nTop videos:\n${titles.slice(0, 8).map((t) => `- ${t}`).join("\n")}\n\nReturn the single best-fit niche id from this list (exact id, lowercase, no other text):\n${ids}`,
      }],
    });
    const raw = (msg.content[0]?.type === "text" ? msg.content[0].text : "").trim().toLowerCase();
    return NICHES.some((n) => n.id === raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { channel } = await req.json();
    if (!channel) return NextResponse.json({ error: "Channel URL or @handle required" }, { status: 400 });

    const scan = await fetchChannelLongform(String(channel));

    if (scan.videos.length < 4) {
      return NextResponse.json({ error: "Not enough long-form videos on this channel to compute outliers (needs 4+)" }, { status: 422 });
    }

    // Age-normalized outlier score: compare each video's VIEWS-PER-DAY against
    // the channel's median views-per-day, so a genuine recent breakout beats an
    // old video that only looks big because it's had years to accumulate views.
    const now = Date.now();
    const withVpd = scan.videos.map((v) => {
      const days = Math.max((now - new Date(v.publishedAt).getTime()) / 86400000, 1);
      return { ...v, viewsPerDay: v.views / days, ageDays: Math.round(days) };
    });
    const sortedVpd = [...withVpd].sort((a, b) => a.viewsPerDay - b.viewsPerDay);
    const medianVpd = sortedVpd[Math.floor(sortedVpd.length / 2)].viewsPerDay || 1;
    // Keep a raw-view median too (for display/context).
    const sortedViews = [...scan.videos].sort((a, b) => a.views - b.views);
    const median = sortedViews[Math.floor(sortedViews.length / 2)].views || 1;

    const result = withVpd
      .map((v) => ({ ...v, outlierX: Math.round((v.viewsPerDay / medianVpd) * 10) / 10 }))
      .sort((a, b) => b.outlierX - a.outlierX);

    // Self-improving layer: outliers are proven over-performers, so bank their
    // TITLES into the niche title pool. Classify the niche, then capture videos
    // that beat the channel median by 2x+. Awaited (Vercel kills detached work)
    // but best-effort — never fails the scan.
    try {
      const outliers = result.filter((v) => v.outlierX >= 2);
      if (outliers.length > 0) {
        const niche = await classifyNiche(scan.channel.title, outliers.map((v) => v.title));
        if (niche) {
          await captureOutlierTitles(niche, outliers.map((v) => ({ videoId: v.videoId, title: v.title, views: v.views })));
        }
      }
    } catch (e: any) {
      console.error("[channel-outliers] capture skipped:", e?.message);
    }

    return NextResponse.json({ channel: scan.channel, medianViews: median, videos: result });
  } catch (e: any) {
    console.error("[channel-outliers]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to scan channel" }, { status: 500 });
  }
}
