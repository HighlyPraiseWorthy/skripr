// Regression guard: deterministic parts of the fact pass and late cleanup.
import { weaveBeats, budgetByFacts, dropOpeningEchoes, sceneFactsOwnedElsewhere, findCutSeams, reconcileTitle, SUBJECTLESS_RE, unsupportedAgeSentences, supportedAgeSentences, repeatedFigures, repeatedShapes, overusedOpeners } from "../src/lib/ai/claude";
import { stripStutters, stripDividers, fixDanglingBackrefs, unsourcedQuotes, unquoteUnsourced, fixQuoteWordCounts, superlativeMismatches, stripLeaningFragments, restoreSuperlativeQualifiers, balanceQuotes, fixOrphanedItSays, dedupeEndingDates, stripPipelineWords, misattributedPhrases, quoteBalanceKept, fixWeekdayDates, attributionMismatch, introducesUnsupportedName, ageYearMismatches, stripStoryMeta, expandNounContractions, eventYearMismatches, retoldFacts, introducesPipelineWords, repeatedFigureExplanations, foreverContradicted, minorsInFacts, replaceMinorNames, replaceFamilyNames, tagFactSources, unsupportedGroupWords, dropForeverAdverbs, unlinkedFigures, fixMostWantedWording, groundedInFacts, hookCraftIssues } from "../src/lib/script-compliance";
const facts = "Freshwaters fatally struck a 24-year-old pedestrian in 1957. He was arrested May 4, 2015.";
const ages = unsupportedAgeSentences(["Just a man in his eighties at a home.", "Eugene Flynt was 24 years old.", "He was a man in his early twenties then.", "No age here."], facts);
const st = stripStutters("What they were working against was not just time. What they were working against was not just time, it was a case. Your one page. Your one page.");
const checks: [string, boolean][] = [
  ["guessed age 'in his eighties' flagged", ages.includes(0)],
  ["age the facts give (24) not flagged", !ages.includes(1)],
  ["'early twenties' matches a fact age of 24", !ages.includes(2)],
  ["no age -> not flagged", !ages.includes(3)],
  ["prefix stutter collapsed to the longer sentence", st.text.startsWith("What they were working against was not just time, it was a case.") && st.cuts.length === 1],
  ["short refrain untouched", st.text.endsWith("Your one page. Your one page.")],
];
checks.push(["leaked --- divider removed", stripDividers("A.\n\n---\n\nB.").text === "A.\n\nB."]);
checks.push(["dangling 'What it shows' lead-in stripped", fixDanglingBackrefs("The unit got to work. What it shows is the direction: the unit traced him to Florida.").text.endsWith("The unit traced him to Florida.")]);
checks.push(["real 'does not say X. What it shows' pair kept", fixDanglingBackrefs("The record does not say how. What it shows is that he stayed.").text.includes("What it shows")]);
const wf = "The FBI notice described Wright as born March 29, 1943. He killed Walter Patterson on November 23, 1962.";
checks.push(["birth-date math supports 'nineteen years old'", supportedAgeSentences(["Wright was nineteen years old."], wf).includes(0)]);
checks.push(["birth-date math rejects 'thirty years old' in 1962", unsupportedAgeSentences(["Wright was thirty years old."], wf).includes(0)]);
const qf = 'Freshwaters said he had not done anything wrong and had made a mistake. The governor cited a "flawless 16-year residency".';
checks.push(["invented quote flagged", unsourcedQuotes('"I Made a Mistake." 56 Years Later', qf).length === 1]);
checks.push(["real quote passes", unsourcedQuotes('He called it a "flawless 16-year residency" there.', qf).length === 0]);
checks.push(["script: invented quote loses its quote marks, keeps words", unquoteUnsourced('He told them "I regret nothing at all" that day.', qf).text === "He told them I regret nothing at all that day."]);
checks.push(["'Two words' about 'You got me.' corrected to three", fixQuoteWordCounts('He said, "You got me." Two words.').text.endsWith("Three words.")]);
checks.push(["'three words:' before a 5-word quote -> five", fixQuoteWordCounts('He said "no" twice. It was three words: "I just hopped a fence." Then she left.').text.includes("five words:")]);
checks.push(["single-quoted fake quote flagged", unsourcedQuotes("said, 'he said he hadn't seen that guy,' then left", qf).length === 1]);
checks.push(["apostrophes in words are not quotes", unsourcedQuotes("He hadn't left. It wasn't over.", qf).length === 0]);
checks.push(["backref 'is that A, and that B' -> 'A, and B'", fixDanglingBackrefs("The unit worked. What the record does show is that the board met, and that the two agreed on it.").text.endsWith("The board met, and the two agreed on it.")]);
const gsrc = 'The Guardian reported "he became the object of the longest successful manhunt in the history of the marshal\'s service."';
checks.push(["superlative scope drift flagged", superlativeMismatches("The Longest Fugitive Hunt in U.S. Marshals History", gsrc).length === 1]);
checks.push(["exact superlative passes", superlativeMismatches("the longest successful manhunt in Marshals history", gsrc).length === 0]);
checks.push(["near-duplicate sentence collapsed", stripStutters("A man under an open Ohio warrant, wanted since 1959, lived so quietly that the governor declined to send him back. A man under an open Ohio warrant lived so quietly that the governor declined to send him back, and called it a credential.").cuts.length === 1]);
checks.push(["parallel-but-different sentences kept", stripStutters("He walked out of the camp that night. He walked into a different life that year.").cuts.length === 0]);
checks.push(["orphaned 'X is not.' removed", stripLeaningFragments("The numbers were measured. The full accounting is not. Prices rose.").cuts.length === 1]);
checks.push(["real 'A is X. B is not.' pair kept", stripLeaningFragments("The cost is documented. The full accounting is not.").cuts.length === 0]);
checks.push(["repeated exact figure found", repeatedFigures(["He forfeited $8,091,843.64 in total.", "Later, $8,091,843.64 was agreed."]).length === 1]);
checks.push(["kicker shape x3 found", repeatedShapes(["It wasn't a hack.", "It was a factory.", "It wasn't luck.", "It was a system.", "That wasn't random.", "It was a plan."]).length >= 1]);
checks.push(["'I believe' x6 flagged as overused", overusedOpeners(Array.from({length: 40}, (_, i) => i % 6 === 0 ? "I believe this mattered a lot." : `Sentence number ${i} ran here.`)).some((t) => t.opener === "i believe")]);
checks.push(["'two words' 5 sentences after 'You got me' -> three", fixQuoteWordCounts('Then: "You got me." He was held. The alias dissolved. It stopped. No fight. And two words that said everything.').text.includes("three words")]);
checks.push(["dropped 'successful' restored", restoreSuperlativeQualifiers("call it the longest manhunt in history", gsrc).text === "call it the longest successful manhunt in history"]);
checks.push(["correct superlative not doubled", restoreSuperlativeQualifiers("the longest successful manhunt", gsrc).text === "the longest successful manhunt"]);
checks.push(["unclosed quote closed", balanceQuotes('Then he said, "You got me.\n\nNext.').text.startsWith('Then he said, "You got me."')]);
checks.push(["balanced quotes untouched", balanceQuotes('He said "a mistake." Done.').cuts.length === 0]);
checks.push(["'then he was not.' no longer hides a dangling 'What it shows'", fixDanglingBackrefs("He was held, and then he was not. What it shows is that he vanished again.").text.endsWith("He vanished again.")]);
checks.push(["orphaned 'It says' repaired", fixOrphanedItSays("He was gone again. It says he vanished.").text.endsWith("He vanished.")]);
checks.push(["'It says' after a real report kept", fixOrphanedItSays("The report is brief. It says he left.").cuts.length === 0]);
checks.push(["ending date stated twice -> once", dedupeEndingDates("A.\n\nHe was released on June 15, 2016.\n\nHe walked out on June 15, 2016.").cuts.length === 1]);
checks.push(["'the sourced reporting' -> 'the reporting'", stripPipelineWords("The sourced reporting leaves that silent.").text === "The reporting leaves that silent."]);
checks.push(["ordinary 'approved'/'cited' untouched", stripPipelineWords("The board approved parole. He cited sources.").cuts.length === 0]);
{ const F = ['The Guardian reported that "he became the object of the longest successful manhunt in the history of the marshal\'s service."'];
  checks.push(["Guardian phrase credited to the Marshals -> flagged", misattributedPhrases(["The Marshals called it the longest successful manhunt in its history."], F).length === 1]);
  checks.push(["credited to The Guardian -> passes", misattributedPhrases(["The Guardian called it the longest successful manhunt in the history of the marshal's service."], F).length === 0]); }
{ const bp = [
    { assignedFacts: ['Deputy Marshal Steve Jurman said she kept asking, "Are you sure you have to take me?" in the front yard.', "Her thumbprint on a California driver's license under the name Marie Walsh matched Michigan records."] },
    { assignedFacts: ['LeFevre asked agents "Are you sure you have to take me?" when they arrived.', "The thumbprint on her California driver's license under the name Marie Walsh matched Michigan prison records.", "An anonymous online tip reached Michigan officials in 2008."] },
    { assignedFacts: ["She married Alan Walsh in the mid-1980s in Orange County."] },
  ];
  const n = dropOpeningEchoes(bp);
  checks.push(["cold-open quote + restated thumbprint dropped from later beat", n === 2 && bp[1].assignedFacts.length === 1 && bp[1].assignedFacts[0].includes("anonymous")]);
  checks.push(["unrelated later facts kept", bp[2].assignedFacts.length === 1 && bp[0].assignedFacts.length === 2]); }
{ const bp = [
    { assignedFacts: ["LeFevre was a 19-year-old community college student from Thomas Township with no criminal record."] },
    { assignedFacts: ["LeFevre, a 19-year-old community college student with no criminal record, was arrested with Richard A. Anderson in an undercover sting and charged with selling about three grams of heroin worth $200."] },
  ];
  checks.push(["later fact adding the charge survives a shared-setup opening fact", dropOpeningEchoes(bp) === 0]); }
{ const rt = reconcileTitle("The Fugitive Mom: 32 Years Hidden", "She escaped in 1976. She was found 32 years later in 2008. Her husband said it happened 34 years ago in 1974. A neighbor born in 1968 spoke.");
  checks.push(["title duration the facts state (32 years) is kept", rt.includes("32 Years")]);
  const rt2 = reconcileTitle("After 4 Years Spotify Finally Caught Them", "The scheme began in 2017. He was arrested in 2024.");
  checks.push(["unsupported title duration still corrected", rt2.includes("7 Years")]); }
checks.push(["'Said they had the wrong person.' leans on the sentence before", SUBJECTLESS_RE.test("Said they had the wrong person.") && !SUBJECTLESS_RE.test("She said they had the wrong person.") && !SUBJECTLESS_RE.test("Saidee was there.")]);
{ const beats = [
    { point: "The woman neighbors called the ideal mom was, in the same instant, a wanted fugitive who had been running for 32 years" },
    { point: "She pleaded guilty expecting probation; what she got was ten to twenty years" },
    { point: "It was not sophisticated police work that caught her, it was one tip, confirmed by the thumbprint on her own driver's license" },
  ];
  const r = sceneFactsOwnedElsewhere([
    "Authorities said an anonymous caller tipped Michigan officials to her location, and marshals confirmed her identity through a thumbprint on her California driver's license.",
    "U.S. marshals arrested Susan LeFevre outside her home in San Diego's Carmel Valley neighborhood.",
    "Deputy U.S. Marshal Steve Jurman arrested LeFevre, and LeFevre said, 'That was the day I answered the door.'",
  ], beats);
  checks.push(["scene fact that IS a later beat's point (tip + thumbprint) left to that beat", r.moved.length === 1 && r.moved[0].includes("anonymous") && r.keep.length === 2]); }
checks.push(["rewrite adding a quote mark inside a multi-sentence quote refused", !quoteBalanceKept('I\'ve got to adjust a little bit here," she said.', 'LeFevre told reporters: "I\'ve got to adjust a little bit here."') && quoteBalanceKept('He said "no."', 'Siler said "no."')]);
checks.push(["pronoun speaker not judged as misattribution", misattributedPhrases(['She said she had to adjust a little bit here.'], ["LeFevre said she had to adjust a little bit here."]).length === 0]);
checks.push(["re-worded restatement with the same opening collapsed", stripStutters("She was a teenager caught in an undercover sting alongside her boyfriend, Richard A. Anderson, that February. She was a teenager who got swept into an undercover sting alongside her boyfriend, Richard A. Anderson. The operation worked.").cuts.length === 1]);
checks.push(["parallel lines with different content kept", stripStutters("She was a student at a community college in Saginaw County that year. She was a waitress at a crepe restaurant in San Diego after the escape.").cuts.length === 0]);
checks.push(["'So was the one...' leans on the sentence before", SUBJECTLESS_RE.test("So was the one she'd handed to them.")]);
{ const F = "She walked out about 8 a.m. Tuesday, May 19, 2009. The Buick pulled in at 12:15 a.m. Wednesday.";
  checks.push(["impossible 'Wednesday, May 19, 2009' -> weekday kept (facts use it)", fixWeekdayDates("At 12:15 a.m. on Wednesday, May 19, 2009, the car pulled in.", F).text === "At 12:15 a.m. on Wednesday, the car pulled in."]);
  checks.push(["correct 'Tuesday, May 19, 2009' untouched", fixWeekdayDates("On Tuesday, May 19, 2009, she walked out.", F).cuts.length === 0]);
  checks.push(["unsupported weekday dropped, date kept", fixWeekdayDates("On Friday, April 24, 2008, they came.", F).text === "On April 24, 2008, they came."]); }
{ const beats = [
    { point: "The collision of two identities in a single doorway", assignedFacts: [] as string[] },
    { point: "Thirty years of concealment was undone by one call", assignedFacts: ["An anonymous online tip led Michigan officials to her, and investigators matched the thumbprint on her California driver's license."] },
  ];
  const r = sceneFactsOwnedElsewhere(["Authorities acted on an anonymous online tip and then matched LeFevre to California driver's license thumbprint records.", "The reports describe LeFevre planting flowers in her garden when agents arrived."], beats);
  checks.push(["scene fact already held by a later beat's facts stays there", r.moved.length === 1 && r.keep.length === 1 && r.keep[0].includes("garden")]); }
checks.push(["'The kind that tears.' leans on the sentence before", SUBJECTLESS_RE.test("The kind that tears.")]);
{ const before = "They married in 1986. Three children followed. A few months before the marshals came, she told him. Not years before, not at the start. Then came the tip.\n\nThe board voted yes.";
  const after = "They married in 1986. Three children followed. Not years before, not at the start. Then came the tip.\n\nThe board voted yes.";
  const sm = findCutSeams(before, after);
  checks.push(["cut seam found with both neighbors", sm.length === 1 && sm[0].removed[0].startsWith("A few months") && sm[0].prev === 1 && sm[0].next === 2]);
  const rw = findCutSeams("A. He ran. B.", "A. He fled. B.");
  checks.push(["a rewrite is not a seam", rw.length === 0]); }
{ const F = ["Jones told authorities that following a trading mistake, he had been forced to sell his seat to pay his debt.", "His former wife told investigators that Jones had gambling debts and once bet $30,000 on a single basketball game."];
  const o = "He sold it because the gambling had stripped him down to that last asset.";
  checks.push(["rewrite crediting Jones with his wife's gambling account refused", !!attributionMismatch(o, "According to Jones, the gambling had consumed everything underneath him, forcing him to sell his seat.", F)]);
  checks.push(["rewrite crediting the wife with the gambling account allowed", !attributionMismatch(o, "His former wife told investigators it was gambling debts that had driven him there.", F)]);
  checks.push(["two speakers, each with their own claim, allowed", !attributionMismatch(o, "Jones told authorities a trading mistake had forced the sale; his former wife told investigators it was gambling debts.", F)]); }
{ const f = (n: number) => Array.from({ length: n }, (_, k) => `fact ${k}`);
  const b = budgetByFacts([{ targetWords: 300, assignedFacts: f(6) }, { targetWords: 500, assignedFacts: f(2) }, { targetWords: 300, assignedFacts: f(10) }, { targetWords: 300, assignedFacts: f(8) }], 1400);
  checks.push(["thin beat (2 facts, 500 words) capped at what its facts carry", b[1].targetWords === 200]);
  checks.push(["the excess goes to beats with facts to spare, total kept", b[2].targetWords > 300 && b.reduce((a, x) => a + x.targetWords, 0) === 1400]);
  const ok = budgetByFacts([{ targetWords: 200, assignedFacts: f(4) }, { targetWords: 200, assignedFacts: f(4) }], 400);
  checks.push(["well-fed beats untouched", ok[0].targetWords === 200 && ok[1].targetWords === 200]); }
{ const F = "Clifton Goodenough is a nurse at a Phoenix veterans hospital. Jones worked at the Rampart Casino in Las Vegas.";
  checks.push(["late rewrite inventing a name ('Ed') refused", introducesUnsupportedName("It knew only what the filings showed.", "Ed was a Phoenix nurse with undeclared Nevada income.", F) === "Ed"]);
  checks.push(["rewrite using research names allowed", introducesUnsupportedName("He was a nurse.", "Goodenough was a nurse in Phoenix.", F) === null]);
  checks.push(["'his own' is not a speaker", !attributionMismatch("He left Chicago.", "In his own words said he left Chicago behind.", ["A criminal complaint described Jones as fleeing Chicago."])]);
  checks.push(["'Four felony charges.' + 'Four felony charges: ...' collapsed", stripStutters("Four felony charges. Four felony charges: identity theft and fraud, each count separate.").cuts.length === 1]);
  checks.push(["'One game. One game.' refrain kept", stripStutters("He bet it all. One game. One game.").cuts.length === 0]); }
{ const F = "Arthur Gerald Jones, 73, was sentenced on January 31, 2012.\nA 73-year-old former Chicago man was ordered in 2012 to pay restitution.\nTheir daughter Maureen, 23, rode home with them in May 2009.";
  checks.push(["'In May 2008, a 73-year-old' flagged (about 69 then)", (() => { const m = ageYearMismatches(["In May 2008, a 73-year-old man walked into a DMV office."], F); return m.length === 1 && m[0].expected === 69; })()]);
  checks.push(["'a 73-year-old ... in 2012' fits", ageYearMismatches(["In 2012, a 73-year-old man was sentenced."], F).length === 0]);
  checks.push(["another person's age (23 in 2009) fits", ageYearMismatches(["In 2009 Maureen, 23, rode home."], F).length === 0]); }
checks.push(["'Approximately' opening a rewrite is not a name", introducesUnsupportedName("About $11,400 goes to him.", "Approximately $11,400 goes to Clifton Goodenough.", "Clifton Goodenough is a nurse.") === null]);
checks.push(["'O'Hare' in a rewrite is not an invented name", introducesUnsupportedName("His car was found.", "His silver Buick was found near O'Hare.", "Investigators found his silver Buick near O'Hare International Airport.") === null]);
{ const body = [
    "In May 2008, a man walked into a DMV office in Henderson, Nevada to renew his driver's license and handed over a Social Security number belonging to someone else.",
    "On July 19, 2011, state and federal investigators arrested him at the casino sports book where he worked under the name Joseph Richard Sandelli.",
    "In April 1979, a fellow commodities trader was shot and killed in his suburban home, and court papers say Jones took off shortly after to get a fresh start.",
    "May 10, 1979. Jones rushed out the door of the Highland Park house in a tennis shirt and slacks, telling his wife Joanne the meeting was not in a business office.",
    "That's all she got.",
    "In 1988, the Nevada DMV issued Jones a driver's license under the Sandelli alias and Goodenough's Social Security number, and he worked casino sports books for years.",
    "January 31, 2012. District Judge James Bixler sentenced Jones to probation and ordered restitution to the Social Security Administration and to Goodenough.",
    "That's where the story ends. At a DMV window.",
  ].join("\n\n");
  const irs = "From 1995 onward, casino wages under Goodenough's Social Security number reached his IRS records, and the IRS garnished the Phoenix nurse's wages over Nevada income.";
  const out = weaveBeats(body, [irs]).split("\n\n");
  const at = out.indexOf(irs);
  checks.push(["refill paragraph dated 1995 lands after the 1988 Nevada paragraph, not in the 1979 scene or the cold open", at === 6]); }
checks.push(["'in 2008, he was 73 years old' flagged", ageYearMismatches(["When investigators caught up with him in 2008, he was 73 years old."], "Arthur Gerald Jones, 73, was sentenced on January 31, 2012.\nA 73-year-old former Chicago man was ordered in 2012 to pay restitution.").length === 1]);
{ const t = expandNounContractions("The criminal complaint'd later describe him. Jones's monthly benefits'd carry the debt. The charging documents'd finally attached to him. He'd left. It'd hold.").text;
  checks.push(["noun contractions expanded (would / had), pronouns kept", t === "The criminal complaint would later describe him. Jones's monthly benefits would carry the debt. The charging documents had finally attached to him. He'd left. It'd hold."]);
  const m = stripStoryMeta("He walked out. What comes after belongs to the next part of this story. Which is the harder question the second half of this story has to answer. He was gone.");
  checks.push(["'next part of this story' narration removed", m.cuts.length === 2 && m.text === "He walked out. He was gone."]); }
{ const F = "Investigators began looking at Jones in May 2008, when he went to a Henderson DMV office.\nArthur Gerald Jones was arrested on July 19, 2011 by state and federal investigators.\nHe pleaded guilty in September 2011.\nA court declared Arthur Jones legally dead in 1986.";
  const S = ["July 2008.", "State and federal investigators arrive at the Rampart casino.", "Investigators arrested him on four felony charges.", "September 2011.", "He pleaded guilty to one count.", "In 1986 an Illinois court declared him dead."];
  const m = eventYearMismatches(S, F);
  checks.push(["arrest under a 'July 2008.' dateline flagged (research: 2011)", m.length === 1 && m[0].i === 2 && m[0].research === 2011]);
  checks.push(["correct plea and declared-dead years pass", !m.some((x) => x.i === 4 || x.i === 5)]); }
{ const paras = [
    ["He went to a friend in Chicago and paid $800.", "For that, he got three documents: a fake Illinois driver's license, a fake birth certificate, and a fake Social Security card.", "The Social Security number belonged to a real person, Clifton Goodenough, a nurse who'd one day work at a veterans hospital in Phoenix, Arizona."],
    ["California first. Then Florida.", "Sometime in the 1980s, he stopped moving and landed in Las Vegas, working first at the Desert Inn and then at a sports book."],
    ["He was a nurse at a veterans hospital in Phoenix, Arizona.", "And every year starting in 1995, the IRS came after him for income he'd never earned."],
    ["Here's where Goodenough's number came from.", "In 1979, Jones paid $800 for three documents in Chicago.", "Jones used that number to get a Nevada driver's license in 1988 under the Sandelli name."],
    ["Goodenough got $11,400 for thirteen years of wage garnishments, and Jones paid $800 for three documents in Chicago."],
  ];
  const sents = paras.flat(); const paraOf = paras.flatMap((p, k) => p.map(() => k));
  const r = retoldFacts(sents, paraOf);
  checks.push(["re-told $800 purchase and Goodenough intro found", r.some((x) => sents[x.i].startsWith("In 1979, Jones paid $800")) && r.some((x) => sents[x.i].startsWith("He was a nurse"))]);
  checks.push(["new fact (1988 Nevada license) not flagged; final-paragraph callback exempt", !r.some((x) => sents[x.i].includes("1988") || sents[x.i].startsWith("Goodenough got"))]); }
checks.push(["rewrite adding 'the research doesn't explain the gap' refused", introducesPipelineWords("More than $78,600 goes to the SSA.", "More than $78,600 goes to the SSA; other reports put it at $47,000, and the research doesn't explain the gap.")]);
checks.push(["'reports differ' is fine", !introducesPipelineWords("More than $78,600 goes to the SSA.", "More than $78,600 goes to the SSA; earlier reports put it at $47,000.")]);
{ const m = stripStoryMeta("He moved through California and Florida. The record says almost nothing about those early stops. By the time he went still, he went still in Las Vegas. The record shows Jones paid $800 for the papers.");
  checks.push(["'The record says almost nothing...' cut; 'The record shows X' keeps X", m.text === "He moved through California and Florida. By the time he went still, he went still in Las Vegas. Jones paid $800 for the papers."]);
  checks.push(["Nevada's records / court records untouched", stripStoryMeta("Nevada's records had a name for him. Court records show he pleaded guilty.").cuts.length === 0]); }
{ const S = ["The SSA paid his family $47,000.", "More than $78,600 went to the SSA, the court's figure; the benefits paid to the family totaled $47,000.", "He went home.", "What one report put at $47,000, with the order set at more than $78,600, he would repay."];
  const r = repeatedFigureExplanations(S);
  checks.push(["the $47,000 vs $78,600 gap explained twice is found", r.length === 1 && r[0].idx.join(",") === "1,3"]); }
{ const F = "Arthur Gerald Jones was arrested on July 19, 2011 by state and federal investigators.";
  const S = ["May 2008. That was the month Jones walked into a Henderson DMV office.", "That's the move that ended it.", "No informant's tip.", "No surveillance.", "A man at a counter.", "The renewal was the latest record.", "A current address.", "A living man.", "When state and federal investigators arrested him on July 19, thirty-two years after he vanished, he was working at the Rampart."];
  const m = eventYearMismatches(S, F);
  checks.push(["'arrested him on July 19' with no year after a 2008 section flagged (research: 2011)", m.length === 1 && m[0].missingYear === true && m[0].research === 2011 && m[0].i === 8]);
  checks.push(["'arrested on July 19, 2011' passes", eventYearMismatches(["May 2008.", "He renewed.", "a", "b", "c", "d", "e", "f", "They arrested him on July 19, 2011."], F).length === 0]); }
{ const m = stripStoryMeta("The court ordered more than $78,600 repaid, a higher figure than the $47,000 reported paid to the family, and reports don't explain the gap. He was gone.");
  checks.push(["'and reports don't explain the gap' clause removed, sentence kept", m.text === "The court ordered more than $78,600 repaid, a higher figure than the $47,000 reported paid to the family. He was gone."]);
  checks.push(["rewrite adding 'reports don't explain' refused", introducesPipelineWords("It was $78,600.", "It was $78,600, and reports don't explain why.")]); }
checks.push(["'Court records don't say where he went.' left whole (not a trailing clause)", stripStoryMeta("Court records don't say where he went.").text === "Court records don't say where he went."]);
{ const F = "Hannah Price was seventeen years old on the morning her father stood over her weeping before he vanished.\nHis oldest son Nathan said he was his hero.\nPrice was arrested on December 31, 2013 during a traffic stop.";
  checks.push(["minor detected with relationship", JSON.stringify(minorsInFacts(F)) === JSON.stringify([{ name: "Hannah Price", first: "Hannah", relation: "his daughter" }])]);
  checks.push(["minor's name replaced, incl. possessive and sentence start; adult son kept", replaceMinorNames("He went to Hannah's room. Hannah Price said he was her best friend. Nathan watched.", F).text === "He went to his daughter's room. His daughter said he was her best friend. Nathan watched."]);
  checks.push(["'disappeared forever' flagged when the research has an arrest", foreverContradicted("The night before he disappeared forever, he watched a film.", F) === "disappeared forever"]);
  checks.push(["'disappeared forever' fine when he was never found", foreverContradicted("He disappeared forever.", "He was last seen in 1971. His case remains unsolved.") === null]); }
{ const F = "The night before Price left for good, he watched Braveheart with his oldest son Nathan.\nJim Price told Bethea that his son Lee picked vegetables all day.\nRebekah, his wife, filed papers.\nPrice wrote in his memoir that he planned to jump from the ferry.\nPrice was arrested on December 31, 2013.";
  // Policy 2026-10-05: only minors at the time stay anonymous; adult family on the record keep their names.
  checks.push(["card: adult family names kept under the minors-only policy", replaceFamilyNames("Lee Price watched Braveheart with his oldest son Nathan. Rebekah Price filed papers.", F, "Aubrey Lee Price").text === "Lee Price watched Braveheart with his oldest son Nathan. Rebekah Price filed papers."]);
  const tagged = tagFactSources(F, "Aubrey Lee Price").split("\n");
  checks.push(["memoir fact tagged as his own account", tagged[3].startsWith("[his own account]")]);
  checks.push(["father's quote tagged as family account, not his", tagged[1].startsWith("[family account]")]);
  checks.push(["arrest fact untagged", !tagged[4].startsWith("[")]);
  checks.push(["'vanished into thin air' contradicted by the arrest", !!foreverContradicted("The Preacher Who Vanished Into Thin Air", F)]);
  checks.push(["'January 2008. In January 2008,' dateline echo dropped", stripStoryMeta("He moved on. January 2008. In January 2008, he opened PFG.").text === "He moved on. In January 2008, he opened PFG."]);
  checks.push(["leaked [his own account] tag removed", stripStoryMeta("[his own account] He planned to jump.").text === "He planned to jump."]); }
checks.push(["'his own flock' / 'congregation' flagged when the research says 'many of whom came through his church'", unsupportedGroupWords("The Preacher Who Robbed His Own Flock and his congregation", "More than a hundred of his clients, many of whom had come through his church.").join(",") === "congregation,flock"]);
checks.push(["'What the record does show: X' keeps X", stripStoryMeta("What the record does show: he surfaced again in Georgia.").text === "He surfaced again in Georgia."]);
checks.push(["'That's all the record gives from those months.' cut", stripStoryMeta("He wrote about a rock. That's all the record gives from those months, one image. He came back.").text === "He wrote about a rock. He came back."]);
{ const { deriveDirectorNotes } = require("../src/lib/director-notes");
  const n = deriveDirectorNotes({ sourceMaterial: "- Prosecutors said he lost approximately $16 million; investors estimated losses.", topicKind: "event" });
  checks.push(["no 'Science accuracy' on a true-crime event; 'Number accuracy' instead", !n.some((x: any) => x.source === "Science accuracy") && n.some((x: any) => x.source === "Number accuracy")]); }
checks.push(["'left for good' -> 'left' when the research has him arrested", dropForeverAdverbs("The night before he left for good, he watched a film.", "Price was arrested on December 31, 2013.").text === "The night before he left, he watched a film."]);
{ const F = "Since its inception, PFG had raised $40 million from investors, $36.9 million of which went into a trading account at Goldman Sachs; when the account was closed in mid-May of 2012, only $480,000 was left.\nThe FBI listed Price as one of their most wanted fugitives.";
  checks.push(["'$40M ... $480,000 of it was left' flagged (ties through $36.9M)", unlinkedFigures("He raised $40 million, and by May 2012, $480,000 of it was left.", F).length === 1]);
  checks.push(["'$36.9 million ... $480,000 remained' passes", unlinkedFigures("$36.9 million went into one account; when it closed, $480,000 remained.", F).length === 0]);
  checks.push(["'placed him on their most wanted list' -> research wording", fixMostWantedWording("The FBI placed him on their most wanted list.", F).text === "The FBI listed him as one of its most wanted fugitives."]);
  const { deriveDirectorNotes } = require("../src/lib/director-notes");
  const notes = deriveDirectorNotes({ sourceMaterial: "- Hannah Price was seventeen years old when her father left.\n- Price wrote in his memoir that he planned to jump.\n- Some restitution details were still unresolved at sentencing.", caseName: "Aubrey Lee Price", topicKind: "event" });
  checks.push(["case rules (attribution + family/minor) present without any angle call", notes.filter((n: any) => n.source === "Case rule").length === 2]);
  checks.push(["procedural 'restitution unresolved' not picked as the dispute", !notes.some((n: any) => /restitution/.test(n.note))]); }
{ const F = "Price was arrested during a traffic stop in Glynn County on December 31, 2013.\nPFG raised $40 million, $36.9 million of which went into a Goldman Sachs trading account; only $480,000 was left.";
  checks.push(["grounded payoff beat passes", groundedInFacts("the New Year's Eve traffic stop in Glynn County", F) && groundedInFacts("the Goldman account falling from $36.9 million to $480,000", F)]);
  checks.push(["promised material the research lacks fails", !groundedInFacts("real, sourced quotes from family and clients", F) && !groundedInFacts("his congressional testimony as the authoritative voice", F)]); }
{ const T = "Aubrey Lee Price";
  const giveaway = hookCraftIssues({ hookPremise: "A pastor ran a fund for years.", titleSuggestion: "Caught at a New Year's Eve Traffic Stop", payoffMoment: "the New Year's Eve traffic stop in Glynn County" }, T);
  checks.push(["title naming the payoff moment flagged as a give-away", giveaway.some((x) => /title gives away/.test(x))]);
  checks.push(["title without the payoff passes", !hookCraftIssues({ hookPremise: "He vanished in 2012.", titleSuggestion: "The Pastor Who Vanished With $40 Million", payoffMoment: "the New Year's Eve traffic stop in Glynn County" }, T).some((x) => /gives away/.test(x))]);
  checks.push(["vague stand-in flagged", hookCraftIssues({ hookPremise: "A musician found a way to exploit streaming royalties." }, "Michael Smith").some((x) => /vague/.test(x))]);
  checks.push(["stock opener flagged", hookCraftIssues({ hookPremise: "For decades, fast food was cheap." }, "fast food").some((x) => /stock phrase/.test(x))]);
  const hf = "the Goldman account falling from $36.9 million to $480,000";
  checks.push(["hook missing its hook-fact figure flagged", hookCraftIssues({ hookPremise: "He was secretly destroying their savings.", hookFact: hf }, T).some((x) => /strongest fact/.test(x))]);
  checks.push(["hook carrying the figure passes", !hookCraftIssues({ hookPremise: "The account held $36.9 million. When it closed, $480,000 was left.", hookFact: hf }, T).some((x) => /strongest fact/.test(x))]);
  const rv = { reveal: "In 2011 investigators found Jones working at a Las Vegas casino sports book under a stolen name.", hookFactsText: ["Jones walked out on May 10, 1979, promising to return after a business meeting.", "An Illinois court declared him legally dead in 1986."] };
  checks.push(["hook stating the spine's payoff reveal flagged", hookCraftIssues({ hookPremise: "A broker walked out on May 10, 1979, and was found 32 years later working a sports book at a Las Vegas casino under a stolen name.", ...rv }, "Arthur Gerald Jones").some((x) => /gives away the payoff/.test(x))]);
  checks.push(["hook built from its hook facts passes", !hookCraftIssues({ hookPremise: "He walked out on May 10, 1979, promising to come back after a business meeting. In 1986, an Illinois court declared him legally dead.", ...rv }, "Arthur Gerald Jones").some((x) => /gives away/.test(x))]);
  checks.push(["locked title is not judged", !hookCraftIssues({ hookPremise: "He ran.", titleSuggestion: "Caught at a New Year's Eve Traffic Stop", payoffMoment: "the New Year's Eve traffic stop in Glynn County" }, T, { lockedTitle: true }).some((x) => /title/.test(x))]); }
{ const T = "The Housewife of Pulaski (The Story of Linda Darby)";
  const F = "Linda Darby married Charles Darby in 1969. Her husband, Charles Darby, ran a hardware store. Her son Michael Darby was 9.";
  let ok = true, out = "";
  try { out = replaceFamilyNames("Charles Darby came home early. Her son Michael was asleep.", F, T).text; } catch { ok = false; }
  checks.push(["topic with parentheses doesn't crash family-name cleanup", ok]);
  checks.push(["adult husband named, 9-year-old son replaced, for a parenthesized topic", ok && /Charles/.test(out) && !/Michael/.test(out)]); }
let fail = 0;
for (const [n, ok] of checks) if (!ok) { fail++; console.log(`FAIL  ${n}`); }
console.log(`fact-discipline: ${checks.length - fail}/${checks.length} passed`);
if (fail) process.exit(1);
