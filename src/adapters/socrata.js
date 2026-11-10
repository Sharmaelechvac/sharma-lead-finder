import { monthsAgoIso, parseDate } from "../normalize.js";

const UA = "Mozilla/5.0 (compatible; SharmaLeadFinder/1.0)";

export async function fetchSocrata(cfg, log = []) {
  const since = monthsAgoIso(cfg.monthsBack || 12);
  const where = String(cfg.where || "1=1").replaceAll("{since}", since);
  const pageSize = cfg.pageSize || 1000;
  const maxRecords = cfg.maxRecords || 5000;
  const fields = cfg.fields || {};
  const records = [];
  let offset = 0;

  while (records.length < maxRecords) {
    const url = new URL(cfg.url);
    url.searchParams.set("$limit", String(pageSize));
    url.searchParams.set("$offset", String(offset));
    url.searchParams.set("$order", `${fields.date || "issue_permit_date"} DESC`);
    if (cfg.select) url.searchParams.set("$select", cfg.select);
    if (where) url.searchParams.set("$where", where);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Socrata HTTP ${res.status} ${text.slice(0, 180)}`);
    }
    const rows = await res.json();
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
