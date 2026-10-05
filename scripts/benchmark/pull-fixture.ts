// Freeze a topic's research from the fact library into a benchmark fixture, so card and script
// benchmarks run on identical facts every time. Usage: npx tsx scripts/benchmark/pull-fixture.ts <id> "<topic>"
import fs from "fs";
import { getLibrary } from "../../src/lib/fact-library";
const cfg = JSON.parse(fs.readFileSync("scripts/benchmark/config.json", "utf8"));
(async () => {
  const [id, topic] = process.argv.slice(2);
  const lib = await getLibrary(cfg.voiceUserId, topic);
  const facts = lib.facts.map((f: any) => ({ fact: f.fact, source: f.source || null }));
  fs.writeFileSync(`scripts/benchmark/fixtures/${id}.json`, JSON.stringify(facts, null, 1));
  console.log(id, facts.length);
})();
