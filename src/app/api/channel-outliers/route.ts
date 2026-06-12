import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchChannelLongform } from "@/lib/youtube-channel";

export const maxDuration = 60;

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

    const sorted = [...scan.videos].sort((a, b) => a.views - b.views);
    const median = sorted[Math.floor(sorted.length / 2)].views || 1;

    const result = scan.videos
      .map((v) => ({ ...v, outlierX: Math.round((v.views / median) * 10) / 10 }))
      .sort((a, b) => b.outlierX - a.outlierX);

    return NextResponse.json({ channel: scan.channel, medianViews: median, videos: result });
  } catch (e: any) {
    console.error("[channel-outliers]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed to scan channel" }, { status: 500 });
  }
}
