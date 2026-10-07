// Spot-check the cheap analyzer (Haiku) against a stronger model (Sonnet) on the same timed lines.
import { supabaseAdmin } from "../src/lib/db/supabase";
import { getTimedLines, analyzeRetention, type RetentionDNA } from "../src/lib/retention-dna";
const pick = (d: RetentionDNA) => {
  const D = d.durationSec, ev = d.events.filter((e) => e.kind !== "sponsor");
  const fq = ev.find((e) => e.kind === "question_open"); const rh = ev.filter((e) => e.kind === "rehook");
  const maj = ev.filter((e) => e.kind === "major_reveal" && e.t > D * 0.15)[0];
  return { firstQ: fq ? fq.t : null, firstRehookPct: rh[0] ? Math.round((100 * rh[0].t) / D) : null, rehooks: rh.length, minis: ev.filter((e) => e.kind === "mini_reveal").length, mainRevealPct: maj ? Math.round((100 * maj.t) / D) : null, opening: d.opening.type };
};
(async () => {
  const { data } = await supabaseAdmin!.from("viral_frameworks").select("video_id, video_title, title_formula").not("video_id", "like", "pat:%").not("video_id", "like", "fam:%").limit(5000);
  const rows = (data || []).filter((r: any) => r.title_formula?.retention).sort(() => Math.random() - 0.5).slice(0, 10);
  for (const r of rows) {
    const lines = await getTimedLines(r.video_id);
    const s = await analyzeRetention({ title: r.video_title || r.title_formula.title || "", lines, durationSec: r.title_formula.retention.durationSec, model: "claude-sonnet-4-6" });
    if (!s) { console.log(r.video_id, "sonnet failed"); continue; }
    console.log(r.video_id, "\n  haiku ", JSON.stringify(pick(r.title_formula.retention)), "\n  sonnet", JSON.stringify(pick(s)));
  }
})();
