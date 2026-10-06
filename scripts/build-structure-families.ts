// Builds the winning structure families for every niche with enough winners, plus the cross-niche set
// ("_all") that niches without enough data fall back to. Also run weekly by /api/cron/structure-families.
//   npx tsx --env-file=.env.local scripts/build-structure-families.ts
import { rebuildAllStructures } from "../src/lib/structure-families";
rebuildAllStructures({ force: true }).then((r) => console.log(JSON.stringify(r, null, 1)));
