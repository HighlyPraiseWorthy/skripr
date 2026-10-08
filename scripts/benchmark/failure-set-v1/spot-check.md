# Spot-check: 15 labels that decide the result

For each line: does the research support the claim? Mark agree / disagree. The first 8 are claims the frozen judge called errors that I labeled fine (judge false positives). The next 4 are lines the gate flagged and the judge passed, that I labeled real problems. The last 3 are judge-confirmed errors I labeled material.

## 1. C107 (wright)

**Script:** Flight 841 departs Detroit bound for Miami.

**Judge flagged:** Flight 841 departs Detroit bound for Miami

**My label:** supported. F2: departing Detroit for Miami; judge false positive (other facts say Detroit to Algeria, the diverted destination)

> F2: Contemporary reporting said Delta Flight 841 was commandeered around 12:45 p.m. over Orlando after departing Detroit for Miami, and the hijackers collected a $1 million ransom before flying on to Algeria.

Agree / disagree:

## 2. C109 (wright)

**Script:** On November 17, 2011 — less than two months after the arrest — a Lisbon appeals court ruled that George Wright would not be extradited to the United States.

**Judge flagged:** less than two months after the arrest

**My label:** legitimate_inference. Sept 26 to Nov 17 = 52 days; judge false positive

> F10: A Lisbon appeals court ruled on November 17, 2011 that Wright would not be extradited, and Portugal’s Supreme Court later rejected the U.S. appeal, leaving him in Portugal.
> F21: George Edward Wright escaped from a New Jersey prison in August 1970, joined the Black Liberation Army, hijacked Delta Air Lines Flight 841 on July 31, 1972, and was arrested in Portugal on September 26, 2011 after more than 40 years as a fugitive.

Agree / disagree:

## 3. C099 (ltcm)

**Script:** In 1994, that patience returned 19.9 percent net to investors.


**My label:** supported. judge false positive (rounded figures in F17)

> F10: LTCM used a "market-neutral" relative-value/convergence strategy, exploiting temporary price differences between similar securities with long and offsetting short positions, and its documented net returns were 19.9% in 1994, 42.8% in 1995, 40.8% in 1996, and 17.1% in 1997.

Agree / disagree:

## 4. C098 (jones)

**Script:** The sentence was three years of probation.


**My label:** supported. F5 says five years (conflicting later report); primary sentencing facts say three; judge false positive

> F23: Jones pleaded guilty to one count of felony identity fraud in Clark County court and was sentenced to three years of probation with restitution ordered.
> F30: Arthur Gerald Jones was sentenced to three years of probation on January 31, 2012.

Agree / disagree:

## 5. C105 (streaming-fraud)

**Script:** Before the bots, before the AI catalog, before the October 2017 email that reduced the whole operation to arithmetic, there was a musician.

**Judge flagged:** Before the bots, before the AI catalog, before the October 2017 email

**My label:** supported. Oct 20 2017 self-email financial breakdown; judge false positive

> F66: On October 20, 2017, SMITH emailed himself a financial breakdown of his streaming operation.

Agree / disagree:

## 6. C087 (fast-food-prices)

**Script:** The limited-service CPI rose 26% from 2019 to 2024, against about 21% cumulative headline CPI inflation over the same span.

**Judge flagged:** The limited-service CPI rose 26% from 2019 to 2024, against about 21% cumulative headline CPI inflation over the same span

**My label:** supported. F209 gives a conflicting 19.8%; script follows F35 exactly; judge false positive

> F35: Limited service meals and snacks CPI rose 26.0% from 2019 to 2024, compared with about 21.2% cumulative headline CPI inflation and roughly flat/slightly positive real wage growth over the same span.

Agree / disagree:

## 7. C091 (freshwaters)

**Script:** Sixteen years after walking away from that honor camp, Freshwaters was caught.


**My label:** legitimate_inference. 1959 escape to 1975 WV arrest = 16 years; judge false positive

> F0: A 1975 West Virginia arrest was reported, but the governor refused extradition after concluding Freshwaters had a "flawless 16-year residency" there.
> F2: After violating probation by driving and getting a driver’s license, Freshwaters was imprisoned in February 1959 at the Ohio State Reformatory, moved to an honor camp near Sandusky, and was reported missing on Sept. 30, 1959; he was later arrested in West Virginia in 1975 and disappeared again after the governor refused extradition.

Agree / disagree:

## 8. C104 (ltcm)

**Script:** In September 1998, William J. McDonough of the New York Fed gathered representatives from fourteen major banks and securities firms on Wall Street and laid out the situation in terms that left little room for interpretation.

**Judge flagged:** gathered representatives from fourteen major banks and securities firms on Wall Street

**My label:** supported. judge false positive

> F5: By late September 1998, LTCM had lost about 90% of its capital, and the Federal Reserve Bank of New York organized a $3.625 billion private rescue by 14 banks and securities firms to keep the fund from disorderly liquidation.
> F14: At the September 1998 New York Fed rescue meeting, McDonough convened 14 major Wall Street firms and pressed them to form a private rescue consortium, warning that disorderly liquidation could destabilize markets.

Agree / disagree:

## 9. C042 (chapo-chicago)

**Script:** The trial opened in Brooklyn in the fall of 2018, and what prosecutors brought into that courtroom was the accumulated weight of everything that had been built in Chicago and beyond — indictments, seizures, intercepted recordings, ledgers — now handed to a jury through the mouths of the people who had actually run the organization alongside Guzmán.


**My label:** misattached (material). Brooklyn appears only as an indictment district; research never places the trial there (fall 2018 is derivable). Gate right, judge missed

> F29: The Chicago case overlapped with broader federal cartel prosecutions: DEA said the 2009 Brooklyn and Chicago indictments together charged Guzmán Loera, Ismael Zambada-García, Arturo Beltrán-Leyva, and others with importing nearly 200 metric tons of cocaine into the United States.
> F44: The trial lasted three months.
> F43: Guzman Loera was convicted by a federal jury on February 12, 2019.

Agree / disagree:

## 10. C040 (ltcm)

**Script:** What Meriwether brought to Greenwich, Connecticut in 1994 wasn't just a trading strategy — it was a culture, transplanted whole from Salomon Brothers, where he'd run the fixed-income arbitrage desk and risen to vice chairman before a Treasury-bond trading scandal ended his tenure there.


**My label:** unsupported (material). Salomon vice chairman/arb desk/scandal supported; Greenwich, Connecticut not in research (gate right, judge missed)

> F18: John Meriwether was former Salomon Brothers vice chairman and head of fixed-income arbitrage, and he left after the Treasury-bond trading scandal at Salomon Brothers.
> F23: John Meriwether’s Salomon Brothers background shaped LTCM’s culture: he imported a tight, elite trading partnership model built around quantitative risk-taking and recruited star academics to run it.

Agree / disagree:

## 11. C044 (ltcm)

**Script:** McDonough put it plainly when he testified before Congress: a disorderly unwinding of those positions would have created a "severe liquidity problem" and triggered a "fire sale" that could "cause widespread disruption" in financial markets.


**My label:** misattached (material). quotes supported, but research never says he testified before Congress (gate right, judge missed)

> F2: William J. McDonough said LTCM’s failure would have created a "severe liquidity problem" and that the Fed’s goal was to avoid a "fire sale" of positions that could "cause widespread disruption" in financial markets.

Agree / disagree:

## 12. C061 (jones)

**Script:** The walls of the life he had built were coming down in a specific order, and May 10th was the morning he stopped waiting for the next one to fall.


**My label:** misattached. research: he left around noon, not morning (gate right, judge missed)

> F53: Arthur Jones rushed out the door around noon on May 10, 1979, promising his wife he would return after a business meeting.

Agree / disagree:

## 13. C029 (jones)

**Script:** What he left behind — a wife, three children, a bracelet on the nightstand — eventually became, through the machinery of courts and federal programs, a $78,600 government check.


**My label:** misattached (material). $78,600 is what Jones was ordered to REPAY; the family received $47,000; 'bracelet on the nightstand' invented location

> F56: Arthur Jones was frazzled enough when he left that he forgot to put on his cherished bracelet.
> F61: Social Security paid Jones's family $47,000 in survivor benefits after he was declared legally dead.
> F42: Jones was ordered to pay more than $78,600 to the Social Security Administration for their payments to Jones' family after he was declared dead in Illinois.

Agree / disagree:

## 14. C024 (psychopathy)

**Script:** The profile that most closely tracks serial offending carried no obvious intellectual advantage over the one that did not.


**My label:** misattached (material). F19 subgroups are homicide offenders, not serial offenders, and direction of IQ difference is not given

> F19: In a preliminary neuropsychological study of homicide offenders, cluster analysis identified one subgroup with low psychopathy and high psychosis and another with high psychopathy and low psychosis, each showing distinct differences in intelligence, memory, attention, executive functions, and academic abilities.

Agree / disagree:

## 15. C002 (fast-food-prices)

**Script:** The Goldman Sachs data make the asymmetry legible: non-manager wages in fast food were up 35.9% since January 2017, and fast-food meal prices were up more than 41% over that same period.


**My label:** misattached (material). Goldman's 35.9% is non-manager wages generally; 'in fast food' attaches it to the wrong population

> F160: Marcus by Goldman Sachs reported that limited-service meals rose 4.3% year over year in June 2024, while non-manager wages were up 35.9% since January 2017 and fast food meal prices were up more than 41% over the same period.

Agree / disagree:
