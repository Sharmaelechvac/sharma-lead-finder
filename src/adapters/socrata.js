import { monthsAgoIso, parseDate } from "../normalize.js";

const UA = "Mozilla/5.0 (compatible; SharmaLeadFinder/1.0)";

// Socrata access notes (Bob Myers fix, 2026-11-11):
// - data.cityoforlando.net blocks Cloudflare Worker egress IPs with
//   "HTTP 403 Access Denied" on the JSON resource endpoint. The same query
//   returns 200 from ordinary IPs, and the collector (scripts/collect.mjs)
//   now also runs the adapters outside the Worker for that reason.
// - If an app token is configured (env SOCRATA_APP_TOKEN in the Worker, or
//   cfg.appToken), it is sent as X-App-Token — never hard-code a token here.
// - If the JSON endpoint still 403s, fall back to the dataset's export
//   endpoint (the same SODA query served as .csv) before giving up.

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      cur = "";
      rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      cur += ch;
    }
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).filter((r) => r.length > 1 || r[0] !== "").map((r) => {
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = r[idx] ?? "";
    });
    return obj;
  });
}

async function fetchPage(cfg, { limit, offset, where, orderField, token }) {
  const headers = { Accept: "application/json", "User-Agent": UA };
  if (token) headers["X-App-Token"] = token;

  const url = new URL(cfg.url);
  url.searchParams.set("$limit", String(limit));
  url.searchParams.set("$offset", String(offset));
  url.searchParams.set("$order", `${orderField} DESC`);
  if (cfg.select) url.searchParams.set("$select", cfg.select);
  if (where) url.searchParams.set("$where", where);

  const res = await fetch(url.toString(), { headers });
  if (res.ok) return res.json();

  const text = await res.text().catch(() => "");
  if (res.status !== 403) {
    throw new Error(`Socrata HTTP ${res.status} ${text.slice(0, 180)}`);
  }
  // Export-endpoint fallback: same query, .csv representation of the dataset.
  const csvUrl = new URL(url.toString().replace(/\.json($|\?)/, ".csv$1"));
  const csvRes = await fetch(csvUrl.toString(), {
    headers: { Accept: "text/csv", "User-Agent": UA, ...(token ? { "X-App-Token": token } : {}) },
  });
  if (!csvRes.ok) {
    const csvText = await csvRes.text().catch(() => "");
    throw new Error(`Socrata HTTP 403 on JSON and HTTP ${csvRes.status} on export endpoint ${csvText.slice(0, 120)}`);
  }
  return parseCsv(await csvRes.text());
}

export async function fetchSocrata(cfg, log = []) {
  const since = monthsAgoIso(cfg.monthsBack || 12);
  const where = String(cfg.where || "1=1").replaceAll("{since}", since);
  const pageSize = cfg.pageSize || 1000;
  const maxRecords = cfg.maxRecords || 5000;
  const fields = cfg.fields || {};
  const token =
    cfg.appToken ||
    (typeof process !== "undefined" && process.env && process.env.SOCRATA_APP_TOKEN) ||
    null;
  const records = [];
  let offset = 0;

  while (records.length < maxRecords) {
    const rows = await fetchPage(cfg, {
      limit: pageSize,
      offset,
      where,
      orderField: fields.date || "issue_permit_date",
      token,
    });
    if (!Array.isArray(rows) || rows.length === 0) break;

    for (const row of rows) {
      const builder = row[fields.builder];
      records.push({
        builder,
        address: row[fields.address] || "",
        date: parseDate(row[fields.date]),
        permitNo: row[fields.permitNo] || "",
        phone: row[fields.phone] || "",
        website: row[fields.website] || "",
        county: cfg.county,
        source: "socrata",
      });
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  log.push(`Socrata ${cfg.county}: ${records.length} permits since ${since}`);
  return records;
}
