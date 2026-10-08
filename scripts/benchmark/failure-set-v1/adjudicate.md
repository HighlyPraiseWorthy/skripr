# Adjudication sheet: 25 claims

For each claim, read the research facts and answer ONE question: **does the research support what the script says?** Write `ok` (supported or a fair inference), `error` (unsupported, misattached or overstated), or `error!` if a viewer would actually be misled. Skip anything you are unsure about.

Your answers become the ground truth the new judge is scored against.

## 1. C107 (wright)

**Script:** Flight 841 departs Detroit bound for Miami.

- Claude labeler: **ok** (supported). F2: departing Detroit for Miami; judge false positive (other facts say Detroit to Algeria, the diverted destination)
- New judge: agrees with the labeler

> F2: Contemporary reporting said Delta Flight 841 was commandeered around 12:45 p.m. over Orlando after departing Detroit for Miami, and the hijackers collected a $1 million ransom before flying on to Algeria.

**Your answer:** 

## 2. C109 (wright)

**Script:** On November 17, 2011 — less than two months after the arrest — a Lisbon appeals court ruled that George Wright would not be extradited to the United States.

- Claude labeler: **ok** (legitimate_inference). Sept 26 to Nov 17 = 52 days; judge false positive
- New judge: agrees with the labeler

> F10: A Lisbon appeals court ruled on November 17, 2011 that Wright would not be extradited, and Portugal’s Supreme Court later rejected the U.S. appeal, leaving him in Portugal.
> F21: George Edward Wright escaped from a New Jersey prison in August 1970, joined the Black Liberation Army, hijacked Delta Air Lines Flight 841 on July 31, 1972, and was arrested in Portugal on September 26, 2011 after more than 40 years as a fugitive.

**Your answer:** 

## 3. C099 (ltcm)

**Script:** In 1994, that patience returned 19.9 percent net to investors.

- Claude labeler: **ok** (supported). judge false positive (rounded figures in F17)
- New judge: agrees with the labeler

> F10: LTCM used a "market-neutral" relative-value/convergence strategy, exploiting temporary price differences between similar securities with long and offsetting short positions, and its documented net returns were 19.9% in 1994, 42.8% in 1995, 40.8% in 1996, and 17.1% in 1997.

**Your answer:** 

## 4. C098 (jones)

**Script:** The sentence was three years of probation.

- Claude labeler: **ok** (supported). F5 says five years (conflicting later report); primary sentencing facts say three; judge false positive
- New judge: agrees with the labeler

> F23: Jones pleaded guilty to one count of felony identity fraud in Clark County court and was sentenced to three years of probation with restitution ordered.
> F30: Arthur Gerald Jones was sentenced to three years of probation on January 31, 2012.

**Your answer:** 

## 5. C105 (streaming-fraud)

**Script:** Before the bots, before the AI catalog, before the October 2017 email that reduced the whole operation to arithmetic, there was a musician.

- Claude labeler: **ok** (supported). Oct 20 2017 self-email financial breakdown; judge false positive
- New judge: agrees with the labeler

> F66: On October 20, 2017, SMITH emailed himself a financial breakdown of his streaming operation.

**Your answer:** 

## 6. C087 (fast-food-prices)

**Script:** The limited-service CPI rose 26% from 2019 to 2024, against about 21% cumulative headline CPI inflation over the same span.

- Claude labeler: **ok** (supported). F209 gives a conflicting 19.8%; script follows F35 exactly; judge false positive
- New judge: agrees with the labeler

> F35: Limited service meals and snacks CPI rose 26.0% from 2019 to 2024, compared with about 21.2% cumulative headline CPI inflation and roughly flat/slightly positive real wage growth over the same span.

**Your answer:** 

## 7. C091 (freshwaters)

**Script:** Sixteen years after walking away from that honor camp, Freshwaters was caught.

- Claude labeler: **ok** (legitimate_inference). 1959 escape to 1975 WV arrest = 16 years; judge false positive
- New judge: agrees with the labeler

> F0: A 1975 West Virginia arrest was reported, but the governor refused extradition after concluding Freshwaters had a "flawless 16-year residency" there.
> F2: After violating probation by driving and getting a driver’s license, Freshwaters was imprisoned in February 1959 at the Ohio State Reformatory, moved to an honor camp near Sandusky, and was reported missing on Sept. 30, 1959; he was later arrested in West Virginia in 1975 and disappeared again after the governor refused extradition.

**Your answer:** 

## 8. C104 (ltcm)

**Script:** In September 1998, William J. McDonough of the New York Fed gathered representatives from fourteen major banks and securities firms on Wall Street and laid out the situation in terms that left little room for interpretation.

- Claude labeler: **ok** (supported). judge false positive
- New judge: **error** (No research fact specifies the meeting location as Wall Street.)

> F5: By late September 1998, LTCM had lost about 90% of its capital, and the Federal Reserve Bank of New York organized a $3.625 billion private rescue by 14 banks and securities firms to keep the fund from disorderly liquidation.
> F14: At the September 1998 New York Fed rescue meeting, McDonough convened 14 major Wall Street firms and pressed them to form a private rescue consortium, warning that disorderly liquidation could destabilize markets.

**Your answer:** 

## 9. C042 (chapo-chicago)

**Script:** The trial opened in Brooklyn in the fall of 2018, and what prosecutors brought into that courtroom was the accumulated weight of everything that had been built in Chicago and beyond — indictments, seizures, intercepted recordings, ledgers — now handed to a jury through the mouths of the people who had actually run the organization alongside Guzmán.

- Claude labeler: **error!** (misattached). Brooklyn appears only as an indictment district; research never places the trial there (fall 2018 is derivable). Gate right, judge missed
- New judge: agrees with the labeler

> F29: The Chicago case overlapped with broader federal cartel prosecutions: DEA said the 2009 Brooklyn and Chicago indictments together charged Guzmán Loera, Ismael Zambada-García, Arturo Beltrán-Leyva, and others with importing nearly 200 metric tons of cocaine into the United States.
> F44: The trial lasted three months.
> F43: Guzman Loera was convicted by a federal jury on February 12, 2019.

**Your answer:** 

## 10. C040 (ltcm)

**Script:** What Meriwether brought to Greenwich, Connecticut in 1994 wasn't just a trading strategy — it was a culture, transplanted whole from Salomon Brothers, where he'd run the fixed-income arbitrage desk and risen to vice chairman before a Treasury-bond trading scandal ended his tenure there.

- Claude labeler: **error!** (unsupported). Salomon vice chairman/arb desk/scandal supported; Greenwich, Connecticut not in research (gate right, judge missed)
- New judge: agrees with the labeler

> F18: John Meriwether was former Salomon Brothers vice chairman and head of fixed-income arbitrage, and he left after the Treasury-bond trading scandal at Salomon Brothers.
> F23: John Meriwether’s Salomon Brothers background shaped LTCM’s culture: he imported a tight, elite trading partnership model built around quantitative risk-taking and recruited star academics to run it.

**Your answer:** 

## 11. C044 (ltcm)

**Script:** McDonough put it plainly when he testified before Congress: a disorderly unwinding of those positions would have created a "severe liquidity problem" and triggered a "fire sale" that could "cause widespread disruption" in financial markets.

- Claude labeler: **error!** (misattached). quotes supported, but research never says he testified before Congress (gate right, judge missed)
- New judge: agrees with the labeler

> F2: William J. McDonough said LTCM’s failure would have created a "severe liquidity problem" and that the Fed’s goal was to avoid a "fire sale" of positions that could "cause widespread disruption" in financial markets.

**Your answer:** 

## 12. C061 (jones)

**Script:** The walls of the life he had built were coming down in a specific order, and May 10th was the morning he stopped waiting for the next one to fall.

- Claude labeler: **error** (misattached). research: he left around noon, not morning (gate right, judge missed)
- New judge: **ok**

> F53: Arthur Jones rushed out the door around noon on May 10, 1979, promising his wife he would return after a business meeting.

**Your answer:** 

## 13. C029 (jones)

**Script:** What he left behind — a wife, three children, a bracelet on the nightstand — eventually became, through the machinery of courts and federal programs, a $78,600 government check.

- Claude labeler: **error!** (misattached). $78,600 is what Jones was ordered to REPAY; the family received $47,000; 'bracelet on the nightstand' invented location
- New judge: agrees with the labeler

> F56: Arthur Jones was frazzled enough when he left that he forgot to put on his cherished bracelet.
> F61: Social Security paid Jones's family $47,000 in survivor benefits after he was declared legally dead.
> F42: Jones was ordered to pay more than $78,600 to the Social Security Administration for their payments to Jones' family after he was declared dead in Illinois.

**Your answer:** 

## 14. C024 (psychopathy)

**Script:** The profile that most closely tracks serial offending carried no obvious intellectual advantage over the one that did not.

- Claude labeler: **error!** (misattached). F19 subgroups are homicide offenders, not serial offenders, and direction of IQ difference is not given
- New judge: agrees with the labeler

> F19: In a preliminary neuropsychological study of homicide offenders, cluster analysis identified one subgroup with low psychopathy and high psychosis and another with high psychopathy and low psychosis, each showing distinct differences in intelligence, memory, attention, executive functions, and academic abilities.

**Your answer:** 

## 15. C002 (fast-food-prices)

**Script:** The Goldman Sachs data make the asymmetry legible: non-manager wages in fast food were up 35.9% since January 2017, and fast-food meal prices were up more than 41% over that same period.

- Claude labeler: **error!** (misattached). Goldman's 35.9% is non-manager wages generally; 'in fast food' attaches it to the wrong population
- New judge: **ok**

> F160: Marcus by Goldman Sachs reported that limited-service meals rose 4.3% year over year in June 2024, while non-manager wages were up 35.9% since January 2017 and fast food meal prices were up more than 41% over the same period.

**Your answer:** 

## 16. C030 (freshwaters)

**Script:** What remained was Frank Freshwaters — eighty years old, paroled, released, and finally, unambiguously himself again.

- Claude labeler: **error!** (unsupported). paroled/released supported; age 80 not derivable (no birth year in research)
- New judge: **ok**

> F9: After his return to Ohio, Freshwaters received parole on February 25, 2016, with five years of supervision, and was released from an Ohio correctional facility on June 15, 2016.

**Your answer:** 

## 17. C077 (chapo-chicago)

**Script:** It was far enough downstream in the operation that finished product and counted cash were both sitting there simultaneously.

- Claude labeler: **error!** (unsupported). invented scene detail about a seizure site
- New judge: **ok**


**Your answer:** 

## 18. C094 (freshwaters)

**Script:** Ohio would not get another clear opportunity for forty years.

- Claude labeler: **ok** (legitimate_inference). 1975 to 2015 = 40 years; judge false positive
- New judge: **error!** (No research fact characterizes the gap after 1975 as 'forty years' or describes it as Ohio's next opportunity; 1975 to 2015 is 40 years but the framing of 'clear opportunity' is not in the research.)

> F0: A 1975 West Virginia arrest was reported, but the governor refused extradition after concluding Freshwaters had a "flawless 16-year residency" there.
> F15: After a 1975 arrest in West Virginia, Freshwaters was released when the governor refused extradition, and the U.S. Marshals later reopened the case in 2015 as their longest capture.
> F18: Frank Freshwaters was captured on May 4, 2015 in Melbourne, Florida, after U.S. Marshals traced him through a cold-case search.

**Your answer:** 

## 19. C010 (psychopathy)

**Script:** The high-psychopathy subgroup was not the cognitively dominant one.

- Claude labeler: **error!** (overinterpretation). research says subgroups differed in intelligence, not which was higher
- New judge: **ok**

> F19: In a preliminary neuropsychological study of homicide offenders, cluster analysis identified one subgroup with low psychopathy and high psychosis and another with high psychopathy and low psychosis, each showing distinct differences in intelligence, memory, attention, executive functions, and academic abilities.

**Your answer:** 

## 20. C023 (psychopathy)

**Script:** Neuroimaging and neuropsychological studies consistently link psychopathy to impaired function in these areas.

- Claude labeler: **ok** (supported). 
- New judge: **error!** (F7 notes the causal interpretation is contested and studies propose broader explanations; 'consistently' overstates the consensus described in the research.)

> F5: Neuroimaging and neuropsychological studies link psychopathy to impaired ventromedial/orbitofrontal prefrontal cortex function, with social-affective decision making and reinforcement-based learning appearing disrupted while some executive functions can remain relatively intact.
> F7: The peer-reviewed literature reports a consistent association between psychopathy and reduced prefrontal gray matter, especially in vmPFC/OFC and anterior cingulate cortex, but the causal interpretation remains contested because studies also propose broader limbic and fronto-limbic connectivity explanations rather than a single prefrontal deficit.

**Your answer:** 

## 21. C031 (psychopathy)

**Script:** The traits most tightly linked to serial homicide are not the ones that require or reward high intelligence.

- Claude labeler: **ok** (legitimate_inference). 
- New judge: **error!** (Research shows psychopathy is linked to serial homicide and negatively correlated with IQ, but the script's claim that these traits do not 'require or reward' high intelligence is a stronger causal/fu)

> F20: A 2019 review found the overall psychopathy–homicide association was large (r = 0.68), and it was stronger in serial homicide (r = 0.74) than in homicide overall.
> F11: A meta-analytic review found a small, statistically significant negative relationship between intelligence and psychopathy, with total psychopathy correlated with FSIQ at r = -.07.

**Your answer:** 

## 22. C084 (fast-food-prices)

**Script:** That means food and labor together account for roughly 60% of what it costs to run the kitchen before rent, insurance, or equipment enters the equation.

- Claude labeler: **ok** (legitimate_inference). 30% + 30%, occupancy separate; judge false positive (flagged as gate-introduced, but correct)
- New judge: **error!** (No research fact states food and labor together are ~60% of operating costs; F37 puts labor at ~30% and food at ~30% (totaling ~60%), but this is for quick-service specifically and the script generali)

> F37: National Restaurant Association benchmarking data typically puts quick-service restaurant costs at roughly 30% labor, 30% food/commodity inputs, and 25% occupancy, with labor share rising from pre-2019 levels as wage pressure increased.

**Your answer:** 

## 23. C088 (fast-food-prices)

**Script:** And 78% of those respondents had reclassified the experience entirely, not a quick, cheap meal, but a luxury.

- Claude labeler: **error!** (misattached). 78% is the LendingTree/USA Today figure; context ties 'those respondents' to the Farmdoc survey
- New judge: **ok**

> F33: LendingTree-related reporting found 62% of respondents said they were eating less fast food because it cost more, and 78% said fast food had become a luxury.
> F58: USA Today reported that 78% of respondents considered fast food a luxury because of rising prices, 62% had reduced fast-food consumption, and 75% said cooking at home was more economical.

**Your answer:** 

## 24. C089 (fast-food-prices)

**Script:** If roughly half of cost increases passed through to prices, and costs themselves rose sharply, then the 26% limited-service CPI increase from 2019 to 2024 has only a partial cost-based explanation — the arithmetic does not close on costs alone.

- Claude labeler: **ok** (legitimate_inference). judge false positive
- New judge: **error!** (The research shows partial pass-through of labor costs specifically, but the script extends this to claim the entire 26% CPI increase cannot be explained by costs alone — this goes beyond what the res)

> F35: Limited service meals and snacks CPI rose 26.0% from 2019 to 2024, compared with about 21.2% cumulative headline CPI inflation and roughly flat/slightly positive real wage growth over the same span.
> F2: A 2026 Berkeley IRLE paper estimated consumers bore about 50% of higher labor costs through prices in a $20 minimum wage case, while another cited study found only about half of restaurant cost increases were passed through, illustrating disagreement over whether pass-through is near-full or partial.

**Your answer:** 

## 25. C112 (jones)

**Script:** Investigators reached Jones in July 2011, and when they asked him directly whether he was the Chicago commodities trader who had walked away 32 years earlier, he said yes.

- Claude labeler: **ok** (supported). 
- New judge: **error!** (Research says Jones was arrested in July (F63) and tried to renew a license in 2011 (F29), but does not say investigators 'reached' him in July 2011; F39 says investigators began looking in May 2008. )

> F35: Jones was busted in July by state and federal investigators.
> F63: Arthur Gerald Jones was arrested July 19, according to the Nevada Department of Motor Vehicles.
> F90: When authorities asked if he was the Chicago trader who had vanished 32 years ago, Jones said yes.

**Your answer:** 
