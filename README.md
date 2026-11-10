# Sharma Lead Finder

Phone-first app that finds private and custom home builders currently pulling residential new-construction permits in Florida.

Live app: https://sharma-leads.sharma-crew.workers.dev

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
