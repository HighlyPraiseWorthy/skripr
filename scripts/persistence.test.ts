// Offline test for the pure pieces of the persistence layer (the DB access itself is
// prod-only and degrades gracefully). Run:
//   node --experimental-strip-types scripts/persistence.test.ts
import { caseKey, unionFacts } from "../src/lib/case-cache.ts";
import { extractProperNouns } from "../src/lib/contamination.ts";

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) { failures++; console.log("  ✗ " + name); } else { console.log("  ✓ " + name); }
}

console.log("caseKey (pin vs picker must collide):");
const a = caseKey("Billy Queen — ATF infiltration of the Mongols MC");
const b = caseKey("Billy Queen ATF Mongols infiltration");
check("picker name and pinned name normalize to the same key", a === b);
check("distinct cases get distinct keys", caseKey("Jay Dobyns — ATF infiltration of the Hells Angels") !== a);

console.log("extractProperNouns:");
const ents = extractProperNouns(`Billy Queen used the alias "Billy St. John" to infiltrate the Mongols in the San Fernando Valley chapter. Jay Dobyns and the Hells Angels were part of Operation Black Biscuit.`);
const has = (s: string) => ents.some((e) => e.toLowerCase().includes(s.toLowerCase()));
check("captures the quoted alias Billy St. John", has("St. John"));
check("captures San Fernando Valley", has("San Fernando"));
check("captures Hells Angels", has("Hells Angels"));
check("captures Black Biscuit", has("Black Biscuit"));
check("does not capture the stopword 'The'", !ents.includes("The"));

console.log("unionFacts (version bump must not lose prior facts):");
const fresh = [{ fact: "A Mongol put a gun to his head and asked 'You a cop?'", source: "a" }, { fact: "He was a former Border Patrol agent.", source: "b" }];
const old = [{ fact: "The operation led to 54 indictments and 53 convictions.", source: "c" }, { fact: "A Mongol put a gun to his head and asked, 'You a cop?'", source: "d" }];
const merged = unionFacts([...fresh, ...old]);
check("keeps the fresh quote fact", merged.some((f) => f.fact.includes("gun to his head")));
check("recovers the prior 54/53 numbers", merged.some((f) => f.fact.includes("54 indictments")));
check("dedupes the near-identical gun fact to one", merged.filter((f) => f.fact.toLowerCase().includes("you a cop")).length === 1);
check("fresh fact wins the tie (kept first)", merged[0].source === "a");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
