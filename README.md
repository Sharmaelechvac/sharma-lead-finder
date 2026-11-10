# Sharma Lead Finder

Phone-first app that finds private and custom home builders currently pulling residential new-construction permits in Florida.

Live app: https://sharma-leads.sharma-crew.workers.dev

## v1 data

- **Live:** City of Orlando (Socrata open data, residential new *building* permits) and Marion County (Tyler EnerGov, new single-family residences).
- **Needs browser (no invented data):** Orange (OC FastTrack), Osceola, Brevard, Lee, and Charlotte (Accela). Lee County GIS layers exist but have no contractor names. Lee and Charlotte stay on the county list even outside Central Florida.
- **All 67 Florida counties** are on the Counties page. Adding a county means adding one adapter config (Socrata, ArcGIS, EnerGov, or Accela).

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
