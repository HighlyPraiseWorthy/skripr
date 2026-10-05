import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { fetchChannelLongform, type ChannelVideo } from "@/lib/youtube-channel";
import { NICHES } from "@/lib/data/niches";

export const maxDuration = 120;

const YT = "https://www.googleapis.com/youtube/v3";
const CANDIDATE_MAX = 16;    // candidate channels to scan before ranking by scale
const KEEP_PEERS = 8;        // comparable peers to keep after ranking
const MIN_PEERS = 4;         // if the scale filter leaves fewer than this, relax it
const OUTLIERS_PER_CHANNEL = 6;

// Age-normalized outliers for one channel (same model as the main scan): a video's
// views-per-day vs the channel's median views-per-day. Returns the >=2x titles.
function channelOutlierTitles(videos: ChannelVideo[]): { title: string; outlierX: number }[] {
  if (videos.length < 4) return [];
  const now = Date.now();
  const withVpd = videos.map((v) => {
    const days = Math.max((now - new Date(v.publishedAt).getTime()) / 86400000, 1);
    return { title: v.title, vpd: v.views / days };
  });
  const sorted = [...withVpd].sort((a, b) => a.vpd - b.vpd);
  const medianVpd = sorted[Math.floor(sorted.length / 2)].vpd || 1;
  return withVpd
    .map((v) => ({ title: v.title, outlierX: Math.round((v.vpd / medianVpd) * 10) / 10 }))
    .filter((v) => v.outlierX >= 2)
    .sort((a, b) => b.outlierX - a.outlierX)
    .slice(0, OUTLIERS_PER_CHANNEL);
}

// Discover distinct channel ids from a YouTube search, excluding the seed channel.
async function searchChannels(url: string, seedTitle: string, want: number, key: string): Promise<string[]> {
  const res = await fetch(url + `&key=${key}`);
  const data = await res.json();
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const it of data?.items || []) {
    // type=channel puts the id in id.channelId; type=video in snippet.channelId.
    const cid = it?.id?.channelId || it?.snippet?.channelId;
    const ctitle = String(it?.snippet?.channelTitle || it?.snippet?.title || "");
    if (!cid || seen.has(cid)) continue;
    if (seedTitle && ctitle.toLowerCase() === seedTitle.toLowerCase()) continue;
    seen.add(cid);
    ids.push(cid);
    if (ids.length >= want) break;
  }
  return ids;
}

// Find peer channels. Prefer a CHANNEL search in the same niche (real peer creators);
// fall back to a video search on the pattern's example titles when no niche is known.
async function findPeerChannels(niche: string | undefined, exampleTitles: string[], seedTitle: string, key: string): Promise<string[]> {
  const nicheName = niche ? (NICHES.find((n) => n.id === niche)?.name || niche) : "";
  // Cast a wide net from BOTH angles and merge: a niche channel-search (same space) AND a
  // video-search on the pattern's real example titles (channels making similar content).
  // Scale ranking downstream keeps the ones actually comparable to the seed.
  const [byNiche, byTitles] = await Promise.all([
    nicheName
      ? searchChannels(`${YT}/search?part=snippet&type=channel&maxResults=25&q=${encodeURIComponent(nicheName)}`, seedTitle, CANDIDATE_MAX, key)
      : Promise.resolve([]),
    searchChannels(`${YT}/search?part=snippet&type=video&maxResults=25&q=${encodeURIComponent(exampleTitles.slice(0, 2).join(" ").slice(0, 120))}`, seedTitle, CANDIDATE_MAX, key),
  ]);
  const ids: string[] = [];
  // Interleave the two sources so neither dominates the candidate list.
  for (let i = 0; i < Math.max(byNiche.length, byTitles.length) && ids.length < CANDIDATE_MAX; i++) {
    for (const src of [byNiche, byTitles]) {
      if (src[i] && !ids.includes(src[i]) && ids.length < CANDIDATE_MAX) ids.push(src[i]);
    }
  }
  return ids;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ error: "YouTube API not configured" }, { status: 500 });

  const { patternName, patternWhy, exampleTitles, seedChannelTitle, seedChannelSubs, niche } = await req.json();
  if (!patternName || !Array.isArray(exampleTitles) || !exampleTitles.length) {
    return NextResponse.json({ error: "patternName and exampleTitles required" }, { status: 400 });
  }

  try {
    const seedSubs = Number(seedChannelSubs) || 0;
    // "Comparable" should mean comparable in SCALE, not just topic. Drop channels far
    // smaller than the seed (a 20k compilation channel is not a peer of a 5.5M creator),
    // then keep the ones closest in subscriber count so the peer set is representative.
    const subFloor = seedSubs > 0 ? Math.max(50_000, seedSubs / 50) : 50_000;

    const peerIds = await findPeerChannels(niche, exampleTitles, String(seedChannelTitle || ""), key);
    if (!peerIds.length) {
      return NextResponse.json({ scanned: 0, matched: 0, channels: [], signal: "none", verdict: "No comparable channels surfaced for this pattern." });
    }

    // Scan candidates in parallel; keep those with their own outliers. Prefer channels of
    // comparable scale, but if the scale filter leaves too few, relax it so the peer set
    // (and the denominator) doesn't come back thin.
    const scans = await Promise.allSettled(peerIds.map((id) => fetchChannelLongform(id)));
    const withOutliers = scans
      .filter((s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchChannelLongform>>> => s.status === "fulfilled")
      .map((s) => ({ title: s.value.channel.title, subs: s.value.channel.subscribers, outliers: channelOutlierTitles(s.value.videos) }))
      .filter((p) => p.outliers.length > 0)
      .sort((a, b) => Math.abs(a.subs - seedSubs) - Math.abs(b.subs - seedSubs));
    const comparable = withOutliers.filter((p) => p.subs >= subFloor);
    const peers = (comparable.length >= MIN_PEERS ? comparable : withOutliers).slice(0, KEEP_PEERS);

    if (!peers.length) {
      return NextResponse.json({ scanned: peerIds.length, matched: 0, channels: [], signal: "weak", verdict: "Scanned comparable channels but found no clear outliers to compare against." });
    }

    // One LLM pass: does THIS pattern appear among each peer channel's outliers?
    const block = peers.map((p, i) => `Channel ${i + 1}: ${p.title}\n${p.outliers.map((o) => `  - "${o.title}" (${o.outlierX}x)`).join("\n")}`).join("\n\n");
    const prompt = `A pattern was detected on one YouTube channel. Decide whether the SAME pattern appears among the OUTLIERS of these OTHER channels — i.e. whether it repeats across channels or is specific to the original.

PATTERN: "${patternName}"${patternWhy ? ` — ${patternWhy}` : ""}

Other channels and their outlier titles:
${block}

For each channel, decide if at least one of its outliers clearly fits the pattern (judge only from the titles; be strict — a loose thematic echo is NOT a match). Return ONLY JSON, no fences:
{ "channels": [ { "title": "...", "matches": true, "matchedTitle": "the outlier title that fits, or null" } ] }`;

    const msg = await new Anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(s >= 0 && e > s ? cleaned.slice(s, e + 1) : cleaned);

    const results = (parsed?.channels || []).map((c: any) => ({
      title: String(c?.title || ""),
      matches: !!c?.matches,
      matchedTitle: c?.matchedTitle ? String(c.matchedTitle) : "",
    }));
    const scanned = peers.length;
    const matched = results.filter((c: any) => c.matches).length;
    // Signal: repeated if it shows up in a meaningful share of the peers.
    const ratio = scanned ? matched / scanned : 0;
    const signal = matched === 0 ? "channel-specific" : ratio >= 0.4 ? "repeated" : "limited";
    const verdict =
      signal === "repeated"
        ? `Observed in ${matched} of ${scanned} comparable channels — this looks like a broader content structure, not only this channel's anomaly.`
        : signal === "limited"
        ? `Observed in ${matched} of ${scanned} comparable channels — the pattern may be channel-specific or still have limited evidence outside this channel.`
        : `Observed in 0 of ${scanned} comparable channels' outliers — this may be specific to the original channel's audience.`;

    return NextResponse.json({ scanned, matched, channels: results, signal, verdict });
  } catch (e: any) {
    console.error("[cross-channel-validate]", e?.message);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
