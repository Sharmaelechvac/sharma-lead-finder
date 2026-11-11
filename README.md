# Sharma Lead Finder

Phone-first app that finds private and custom home builders currently pulling residential new-construction permits in Florida.

Live app: https://sharma-leads.sharma-crew.workers.dev
GitHub Pages build (Jarvis-maintained, same data): https://sharmaelechvac.github.io/sharma-lead-finder/ — serves `docs/index.html` + `docs/data.json`. The Pages build exists because the Worker runs on the sharma-crew Cloudflare account, which Jarvis cannot deploy to; Jarvis deploys here by git push.

## 2026-11-11 fix (Bob Myers request, confirmed by Sanjay)

- **Orlando 403 root cause:** data.cityoforlando.net (Akamai) blocks automated egress IPs — Cloudflare Worker IPs and, after heavy pulls, other datacenter IPs — with "HTTP 403 Access Denied". It is NOT a dataset or auth problem: the same query returns 200 from a normal browser with no token. Fixes applied: (1) the Socrata adapter sends an app token when one is configured (`SOCRATA_APP_TOKEN`, never hard-coded) and falls back to the dataset's CSV export endpoint on a 403; (2) `scripts/collect.mjs` runs the adapters outside the Worker and writes `docs/data.json`; (3) the daily run refreshes Orlando with small filtered browser pulls (only ~132 new residential building permits in the last 30 days) instead of 5,000-record scrapes. Failed sources keep their last successful records (carry-forward).
- **Priority counties checked for API feeds (2026-11-11, verified live):** NONE of Orange (OC FastTrack), Seminole (Accela OneStop, account + PIN), Lake (OpenGov), Polk (Accela), Brevard (Accela BASS), Volusia (Connect Live), or Sumter (CitizenServe) publishes a machine-readable permit feed with builder names. Osceola publishes an ArcGIS permit feed (`New_Construction_P_Permits`) but with NO contractor/builder or phone field. These counties are therefore collected by browser portal pulls in the daily run, not by API. Marion (EnerGov) stays live.
- **Skip list:** Danto Builders and SAKC / S.A. Casey are hidden (SAKC moved from low-priority to do-not-contact in `src/normalize.js`).
- **Daily run:** a Jarvis daily cron re-runs the collector, refreshes what it can, commits `docs/data.json`, and the Counties tab shows the last run time plus each county's last error and last success.
- **Enrichment:** builder phone/website are filled only from verified public sources; blanks stay blank.

## Scope

Florida counties whose county seat is within 150 statute miles of downtown Orlando (28.5383°N, 81.3792°W), plus Lee and Charlotte (both already inside that radius) and the City of Orlando, which has its own permit portal. The Counties page and area filter list only these areas, with the mile figure to the county seat.

## v1 data

- **Live:** City of Orlando (Socrata open data, residential new *building* permits) and Marion County (Tyler EnerGov, new single-family residences).
- **Needs browser (no invented data):** Orange (OC FastTrack), Osceola, Seminole, Lake, Brevard, Pasco, Polk, Hillsborough, Pinellas, Manatee, Lee, and Charlotte (mostly Accela / FastTrack). Lee County GIS layers exist but have no contractor names.
- Other in-scope counties are listed as Coming soon until a live or browser-verified adapter is added.

Daily cron (11:00 UTC / 6:00 AM America/New_York) runs all live adapters. If a source fails (the City of Orlando open-data host sometimes blocks Cloudflare Worker IPs), the last successful records for that county are kept.

## Rules

- No prices.
- Footer uses the company name and license numbers only.
- Do-not-contact companies are hidden. Large production builders are on a separate tab.
- The app does not send email, messages, or calls. It is a read-only lead list plus status/notes tracking.

## Deploy

```bash
WRANGLER_CACHE_DIR=/tmp/wcache npx wrangler deploy
```

Worker name: `sharma-leads`. KV binding `LEADS` holds the permit cache and saved statuses.
