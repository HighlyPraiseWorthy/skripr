#!/usr/bin/env python3
"""Google Ads Keyword Planner pull for the Skripr SEO pipeline (/seo-page).

Returns real avg-monthly-searches + competition for seed keywords, as JSON, so
opportunity scoring uses live volume instead of guesses. No data is fabricated:
if credentials are missing or the API errors, it prints a clear status and exits
non-zero (the pipeline then falls back to manual SERP estimates).

Setup (one time): see docs/keyword-planner-setup.md. Needs:
  - pip3 install google-ads
  - a config file at ~/.config/skripr/google-ads.yaml (override with GOOGLE_ADS_CONFIG)
    containing: developer_token, client_id, client_secret, refresh_token,
    login_customer_id, use_proto_plus: True
  - GOOGLE_ADS_CUSTOMER_ID env (the account to query; digits only, no dashes)

Usage:
  python3 scripts/keyword-planner.py "youtube hook generator" "youtube title ideas"
Optional env: GADS_GEO (default 2840 = US), GADS_LANG (default 1000 = English).
"""
import os, sys, json

CONFIG = os.environ.get("GOOGLE_ADS_CONFIG", os.path.expanduser("~/.config/skripr/google-ads.yaml"))
GEO = os.environ.get("GADS_GEO", "2840")      # 2840 = United States
LANG = os.environ.get("GADS_LANG", "1000")    # 1000 = English


def fail(msg):
    print(json.dumps({"ok": False, "error": msg}))
    sys.exit(1)


def main():
    seeds = [s for s in sys.argv[1:] if s.strip()]
    if not seeds:
        fail("No seed keywords passed.")
    if not os.path.exists(CONFIG):
        fail(f"No Google Ads config at {CONFIG}. See docs/keyword-planner-setup.md.")
    customer_id = os.environ.get("GOOGLE_ADS_CUSTOMER_ID", "").replace("-", "")
    if not customer_id:
        fail("Set GOOGLE_ADS_CUSTOMER_ID (digits only).")
    try:
        from google.ads.googleads.client import GoogleAdsClient
    except ImportError:
        fail("google-ads not installed. Run: pip3 install google-ads")

    try:
        client = GoogleAdsClient.load_from_storage(CONFIG)
        svc = client.get_service("KeywordPlanIdeaService")
        req = client.get_type("GenerateKeywordIdeasRequest")
        req.customer_id = customer_id
        req.language = f"languageConstants/{LANG}"
        req.geo_target_constants.append(f"geoTargetConstants/{GEO}")
        req.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH
        req.keyword_seed.keywords.extend(seeds)
        ideas = list(svc.generate_keyword_ideas(request=req))
    except Exception as e:
        msg = str(e)
        for line in msg.splitlines():
            if "FaultMessage" in line or "errors {" in line:
                msg = line.strip()
                break
        fail(f"Google Ads API error: {msg[:300]}")

    rows = []
    for idea in ideas:
        m = idea.keyword_idea_metrics
        rows.append({
            "keyword": idea.text,
            "avg_monthly_searches": m.avg_monthly_searches,
            "competition": m.competition.name,           # LOW | MEDIUM | HIGH | UNSPECIFIED
            "competition_index": m.competition_index,     # 0-100
            "low_bid_usd": round((m.low_top_of_page_bid_micros or 0) / 1_000_000, 2),
            "high_bid_usd": round((m.high_top_of_page_bid_micros or 0) / 1_000_000, 2),
        })
    rows.sort(key=lambda r: r["avg_monthly_searches"], reverse=True)
    print(json.dumps({"ok": True, "geo": GEO, "lang": LANG, "seeds": seeds, "ideas": rows[:200]}, indent=2))


if __name__ == "__main__":
    main()
