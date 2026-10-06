import { NextResponse } from "next/server";
import { rebuildAllStructures } from "@/lib/structure-families";

// Daily (vercel.json cron): refresh the winning structure families from the latest Outlier / Remixer data.
// Rebuilds at most 3 niches that are over 6 days old per run, so each niche stays under a week old, the run
// fits the time limit, and repeated calls can't burn model calls (fresh niches are skipped).
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await rebuildAllStructures({ max: 3 });
  console.log("[cron] structure families:", JSON.stringify(result));
  return NextResponse.json({ result });
}
