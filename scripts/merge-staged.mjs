// Hand-merge staged Lane records into docs/data.json — run by Jarvis only,
// never on a schedule (Sanjay's model: Jarvis personally updates the site).
// Usage: node scripts/merge-staged.mjs <staged.json> [more.json ...]
// Each staged file is a JSON array of records:
//   {builder, address, date, permitNo, phone, website, county, source}
// Dedupe key: (county, permitNo) — existing records always win.
// Builders + stats are rebuilt with the same aggregate() the collector uses.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JURISDICTIONS } from "../src/counties.js";
import { aggregate } from "../src/normalize.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "docs", "data.json");
const files = process.argv.slice(2);
if (!files.length) {
  console.error("No staged files given.");
  process.exit(1);
}

const payload = JSON.parse(await readFile(outPath, "utf8"));
const records = [...(payload.records || [])];
const seen = new Set(records.map((r) => `${r.county}|${r.permitNo}`));
const addedByCounty = {};
let added = 0;

for (const f of files) {
  const rows = JSON.parse(await readFile(f, "utf8"));
  if (!Array.isArray(rows)) throw new Error(`${f}: not a JSON array`);
  let n = 0;
  for (const r of rows) {
    if (!r || !r.builder || !r.permitNo || !r.county) {
      console.log(`SKIP (missing builder/permitNo/county) in ${f}: ${JSON.stringify(r).slice(0, 120)}`);
      continue;
    }
    const key = `${r.county}|${r.permitNo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({
      builder: r.builder,
      address: r.address || "",
      date: r.date || null,
      permitNo: r.permitNo,
      phone: r.phone || "",
      website: r.website || "",
      county: r.county,
      source: r.source || "manual",
    });
    n++;
    addedByCounty[r.county] = (addedByCounty[r.county] || 0) + 1;
  }
  console.log(`${f}: +${n} new records`);
  added += n;
}

// Integrity: (county, permitNo) must be unique across the whole set.
const keys = new Set(records.map((r) => `${r.county}|${r.permitNo}`));
if (keys.size !== records.length) {
  throw new Error(`Dedupe assertion failed: ${records.length} records, ${keys.size} unique keys`);
}

const agg = aggregate(records, {});
const now = new Date().toISOString();

// Refresh per-jurisdiction rows for counties touched by this merge.
const touchedCountyNames = new Set(Object.keys(addedByCounty));
const counties = (payload.counties || []).map((c) => {
  const j = JURISDICTIONS.find((x) => x.id === c.id);
  // Adapter counties carry cfg.county; hand-loaded counties match by name.
  const cfgCounty =
    (j && j.cfg && j.cfg.county) || (j ? j.name.replace(/ County$/, "") : null);
  if (!cfgCounty || !touchedCountyNames.has(cfgCounty)) return c;
  const n = records.filter((r) => r.county === cfgCounty).length;
  return { ...c, status: "live", records: n, error: null, lastScan: now, lastSuccessAt: now };
});

const liveAdd = Object.entries(addedByCounty).map(([c, n]) => `${c} hand-loaded (+${n})`);
const out = {
  ...payload,
  builders: agg.builders,
  counties,
  fetchedAt: now,
  liveSources: [...(payload.liveSources || []), ...liveAdd],
  logs: [...(payload.logs || []), `Hand-merge ${now}: +${added} records (${liveAdd.join(", ")})`],
  records,
  stats: {
    permits: records.length,
    custom: agg.customCount,
    production: agg.productionCount,
    skippedDnc: agg.skippedDnc,
    skippedNoBuilder: agg.skippedNoBuilder,
  },
};

await writeFile(outPath, JSON.stringify(out));
console.log(`Merged +${added} → total ${records.length} records, ${agg.builders.length} builders`);
console.log(`By county added: ${JSON.stringify(addedByCounty)}`);
