import { parseDate } from "../normalize.js";

const UA = "SharmaLeadFinder/1.0 (Sharma Electric & HVAC; public permit research)";

// Generic ArcGIS Feature/MapServer query adapter. Used when a county publishes
// a public layer that includes a builder/contractor name field.
export async function fetchArcgis(cfg, log = []) {
  const pageSize = cfg.pageSize || 1000;
  const maxRecords = cfg.maxRecords || 5000;
  const fields = cfg.fields || {};
  if (!fields.builder) {
    throw new Error("ArcGIS layer has no builder/contractor field configured");
  }
  const records = [];
  let offset = 0;
  while (records.length < maxRecords) {
    const url = new URL(cfg.url);
    url.searchParams.set("f", "json");
    url.searchParams.set("where", cfg.where || "1=1");
    url.searchParams.set("outFields", cfg.outFields || "*");
    url.searchParams.set("returnGeometry", "false");
    url.searchParams.set("resultRecordCount", String(pageSize));
    url.searchParams.set("resultOffset", String(offset));
    if (cfg.orderBy) url.searchParams.set("orderByFields", cfg.orderBy);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (!res.ok) throw new Error(`ArcGIS HTTP ${res.status}`);
    const body = await res.json();
    if (body.error) throw new Error(body.error.message || "ArcGIS error");
    const features = body.features || [];
    for (const f of features) {
      const a = f.attributes || {};
      records.push({
        builder: a[fields.builder],
        address: a[fields.address] || "",
        date: parseDate(a[fields.date]),
        permitNo: a[fields.permitNo] || "",
        phone: a[fields.phone] || "",
        website: a[fields.website] || "",
        county: cfg.county,
        source: "arcgis",
      });
    }
    if (features.length < pageSize || body.exceededTransferLimit === false) break;
    if (features.length === 0) break;
    offset += features.length;
  }
  log.push(`ArcGIS ${cfg.county}: ${records.length} permits`);
  return records;
}
