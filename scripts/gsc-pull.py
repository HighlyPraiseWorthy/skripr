#!/usr/bin/env python3
"""GSC pull for the Skripr SEO learning loop (/seo-review).

Reads a service-account key (default ~/.config/skripr/gsc-key.json, override with
GSC_KEY_FILE) and prints per-page Search Console metrics as JSON for the last N
days (default 28). No data is fabricated: missing pages simply do not appear.

Usage:
  python3 scripts/gsc-pull.py [days]
"""
import os, sys, json, base64, datetime, urllib.parse as up
from google.oauth2 import service_account
import google.auth.transport.requests as gtr
import requests

KEY = os.environ.get("GSC_KEY_FILE", os.path.expanduser("~/.config/skripr/gsc-key.json"))
SITE = os.environ.get("GSC_SITE", "sc-domain:skripr.app")
SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]
days = int(sys.argv[1]) if len(sys.argv) > 1 else 28


def load_creds():
    # Prefer the local key file (local /seo-review runs). Fall back to the
    # base64 GSC_SERVICE_ACCOUNT_JSON env var (scheduled / cloud runs).
    if os.path.exists(KEY):
        return service_account.Credentials.from_service_account_file(KEY, scopes=SCOPES)
    b64 = os.environ.get("GSC_SERVICE_ACCOUNT_JSON")
    if b64:
        info = json.loads(base64.b64decode(b64))
        return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    raise SystemExit("No GSC credentials: missing key file and GSC_SERVICE_ACCOUNT_JSON env.")


def main():
    creds = load_creds()
    creds.refresh(gtr.Request())
    h = {"Authorization": f"Bearer {creds.token}"}
    end = datetime.date.today()
    start = end - datetime.timedelta(days=days)
    body = {"startDate": str(start), "endDate": str(end), "dimensions": ["page"], "rowLimit": 1000}
    url = f"https://www.googleapis.com/webmasters/v3/sites/{up.quote(SITE, safe='')}/searchAnalytics/query"
    r = requests.post(url, headers=h, json=body)
    r.raise_for_status()
    rows = r.json().get("rows", [])
    out = {
        "site": SITE,
        "range": {"start": str(start), "end": str(end), "days": days},
        "asOf": str(end),
        "pages": [
            {
                "url": row["keys"][0],
                "impressions": row.get("impressions", 0),
                "clicks": row.get("clicks", 0),
                "avgPosition": round(row.get("position", 0), 1),
                "ctr": round(row.get("ctr", 0), 4),
            }
            for row in rows
        ],
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
