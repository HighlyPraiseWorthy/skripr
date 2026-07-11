#!/usr/bin/env python3
"""PostHog pull for the Skripr SEO learning loop (/seo-review).

Attribution model (no custom events exist; taxonomy is $pageview/$autocapture):
a person's FIRST pageview under /dashboard is treated as their signup moment
(the dashboard is only reachable signed-in). Public pages that person viewed
BEFORE that moment get credit as signup touchpoints. This is assisted
attribution, not last-click: one signup can credit several pages.

Auth: personal API key (scope: Query read) at ~/.config/skripr/posthog-key
(override with POSTHOG_KEY_FILE). Project: 444678 (override POSTHOG_PROJECT).

Usage:
  python3 scripts/posthog-pull.py pages [days]        # pageview counts per public path
  python3 scripts/posthog-pull.py attribution [days]  # signups + touched-before-signup paths
"""
import os, sys, json, urllib.request

KEY = open(os.environ.get("POSTHOG_KEY_FILE", os.path.expanduser("~/.config/skripr/posthog-key"))).read().strip()
PROJECT = os.environ.get("POSTHOG_PROJECT", "444678")
HOST = os.environ.get("POSTHOG_HOST", "https://us.posthog.com")
mode = sys.argv[1] if len(sys.argv) > 1 else "attribution"
days = int(sys.argv[2]) if len(sys.argv) > 2 else 28


def hogql(q):
    req = urllib.request.Request(
        f"{HOST}/api/projects/{PROJECT}/query",
        data=json.dumps({"query": {"kind": "HogQLQuery", "query": q}}).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    return json.load(urllib.request.urlopen(req))["results"]


def main():
    if mode == "pages":
        rows = hogql(f"""
            select properties.$pathname as path, count() as views, count(distinct person_id) as visitors
            from events
            where event = '$pageview' and timestamp > now() - interval {days} day
              and properties.$pathname not like '/dashboard%'
            group by path order by views desc limit 100
        """)
        out = [{"path": r[0], "views": r[1], "visitors": r[2]} for r in rows]
        print(json.dumps({"mode": "pages", "days": days, "pages": out}, indent=2))
        return

    # attribution
    signups = hogql(f"""
        select count(distinct person_id) from (
            select person_id, min(timestamp) as t0 from events
            where event = '$pageview' and properties.$pathname like '/dashboard%'
            group by person_id
            having t0 > now() - interval {days} day
        )
    """)[0][0]
    touched = hogql(f"""
        with first_dash as (
            select person_id, min(timestamp) as t0 from events
            where event = '$pageview' and properties.$pathname like '/dashboard%'
            group by person_id
            having t0 > now() - interval {days} day
        )
        select e.properties.$pathname as path, count(distinct e.person_id) as signups_touched
        from events e
        join first_dash f on f.person_id = e.person_id
        where e.event = '$pageview' and e.timestamp < f.t0
          and e.properties.$pathname not like '/dashboard%'
        group by path order by signups_touched desc limit 50
    """)
    print(json.dumps({
        "mode": "attribution", "days": days,
        "model": "first /dashboard pageview = signup; public pages viewed before it get assisted credit",
        "newSignups": signups,
        "touchedBeforeSignup": [{"path": r[0], "signupsTouched": r[1]} for r in touched],
    }, indent=2))


if __name__ == "__main__":
    main()
