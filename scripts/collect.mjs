// Lead Finder collector — runs OUTSIDE Cloudflare Workers (Jarvis VM / CI).
// Why: data.cityoforlando.net returns HTTP 403 to Cloudflare Worker egress IPs,
// but the same Socrata endpoint returns 200 from ordinary IPs with no app token.
// This script runs the same adapters the Worker uses, aggregates the same way,
// and writes docs/data.json for the GitHub Pages build of the Lead Finder.
// Previous successful records for a failed source are carried forward, same as
// the Worker's KV carry-forward, so a failed run never wipes a county's leads.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runLiveAdapters } from "../src/adapters/index.js";
import { JURISDICTIONS } from "../src/counties.js";
import { aggregate } from "../src/normalize.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "docs", "data.json");

let prev = null;
try {
  prev = JSON.parse(await readFile(outPath, "utf8"));
} catch {
  prev = null;
}

const result = await runLiveAdapters(null);

// Record assembly — a collect run must never wipe a county's leads:
//  - Adapter county, run OK, cfg.mergeMode "replace" (full-window feeds:
//    Socrata / ArcGIS / Marion EnerGov): fresh records replace previous.
//  - Adapter county, run OK, cfg.mergeMode "union" (windowed Tyler-hosted
//    EnerGov sweeps pull only a recent window): fresh records UNION with
//    previous records for that county, deduped on (county, permitNo),
//    fresh record wins.
//  - Adapter county, run FAILED: previous records carry forward.
//  - County with NO adapter (hand-loaded): previous records carry forward.
// (Before 2026-11-15 only the failed-adapter case carried forward, so a
// collect run silently dropped every hand-loaded county.)
const prevRecords = (prev && prev.records) || [];
const modeByCounty = new Map();
for (const run of result.runs || []) {
  const j = JURISDICTIONS.find((x) => x.id === run.id);
  if (j && j.cfg && j.cfg.county) {
    let mode = run.ok ? j.cfg.mergeMode || "replace" : "carry";
    // Live-0 guard (documented for the ArcGIS counties 2026-11-14): a
    // "successful" run that returns 0 records while the board already holds
    // records for the county is a transient empty response, not a deletion
    // order — carry the previous records forward.
    if (mode === "replace" && run.ok && run.records === 0 && prevRecords.some((r) => r.county === j.cfg.county)) {
      mode = "carry";
    }
    modeByCounty.set(j.cfg.county, mode);
  }
}
const records = [...result.records];
const seenKeys = new Set(records.map((r) => `${r.county}|${r.permitNo}`));
for (const r of prevRecords) {
  const mode = modeByCounty.get(r.county);
  if (mode === undefined || mode === "carry") {
    records.push(r);
  } else if (mode === "union") {
    const k = `${r.county}|${r.permitNo}`;
    if (!seenKeys.has(k)) {
      seenKeys.add(k);
      records.push(r);
    }
  }
  // "replace": previous records for the county are dropped (fresh pull wins).
}

const agg = aggregate(records, {});
const runIds = new Set((result.runs || []).map((r) => r.id));
const counties = (result.countyStatus || []).map((c) => {
  const prevC = (prev?.counties || []).find((x) => x.id === c.id);
  if (!runIds.has(c.id)) {
    // No adapter ran for this jurisdiction (hand-loaded or not yet tapped):
    // preserve its previous display state so the board doesn't regress.
    if (prevC && (prevC.records || 0) > 0) {
      return { ...c, status: prevC.status || c.status, records: prevC.records, error: null, lastSuccessAt: prevC.lastSuccessAt || prevC.lastScan || null };
    }
    return c;
  }
  if (c.status !== "live" && prevC) {
    // Adapter failed: records were carried forward — keep prior counts.
    const j = JURISDICTIONS.find((x) => x.id === c.id);
    const n = j && j.cfg ? records.filter((r) => r.county === j.cfg.county).length : 0;
    if (n > 0) return { ...c, records: n, lastSuccessAt: prevC.lastSuccessAt || prevC.lastScan || null };
  }
  if (c.status === "live") {
    // Report the county's total on the board (union counties exceed the
    // single-run count), not just this run's fresh records.
    const j = JURISDICTIONS.find((x) => x.id === c.id);
    const n = j && j.cfg ? records.filter((r) => r.county === j.cfg.county).length : c.records;
    return { ...c, records: n, lastSuccessAt: c.lastScan };
  }
  return c;
});

const payload = {
  builders: agg.builders,
  counties,
  fetchedAt: result.finished || new Date().toISOString(),
  startedAt: result.started || null,
  liveSources: result.runs.filter((r) => r.ok).map((r) => `${r.name} (${r.records})`),
  logs: result.logs || [],
  records,
  stats: {
    permits: records.length,
    custom: agg.customCount,
    production: agg.productionCount,
    skippedDnc: agg.skippedDnc,
    skippedNoBuilder: agg.skippedNoBuilder,
  },
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(payload));
console.log(`Wrote ${outPath}`);
console.log(`Live sources: ${payload.liveSources.join(", ") || "none"}`);
console.log(`Permits: ${payload.stats.permits} · Custom: ${payload.stats.custom} · Production: ${payload.stats.production} · Skipped DNC: ${payload.stats.skippedDnc}`);
for (const c of counties.filter((x) => x.status === "live" || x.error)) {
  console.log(`${c.name}: ${c.status}${c.error ? " — " + c.error : ""} (${c.records} records)`);
}
