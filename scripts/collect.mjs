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

// Carry forward previous records for any jurisdiction whose adapter failed.
const prevRecords = (prev && prev.records) || [];
const failed = (result.runs || []).filter((r) => !r.ok);
const keepCounties = new Set();
for (const run of failed) {
  const j = JURISDICTIONS.find((x) => x.id === run.id);
  if (j && j.cfg && j.cfg.county) keepCounties.add(j.cfg.county);
}
const carried = prevRecords.filter((r) => keepCounties.has(r.county));
const records = [...result.records, ...carried];

const agg = aggregate(records, {});
const counties = (result.countyStatus || []).map((c) => {
  const wasCarried = c.status !== "live" && keepCounties.size && records.some((r) => {
    const j = JURISDICTIONS.find((x) => x.id === c.id);
    return j && j.cfg && r.county === j.cfg.county;
  });
  if (wasCarried) {
    const prevC = (prev?.counties || []).find((x) => x.id === c.id);
    if (prevC) return { ...c, records: prevC.records || c.records, lastSuccessAt: prevC.lastSuccessAt || prevC.lastScan || null };
  }
  return c.status === "live" ? { ...c, lastSuccessAt: c.lastScan } : c;
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
