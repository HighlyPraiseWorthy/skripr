# Google Ads Keyword Planner API — setup (for /seo-page real volume)

One-time setup so `scripts/keyword-planner.py` can pull real avg-monthly-searches
and competition. The gate is the **developer token** (manual Google approval,
often 1–2 business days). Everything else is ~20 minutes.

## 1. Google Ads account
You need a real Google Ads account (you have the Keyword Planner bookmark, so this
likely exists). Note the **customer ID** (top right, format `123-456-7890`). Digits
only go in the env var later.

> **Update (2026-07-06 PM):** Compliance team replied same day (ticket 7-7116000040665) asking to confirm company type. Answered: current classification "Advertiser" is correct (Google's Advertiser type = in-house API use for your own company; "internal use only" is not a company type). No API Center change made. Awaiting decision.
>
> **Status (2026-07-06):** Basic Access application ACTUALLY submitted 2026-07-06 (ticket confirmed by the Google Ads API Compliance team; expect ~3 business days, so a decision around Jul 9). NOTE the trap we hit: filling in Developer Details in the API Center on 2026-06-28 is NOT the application — the real application is the separate "Apply for Basic Access" form, which requires a design document attached (ours: ~/Desktop/skripr-google-ads-api-design-doc.pdf). Watch antdavids93@gmail.com incl. spam for adsapi@google.com; an unanswered reviewer email = silent stall. Everything else (OAuth, refresh token, config at ~/.config/skripr/google-ads.yaml, scripts/keyword-planner.py) is wired and tested; the token upgrade is the only missing piece.

## 2. Developer token (the slow part — start this first)
- In Google Ads → **Tools → API Center** (visible to account admins).
- Copy the **developer token**. New tokens start at **Test** access, which only
  returns data for test accounts. **Apply for Basic access** on that same page
  (short form). Real Keyword Planner volume needs Basic access. Approval is manual,
  usually 1–2 business days.

## 3. OAuth client + refresh token
- In Google Cloud (reuse the `skripr` project): **APIs & Services → Enable** the
  **Google Ads API**.
- **Credentials → Create credentials → OAuth client ID → Desktop app.** Download
  the client ID + secret.
- Generate a **refresh token** for your Google account. Easiest path is Google's
  `generate_user_credentials.py` from the google-ads-python repo, or any OAuth
  desktop flow with scope `https://www.googleapis.com/auth/adwords`.

## 4. Config file
Install the lib and create the config (kept outside the repo):
```
pip3 install google-ads
mkdir -p ~/.config/skripr
```
Create `~/.config/skripr/google-ads.yaml`:
```yaml
developer_token: "YOUR_DEVELOPER_TOKEN"
client_id: "YOUR_OAUTH_CLIENT_ID"
client_secret: "YOUR_OAUTH_CLIENT_SECRET"
refresh_token: "YOUR_REFRESH_TOKEN"
login_customer_id: "1234567890"   # your customer ID, digits only
use_proto_plus: True
```
`chmod 600 ~/.config/skripr/google-ads.yaml` (it holds secrets).

## 5. Tell the pipeline the account
Set the customer to query (digits only):
```
export GOOGLE_ADS_CUSTOMER_ID=1234567890
```
(Put it in your shell profile so /seo-page runs pick it up. Optional region/lang:
`GADS_GEO` default 2840 = US, `GADS_LANG` default 1000 = English.)

## 6. Test
```
python3 scripts/keyword-planner.py "youtube hook generator" "youtube title ideas"
```
Expect `{"ok": true, "ideas": [...]}`. If you get `ok: false` with an auth error,
the developer token is probably still Test-level or pending Basic approval.

## Notes
- This is free (no per-query cost), unlike the paid-API alternative.
- The key files live in `~/.config/skripr/` (same place as the GSC key), never in
  the repo. Do not commit them.
- Until this is live, /seo-page falls back to manual SERP estimates and says so.
