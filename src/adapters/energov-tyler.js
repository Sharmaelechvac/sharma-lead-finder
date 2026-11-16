// Tyler-hosted EnerGov adapter (tylerhost.net tenants) — cfg-driven generalisation
// of the hand-run probe scripts in ~/workspace/energov-probe/ and
// ~/workspace/lead-finder-fix/staging/2026-11-14/ (Clay, DeSoto, Kissimmee,
// Hernando — all unlocked 2026-11-11/14 but never wired into the collector).
//
// Differs from src/adapters/energov.js (self-hosted Marion, tenantName header):
//  - tenant headers are tenantId:1 + Tyler-TenantUrl (+ tenantName on some
//    tenants), NO tenantName on plain Tyler-hosted tenants.
//  - Keyword sweep mode: search IGNORES PermitCriteria date filters on
//    Clay/DeSoto/Kissimmee, so the adapter sweeps case-number keywords
//    (Clay: monthly BLDR<MMYY> prefixes; DeSoto: BLDR + year; Kissimmee:
//    case-type words) and filters dates + case types client-side.
//  - Issue-date mode (Hernando): SearchModule=2/FilterModule=2 and the
//    PermitCriteria IssueDateFrom/To IS honoured — but only when PageNumber /
//    PageSize / SortBy are ALSO set inside PermitCriteria.
//  - Kissimmee (and Hernando) 403 unless a full browser UA is sent.
//  - Contacts are often empty on a first fast call (Clay/Hernando): retry once
//    after a short delay; Hernando contacts under rapid fire return empty
//    lists — space calls with contactDelayMs.
//  - Builder contact priority differs per tenant; DeSoto's Contractor contact
//    is often a TRADE firm (electrical/HVAC/roofing/plumbing) — skipNamePattern
//    guards it.
//
// cfg fields:
//   host, county, tenantUrl ('home' or tenant slug), tenantName (optional),
//   ua ('short' | 'browser'), mode ('keyword' | 'issuedates'),
//   keywords (keyword mode: static list; '{mmyy}' token expands to the last
//     monthsBack MMYY values, e.g. BLDR0926-style sweep for Clay — note the
//     probe passed bare '0926'/'1026'/'1126', NOT 'BLDR0926'),
//   keywordPages, caseTypeInclude (RegExp source), caseTypeExclude (RegExp source),
//   contactTypes (priority list), skipNamePattern (RegExp source),
//   windowDays (client-side IssueDate/ApplyDate window), maxLookups,
//   contactDelayMs, contactRetry (bool).
import { parseDate, cleanName } from "../normalize.js";

const UA_SHORT = "Mozilla/5.0";
const UA_BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function headers(cfg) {
  const h = {
    "Content-Type": "application/json;charset=UTF-8",
    Accept: "application/json, text/plain, */*",
    "User-Agent": cfg.ua === "browser" ? UA_BROWSER : UA_SHORT,
    Origin: cfg.host,
    Referer: `${cfg.host}/apps/selfservice/`,
    tenantId: "1",
    "Tyler-TenantUrl": cfg.tenantUrl || "home",
    "Tyler-Tenant-Culture": "en-US",
  };
  if (cfg.tenantName) h.tenantName = cfg.tenantName;
  return h;
}

function mmyyList(monthsBack) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(
      String(d.getUTCMonth() + 1).padStart(2, "0") + String(d.getUTCFullYear()).slice(-2),
    );
  }
  return out;
}

function expandKeywords(cfg) {
  const list = [];
  for (const kw of cfg.keywords || []) {
    if (kw === "{mmyy}") list.push(...mmyyList(cfg.monthsBack || 3));
    else if (kw === "{yyyy}") {
      const y = new Date().getUTCFullYear();
      list.push(String(y), String(y - 1));
    } else list.push(kw);
  }
  return list.length ? list : ["BLDR"];
}

export async function fetchEnergovTyler(cfg, log = []) {
  const base = `${cfg.host}/apps/selfservice/api`;
  const H = headers(cfg);
  const windowDays = cfg.windowDays || 90;
  const since = new Date(Date.now() - windowDays * 86400000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  const includeRe = cfg.caseTypeInclude ? new RegExp(cfg.caseTypeInclude, "i") : null;
  const excludeRe = cfg.caseTypeExclude ? new RegExp(cfg.caseTypeExclude, "i") : null;
  const skipNameRe = cfg.skipNamePattern ? new RegExp(cfg.skipNamePattern, "i") : null;

  const critRes = await fetch(`${base}/energov/search/criteria`, {
    headers: H,
    signal: AbortSignal.timeout(30000),
  });
  if (!critRes.ok) throw new Error(`EnerGov criteria HTTP ${critRes.status}`);
  const crit = (await critRes.json()).Result;
  if (!crit || !crit.PermitCriteria) throw new Error("EnerGov criteria missing PermitCriteria");

  async function searchPage(mut) {
    const c = JSON.parse(JSON.stringify(crit));
    mut(c);
    const r = await fetch(`${base}/energov/search/search`, {
      method: "POST",
      headers: H,
      body: JSON.stringify(c),
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) throw new Error(`EnerGov search HTTP ${r.status}`);
    const body = await r.json();
    if (body.Success === false) throw new Error("EnerGov search Success=false");
    const res = body.Result || body;
    return res.EntityResults || res.Results || [];
  }

  const seen = new Map();
  if (cfg.mode === "issuedates") {
    const pageSize = cfg.pageSize || 100;
    for (let page = 1; page <= (cfg.maxPages || 12); page++) {
      const ents = await searchPage((c) => {
        c.Keyword = "";
        c.SearchModule = 2;
        c.FilterModule = 2;
        c.SortBy = "relevance";
        c.PageNumber = page;
        c.PageSize = pageSize;
        c.PermitCriteria.PermitTypeId = "none";
        c.PermitCriteria.PermitStatusId = "none";
        c.PermitCriteria.IssueDateFrom = `${since}T00:00:00`;
        c.PermitCriteria.IssueDateTo = `${until}T23:59:59`;
        c.PermitCriteria.PageNumber = page;
        c.PermitCriteria.PageSize = pageSize;
        c.PermitCriteria.SortBy = "IssueDate";
        c.PermitCriteria.SortAscending = false;
      });
      let added = 0;
      for (const e of ents) {
        if (e.CaseId && !seen.has(e.CaseId)) {
          seen.set(e.CaseId, e);
          added++;
        }
      }
      // Pages overlap on these tenants; stop on a short page or when a page
      // adds nothing new (also guards against a tenant ignoring the dates).
      if (ents.length < pageSize || added === 0) break;
    }
  } else {
    const pages = cfg.keywordPages || 6;
    const pageSize = cfg.pageSize || 100;
    for (const kw of expandKeywords(cfg)) {
      for (let page = 1; page <= pages; page++) {
        const ents = await searchPage((c) => {
          c.Keyword = kw;
          c.SearchModule = 1;
          c.FilterModule = 1;
          c.PageNumber = page;
          c.PageSize = pageSize;
          c.SortBy = "relevance";
        });
        for (const e of ents) if (e.CaseId && !seen.has(e.CaseId)) seen.set(e.CaseId, e);
        if (ents.length < pageSize) break;
      }
    }
  }

  const caseNoRe = cfg.caseNumberInclude ? new RegExp(cfg.caseNumberInclude, "i") : null;
  const candidates = [...seen.values()]
    .filter((e) => {
      const t = e.CaseType || "";
      if (includeRe && !includeRe.test(t)) return false;
      if (excludeRe && excludeRe.test(t)) return false;
      if (caseNoRe && !caseNoRe.test(e.CaseNumber || "")) return false;
      return true;
    })
    .map((e) => ({ e, d: (e.IssueDate || e.ApplyDate || "").slice(0, 10) }))
    .filter((x) => x.d >= since && x.d <= until)
    .sort((a, b) => b.d.localeCompare(a.d));

  const contactTypes = cfg.contactTypes || ["Contractor"];
  const maxLookups = cfg.maxLookups || 100;
  const slice = candidates.slice(0, maxLookups);
  const records = [];
  let ownerBuilders = 0;
  let noName = 0;
  let tradeSkipped = 0;

  for (const { e, d } of slice) {
    let list = await contactsRaw(base, H, e.CaseId);
    if ((!list || list.length === 0) && cfg.contactRetry) {
      await sleep(1200);
      list = await contactsRaw(base, H, e.CaseId);
    }
    if (cfg.contactDelayMs) await sleep(cfg.contactDelayMs);
    list = list || [];
    const hasOB = list.some((c) => /owner\s*\/?\s*builder/i.test(c.ContactTypeName || ""));
    const pick = pickBuilder(list, contactTypes);
    if (!pick.name) {
      if (hasOB) ownerBuilders++;
      else noName++;
      continue;
    }
    if (skipNameRe && skipNameRe.test(pick.name)) {
      tradeSkipped++;
      continue;
    }
    const addr = (
      e.AddressDisplay ||
      (e.Address && e.Address.FullAddress) ||
      e.MainAddress ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
    records.push({
      builder: pick.name,
      address: addr,
      date: parseDate(e.IssueDate || e.ApplyDate),
      permitNo: e.CaseNumber || "",
      phone: pick.phone || "",
      website: "",
      county: cfg.county,
      source: "energov",
    });
  }

  log.push(
    `EnerGov Tyler ${cfg.county}: ${seen.size} swept, ${candidates.length} SFR candidates in ${windowDays}d window, ${records.length} with contractor names (${ownerBuilders} owner-builder skipped, ${noName} no builder-type contact, ${tradeSkipped} trade-firm skipped)`,
  );
  return records;
}

async function contactsRaw(base, H, caseId) {
  try {
    const r = await fetch(`${base}/energov/entity/contacts/search/search`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        EntityId: caseId,
        ModuleId: 1,
        PageNumber: 1,
        PageSize: 50,
        SortField: "",
        IsSortInDesc: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return [];
    const body = await r.json();
    const res = body.Result || body;
    return Array.isArray(res) ? res : res.EntityResults || res.Contacts || [];
  } catch {
    return [];
  }
}

function pickBuilder(list, types) {
  for (const t of types) {
    const c = list.find((x) => (x.ContactTypeName || "") === t);
    if (!c) continue;
    const name = cleanName(
      c.GlobalEntityName || `${c.FirstName || ""} ${c.LastName || ""}`.trim(),
    );
    if (name && !/admin close/i.test(name)) {
      return { name, phone: c.Phone || c.Mobile || c.BusinessPhone || "" };
    }
  }
  return { name: "", phone: "" };
}
