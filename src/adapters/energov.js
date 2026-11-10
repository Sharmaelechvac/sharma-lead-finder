import { parseDate, cleanName } from "../normalize.js";

const UA = "Mozilla/5.0 (compatible; SharmaLeadFinder/1.0)";

function headers(cfg) {
  return {
    "Content-Type": "application/json;charset=UTF-8",
    Accept: "application/json, text/plain, */*",
    "User-Agent": UA,
    Origin: cfg.origin,
    Referer: cfg.referer,
    tenantId: cfg.tenantId,
    tenantName: cfg.tenantName,
    "Tyler-TenantUrl": "home",
    "Tyler-Tenant-Culture": "en-US",
  };
}

async function getCriteria(cfg) {
  const res = await fetch(`${cfg.base}/energov/search/criteria`, { headers: headers(cfg) });
  if (!res.ok) throw new Error(`EnerGov criteria HTTP ${res.status}`);
  const body = await res.json();
  const crit = body.Result || body;
  if (!crit || !crit.PermitCriteria) throw new Error("EnerGov criteria missing PermitCriteria");
  return crit;
}

async function search(cfg, crit, keyword, page, pageSize) {
  const c = JSON.parse(JSON.stringify(crit));
  c.Keyword = keyword;
  c.SearchModule = 1;
  c.FilterModule = 1;
  c.PageNumber = page;
  c.PageSize = pageSize;
  c.SortBy = "relevance";
  const res = await fetch(`${cfg.base}/energov/search/search`, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify(c),
  });
  if (!res.ok) throw new Error(`EnerGov search HTTP ${res.status}`);
  const body = await res.json();
  return body.Result || body;
}

async function contacts(cfg, caseId) {
  const res = await fetch(`${cfg.base}/energov/entity/contacts/search/search`, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify({
      EntityId: caseId,
      ModuleId: 1,
      PageNumber: 1,
      PageSize: 50,
      SortField: "",
      IsSortInDesc: false,
    }),
  });
  if (!res.ok) return [];
  const body = await res.json();
  const result = body.Result || body;
  return Array.isArray(result) ? result : result.EntityResults || result.Contacts || [];
}

function contractorFromContacts(list) {
  if (!Array.isArray(list)) return { name: "", phone: "" };
  const owner = list.find((c) => /owner\s*\/?\s*builder/i.test(c.ContactTypeName || ""));
  const contractor = list.find((c) => (c.ContactTypeName || "") === "Contractor");
  const pick = contractor || null;
  // Skip owner-builders — these are not company leads.
  if (!pick && owner) return { name: "", phone: "", ownerBuilder: true };
  if (!pick) return { name: "", phone: "" };
  const name = cleanName(pick.GlobalEntityName || `${pick.FirstName || ""} ${pick.LastName || ""}`);
  const phone = pick.Phone || pick.Mobile || pick.BusinessPhone || "";
  return { name, phone };
}

function ymPrefixes(monthsBack) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const yy = String(d.getUTCFullYear()).slice(-2);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    out.push(`${yy}-${mm}`);
  }
  return out;
}

export async function fetchEnergov(cfg, log = []) {
  const monthsBack = cfg.monthsBack || 6;
  const maxPages = cfg.maxPagesPerMonth || 3;
  const pageSize = cfg.pageSize || 100;
  const maxLookups = cfg.maxContactLookups || 50;
  const casePrefix = cfg.casePrefix || "BLDR";
  const caseType = cfg.caseType || "New Construction - Single Family Residence";
  const crit = await getCriteria(cfg);
  const seen = new Set();
  const candidates = [];

  for (const ym of ymPrefixes(monthsBack)) {
    const prefix = `${casePrefix}-${ym}-`;
    const keyword = prefix.slice(0, -1); // BLDR-26-11
    for (let page = 1; page <= maxPages; page++) {
      const result = await search(cfg, crit, keyword, page, pageSize);
      const ents = result.EntityResults || [];
      let matched = 0;
      for (const e of ents) {
        const num = e.CaseNumber || "";
        if (!num.startsWith(prefix)) continue;
        matched++;
        if (e.CaseType !== caseType) continue;
        if (!e.CaseId || seen.has(e.CaseId)) continue;
        seen.add(e.CaseId);
        candidates.push(e);
      }
      if (ents.length < pageSize || matched === 0) break;
    }
  }

  candidates.sort((a, b) => String(b.IssueDate || b.ApplyDate || "").localeCompare(String(a.IssueDate || a.ApplyDate || "")));
  const slice = candidates.slice(0, maxLookups);
  const records = [];
  let ownerBuilders = 0;
  let noName = 0;

  for (const e of slice) {
    const con = await contacts(cfg, e.CaseId);
    const { name, phone, ownerBuilder } = contractorFromContacts(con);
    if (ownerBuilder) {
      ownerBuilders++;
      continue;
    }
    if (!name) {
      noName++;
      continue;
    }
    const addr = (e.AddressDisplay || "").replace(/\s+/g, " ").trim();
    records.push({
      builder: name,
      address: addr,
      date: parseDate(e.IssueDate || e.ApplyDate),
      permitNo: e.CaseNumber || "",
      phone,
      website: "",
      county: cfg.county,
      source: "energov",
    });
  }

  log.push(
    `EnerGov ${cfg.county}: ${candidates.length} SFR candidates, ${records.length} with contractor names (${ownerBuilders} owner-builder skipped, ${noName} missing name)`,
  );
  return records;
}
