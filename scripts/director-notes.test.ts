// Offline test for the auto-derived Director's notes. Pure derivation, no network,
// so the rules can be verified against a recorded fact set. Run:
//   node --experimental-strip-types scripts/director-notes.test.ts
import { deriveDirectorNotes, composeDirectorNote } from "../src/lib/director-notes.ts";

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) { failures++; console.log("  ✗ " + name); } else { console.log("  ✓ " + name); }
}
const has = (notes: { note: string }[], sub: string) => notes.some((n) => n.note.toLowerCase().includes(sub.toLowerCase()));

// The Billy Queen / Mongols fact set from the session, plus the disputed meth test
// (pasted back in) and the attributed aftermath — the exact material the reviewer
// hand-wrote notes for.
const queen = `REAL CASE THIS VIDEO IS ABOUT: Operation Five Star / ATF infiltration of the Mongols MC (Billy Queen) (1998-2000)
- ATF placed Queen undercover under the alias "Billy St. John" and he entered the San Fernando Valley chapter of the Mongols, rising from prospect to full-patch member. (source: https://en.wikipedia.org/wiki/William_Queen)
- Queen wrote that a Mongols member once held a gun to his head during a robbery dispute. (source: https://www.nytimes.com/...)
- Gang members claimed Queen snorted methamphetamine during a loyalty test, while federal authorities denied that claim; the dispute was never resolved. (source: https://www.latimes.com/...)
- The 2000 takedown resulted in 54 arrests and 53 convictions on charges including murder. (source: https://www.businessinsider.com/...)`;

console.log("Queen / Mongols fact set:");
const qn = deriveDirectorNotes({ sourceMaterial: queen, caseName: "Operation Five Star / ATF infiltration of the Mongols MC", angle: "How an ATF Agent Built Trust Inside the Mongols" });
check("attribution note (X said → keep attribution)", has(qn, "keep the attribution"));
check("disputed-point note (state both, resolve neither)", has(qn, "state both accounts"));
check("living-person allegation note (don't assert)", has(qn, "don't assert unproven"));
check("case-type: motorcycle club rank vocabulary", has(qn, "hang-around, prospect and full-patch"));
check("climax staged on the documented takedown", has(qn, "stage the climax"));
check("channel default present", has(qn, "no glamour"));
check("only ONE case-type line (no cartel/mafia bleed)", qn.filter((n) => n.source.startsWith("Case type")).length === 1);

// The climax note must follow the CHOSEN CARD'S SLOT, not default to the takedown.
console.log("slot-derived climax aim:");
const mech = deriveDirectorNotes({ sourceMaterial: queen, caseName: "Billy Queen", slot: "mechanism" });
check("mechanism card aims at the mechanism's peak, not the takedown", has(mech, "peak moment of the mechanism"));
check("mechanism card explicitly rules out the takedown", has(mech, "Not the takedown"));
const after = deriveDirectorNotes({ sourceMaterial: queen, caseName: "Billy Queen", slot: "aftermath" });
check("aftermath card aims at the cost, not the verdict", has(after, "what it did to the person"));
check("no slot falls back to the documented ending", has(deriveDirectorNotes({ sourceMaterial: queen, caseName: "Billy Queen" }), "documented ending"));

// Explainer (Kurzgesagt) shape: science rules fire, crime rules do not.
console.log("explainer / science shape:");
const sci = `- Earth's rotation carries about 2.1 x 10^29 joules of rotational kinetic energy, based on estimates from published models.
- Simulations suggest the atmosphere would continue moving at roughly 1,670 km/h at the equator.
- Researchers say the redistribution of the oceans over the following years remains debated.`;
const sciNotes = deriveDirectorNotes({ sourceMaterial: sci, caseName: "What if the Earth stopped spinning", slot: "mechanism" });
check("units rule fires for science content", has(sciNotes, "with its unit"));
check("measured-vs-modelled rule fires", has(sciNotes, "measured from modelled"));
check("no motorcycle-club rank rule on a science topic", !has(sciNotes, "hang-around"));
const scaleNotes = deriveDirectorNotes({ sourceMaterial: sci, caseName: "Earth rotation", slot: "scale" });
check("scale slot aims the peak at making numbers felt", has(scaleNotes, "numbers FELT"));
const openNotes = deriveDirectorNotes({ sourceMaterial: sci, caseName: "Earth rotation", slot: "open-question" });
check("open-question slot refuses to resolve what is open", has(openNotes, "measured versus modelled"));

// Notes must read the FACT SET, not just the slot. A "consequence" peak should only ask
// for an ordered timeline-with-timescales when the facts actually carry one — otherwise
// it sent the writer hunting for a sequence that isn't there (misfired four times).
// Proven guilt clears the "unproven allegation" note (and the Villain suppression it
// drives). Tavon White / Michael Smith pleaded guilty; the note must NOT fire.
console.log("proven guilt clears the unproven-allegation note:");
const guiltyPlea = `- Tavon White was accused of running a contraband scheme inside the jail.
- White pleaded guilty to racketeering and was sentenced.`;
check("no unproven-allegation note when the subject pleaded guilty", !has(deriveDirectorNotes({ sourceMaterial: guiltyPlea, caseName: "Tavon White" }), "don't assert unproven"));
const stillAlleged = `- He is accused of orchestrating the fraud, an allegation he denies.
- No charges have been filed and the claim remains unproven.`;
check("note still fires when the allegation is genuinely unproven", has(deriveDirectorNotes({ sourceMaterial: stillAlleged, caseName: "A living person" }), "don't assert unproven"));
// An aggregate "53 convictions" of co-defendants must NOT clear an allegation about the agent.
check("aggregate co-defendant convictions do not clear the note", has(qn, "don't assert unproven"));

// A "mechanism" slot on an EXPLAINER gets the patient-explanation note, not the crime one.
console.log("mechanism slot is kind-aware:");
const pharm = `- The compound binds the mu-opioid receptor with high affinity.
- It is roughly 40 times more potent than morphine by mass.`;
const pharmMech = deriveDirectorNotes({ sourceMaterial: pharm, caseName: "A potent opioid", slot: "mechanism", topicKind: "explainer" });
check("explainer mechanism note is patient, not a takedown scene", has(pharmMech, "explained patiently"));
check("explainer mechanism note does NOT say 'Not the takedown'", !has(pharmMech, "not the takedown"));
check("crime mechanism note is unchanged (scene, not the takedown)", has(mech, "Not the takedown"));

console.log("notes read the fact set, not just the slot:");
const noSeq = `- The compound is roughly 40 times more potent than morphine by mass.
- It binds the mu-opioid receptor with very high affinity.`;
const consNoSeq = deriveDirectorNotes({ sourceMaterial: noSeq, caseName: "A potent opioid", slot: "consequence" });
check("consequence peak does NOT demand a sequence when no fact has one", !has(consNoSeq, "documented sequence"));
check("consequence peak falls back to consequences without inventing a timeline", has(consNoSeq, "do not invent an ordered timeline"));
const withSeq = `- Within seconds of exposure the victim's breathing slows.
- Then, over the next several minutes, oxygen levels fall and the person loses consciousness.`;
const consSeq = deriveDirectorNotes({ sourceMaterial: withSeq, caseName: "Overdose timeline", slot: "consequence" });
check("consequence peak DOES ask for the sequence when the facts carry one", has(consSeq, "documented sequence"));
check("crime science rules do not fire on the Queen fact set", !has(qn, "measured from modelled"));

// The social-media / contested-literature case: correlation must not become causation.
const social = `- A 2019 study found heavy social media use was associated with higher self-reported depressive symptoms in adolescents.
- Researchers disagree about the effect size; some argue it is too small to be meaningful.
- The data is observational and based on self-report surveys.`;
const socNotes = deriveDirectorNotes({ sourceMaterial: social, caseName: "Social media and mental health", slot: "consequence" });
check("correlation-not-causation note fires on associational language", has(socNotes, "never that X causes"));
check("disputed-point note fires on a split literature", has(socNotes, "state both accounts") || has(socNotes, "disagree") || has(socNotes, "measured from modelled"));

// Contested-cause / collapsed-outcome (the Dobyns/Black Biscuit shape).
console.log("Black Biscuit shape (arson + collapse):");
const bb = `- Dobyns said his home was burned down in 2008; the arson was investigated but never definitively attributed to anyone.
- The prosecution largely collapsed and defendants pleaded to far lesser charges.`;
const bn = deriveDirectorNotes({ sourceMaterial: bb, caseName: "Operation Black Biscuit" });
check("contested-cause note (narrate, don't name a culprit)", has(bn, "do not name a culprit"));
check("collapsed-outcome note (don't imply a win)", has(bn, "don't imply a clean win"));

// No research → only the standing channel default, and the compose helper.
console.log("empty / compose:");
const empty = deriveDirectorNotes({});
check("no facts → just the channel default", empty.length === 1 && empty[0].source === "Channel default");
check("compose prepends checked notes as bullets", composeDirectorNote(["a", "b"], "extra") === "- a\n- b\nextra");
check("compose returns undefined when nothing", composeDirectorNote([], "") === undefined);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
