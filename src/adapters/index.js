import { JURISDICTIONS, liveJurisdictions } from "../counties.js";
import { fetchSocrata } from "./socrata.js";
import { fetchArcgis } from "./arcgis.js";
import { fetchEnergov } from "./energov.js";
import { fetchAccela } from "./accela.js";

export const ADAPTERS = {
  socrata: fetchSocrata,
  arcgis: fetchArcgis,
  energov: fetchEnergov,
  accela: fetchAccela,
};

export async function runLiveAdapters(onProgress) {
  const logs = [];
  const records = [];
  const runs = [];
  const started = new Date().toISOString();

  const live = liveJurisdictions().slice().sort((a, b) => {
    const rank = (j) => (j.adapter === "socrata" ? 0 : j.adapter === "arcgis" ? 1 : 2);
    return rank(a) - rank(b);
  });
  for (const j of live) {
    const fn = ADAPTERS[j.adapter];
    const run = {
      id: j.id,
      name: j.name,
      vendor: j.vendor || j.adapter,
      status: "live",
      ok: false,
      records: 0,
      error: null,
      finishedAt: null,
    };
    if (!fn) {
      run.status = "failed";
      run.error = `No adapter implemented for ${j.adapter}`;
      runs.push(run);
      continue;
    }
    try {
      const rows = await fn(j.cfg, logs);
      run.ok = true;
      run.records = rows.length;
      run.finishedAt = new Date().toISOString();
      records.push(...rows);
    } catch (err) {
      run.ok = false;
      run.status = err && err.code === "needs_browser" ? "needs_browser" : "failed";
      run.error = err && err.message ? err.message : String(err);
      run.finishedAt = new Date().toISOString();
      logs.push(`${j.name}: ${run.error}`);
    }
    runs.push(run);
    if (typeof onProgress === "function") {
      await onProgress({ records: records.slice(), runs: runs.slice(), logs: logs.slice() });
    }
  }

  const countyStatus = JURISDICTIONS.map((j) => {
    const run = runs.find((r) => r.id === j.id);
    return {
      id: j.id,
      name: j.name,
      kind: j.kind,
      priority: !!j.priority,
      alwaysInclude: !!j.alwaysInclude,
      vendor: j.vendor || run?.vendor || null,
      portal: j.portal || null,
      notes: j.notes || null,
      configuredStatus: j.status,
      status: run ? (run.ok ? "live" : run.status) : j.status,
      lastScan: run ? run.finishedAt : null,
      records: run ? run.records : 0,
      error: run ? run.error : null,
    };
  });

  return {
    records,
    logs,
    runs,
    countyStatus,
    started,
    finished: new Date().toISOString(),
  };
}
