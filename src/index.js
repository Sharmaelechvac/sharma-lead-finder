import { renderPage } from "./html.js";
import { runLiveAdapters } from "./adapters/index.js";
import { JURISDICTIONS } from "./counties.js";
import { aggregate, STATUSES, slugId } from "./normalize.js";

const CACHE_KEY = "cache:payload";
const STATUS_KEY = "lead-status";

async function readJson(kv, key, fallback) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function payloadFrom(result, statusMap) {
  const agg = aggregate(result.records, statusMap);
  const liveSources = result.runs.filter((r) => r.ok).map((r) => `${r.name} (${r.records})`);
  const countyStatus = result.countyStatus || JURISDICTIONS.map((j) => {
    const run = (result.runs || []).find((r) => r.id === j.id);
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
    builders: agg.builders,
    counties: countyStatus,
    fetchedAt: result.finished || new Date().toISOString(),
    startedAt: result.started || null,
    liveSources,
    logs: result.logs || [],
    records: result.records || [],
    stats: {
      permits: result.records.length,
      custom: agg.customCount,
      production: agg.productionCount,
      skippedDnc: agg.skippedDnc,
      skippedNoBuilder: agg.skippedNoBuilder,
    },
  };
}

function carryForward(result, prev) {
  const prevRecords = (prev && prev.records) || [];
  const prevCounties = (prev && prev.counties) || [];
  const failed = (result.runs || []).filter((r) => !r.ok);
  const keep = new Set();
  for (const run of failed) {
    const j = JURISDICTIONS.find((x) => x.id === run.id);
    if (j && j.cfg && j.cfg.county) keep.add(j.cfg.county);
  }
  const carried = prevRecords.filter((r) => keep.has(r.county));
  const records = [...(result.records || []), ...carried];
  const countyStatus = (result.countyStatus || []).map((c) => {
    if (c.status === "live" || c.ok) return c;
    const prevC = prevCounties.find((x) => x.id === c.id);
    if (!prevC || !prevC.records) return c;
    return {
      ...c,
      records: prevC.records,
      lastScan: prevC.lastScan || c.lastScan,
      lastSuccessAt: prevC.lastSuccessAt || prevC.lastScan || null,
      error: c.error,
    };
  });
  return { ...result, records, countyStatus };
}

async function refresh(env) {
  const statusMap = await readJson(env.LEADS, STATUS_KEY, {});
  const prev = await readJson(env.LEADS, CACHE_KEY, null);
  const result = await runLiveAdapters(async (partial) => {
    const mid = payloadFrom(
      carryForward({ ...partial, finished: new Date().toISOString(), countyStatus: null }, prev),
      statusMap,
    );
    mid.records = mid.records || [];
    await env.LEADS.put(CACHE_KEY, JSON.stringify(mid));
  });
  const merged = carryForward(result, prev);
  const payload = payloadFrom(merged, statusMap);
  payload.records = merged.records;
  await env.LEADS.put(CACHE_KEY, JSON.stringify(payload));
  return payload;
}

async function getPayload(env, { force = false } = {}) {
  if (!force) {
    const cached = await readJson(env.LEADS, CACHE_KEY, null);
    if (cached && Array.isArray(cached.builders)) return cached;
  }
  return refresh(env);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function text(body, status = 200, type = "text/plain; charset=utf-8") {
  return new Response(body, { status, headers: { "content-type": type } });
}

async function handlePatch(env, id, request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const status = body.status != null ? String(body.status) : null;
  const notes = body.notes != null ? String(body.notes).slice(0, 2000) : null;
  if (status && !STATUSES.includes(status)) return json({ error: "Invalid status" }, 400);
  const key = slugId(id) === id ? id : id;
  const map = await readJson(env.LEADS, STATUS_KEY, {});
  const prev = map[key] || {};
  map[key] = {
    status: status || prev.status || "New",
    notes: notes != null ? notes : prev.notes || "",
    updatedAt: new Date().toISOString(),
  };
  await env.LEADS.put(STATUS_KEY, JSON.stringify(map));
  const cached = await readJson(env.LEADS, CACHE_KEY, null);
  if (cached && Array.isArray(cached.builders)) {
    const b = cached.builders.find((x) => x.id === key);
    if (b) {
      b.status = map[key].status;
      b.notes = map[key].notes;
      b.updatedAt = map[key].updatedAt;
      await env.LEADS.put(CACHE_KEY, JSON.stringify(cached));
    }
  }
  return json({ ok: true, id: key, ...map[key] });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/logo.png" && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    if (path === "/health") {
      return json({ ok: true, service: "sharma-leads", jurisdictions: JURISDICTIONS.length });
    }

    if (path === "/api/leads" && request.method === "GET") {
      try {
        const payload = await getPayload(env);
        return json(payload);
      } catch (err) {
        return json({ error: String(err && err.message ? err.message : err) }, 500);
      }
    }

    if (path === "/api/counties" && request.method === "GET") {
      const payload = await readJson(env.LEADS, CACHE_KEY, null);
      return json({
        counties: payload ? payload.counties : JURISDICTIONS.map((j) => ({
          id: j.id,
          name: j.name,
          kind: j.kind,
          priority: !!j.priority,
          alwaysInclude: !!j.alwaysInclude,
          vendor: j.vendor || null,
          portal: j.portal || null,
          notes: j.notes || null,
          configuredStatus: j.status,
          status: j.status,
          lastScan: null,
          records: 0,
        })),
      });
    }

    if (path === "/api/refresh" && (request.method === "POST" || request.method === "GET")) {
      try {
        const payload = await refresh(env);
        return json({
          ok: true,
          fetchedAt: payload.fetchedAt,
          stats: payload.stats,
          liveSources: payload.liveSources,
          logs: payload.logs,
        });
      } catch (err) {
        return json({ error: String(err && err.message ? err.message : err) }, 500);
      }
    }

    const patch = path.match(/^\/api\/leads\/([^/]+)$/);
    if (patch && request.method === "PATCH") {
      return handlePatch(env, decodeURIComponent(patch[1]), request);
    }

    if (path === "/" || path === "/counties" || path === "/index.html") {
      return text(renderPage(), 200, "text/html; charset=utf-8");
    }

    if (env.ASSETS) {
      const asset = await env.ASSETS.fetch(request);
      if (asset && asset.status !== 404) return asset;
    }
    return text("Not found", 404);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(refresh(env));
  },
};
