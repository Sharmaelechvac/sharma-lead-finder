// St. Johns County WATS adapter — plain GET, no session, no login.
// Verified 2026-11-15 (~/workspace/lead-finder-fix/staging/taps-2026-11-15/
// feeds-sweep-b.md): the search form 302s to a GET-driven results page that
// works directly with no cookies. This replaces the lost 2026-11-11 browser
// recipe. Result columns: PermitNo | Addr | PropUse | Issue Dt | Contractor.
// Contractor is the license holder's personal name in "LAST, FIRST MIDDLE"
// order (flipped to natural order here, same as the hand pull); rows whose
// Contractor is "OWNER" are owner-builders and are excluded.
// PermitType=1 (Building), PU=101 (1 SINGLE FAMILY DETACHED).
// The server is slow on search (~14s for a 14-day window) — chunk the window.
// cfg: { county, windowDays, chunkDays }
import { parseDate, cleanName } from "../normalize.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function fmtUS(d) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function isoFromUS(s) {
  const m = (s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : "";
}

// "AXTELL, PAUL GILBERT" -> "PAUL GILBERT AXTELL"; names without a comma
// (companies) pass through unchanged.
function flipName(raw) {
  const t = (raw || "").replace(/\s+/g, " ").trim();
  const at = t.indexOf(",");
  if (at < 0) return t;
  const last = t.slice(0, at).trim();
  const rest = t.slice(at + 1).trim();
  return rest ? `${rest} ${last}` : last;
}

const dec = (s) =>
  (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();

export async function fetchWats(cfg, log = []) {
  const windowDays = cfg.windowDays || 90;
  const chunkDays = cfg.chunkDays || 14;
  const byPermit = new Map();
  let ownerRows = 0;
  for (let off = 0; off < windowDays; off += chunkDays) {
    const to = new Date(Date.now() - off * 86400000);
    const from = new Date(Date.now() - Math.min(off + chunkDays - 1, windowDays - 1) * 86400000);
    const url =
      "https://webapp.sjcfl.us/WATSWebX/Permit/SearchResults.aspx?PermitType=1&PermitNo=&Clrsht=&Parcel=&Addr=&ProjNm=&CLNm=&CLId=&SepticNo=&Lgl1=&Lgl2=&Lgl3=&PU=101" +
      `&FromDt=${encodeURIComponent(fmtUS(from))}&ToDt=${encodeURIComponent(fmtUS(to))}&PP=False&Sort=&SortOrder=`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(90000) });
    if (!res.ok) throw new Error(`WATS HTTP ${res.status}`);
    const html = await res.text();
    for (const m of html.matchAll(/<tr class="Row"[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
        dec(c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")),
      );
      if (cells.length < 5) continue;
      const permitNo = cells[0];
      const contractor = cells[4];
      if (!permitNo) continue;
      if (!contractor || /^owner$/i.test(contractor)) {
        ownerRows++;
        continue;
      }
      if (byPermit.has(permitNo)) continue;
      byPermit.set(permitNo, {
        builder: cleanName(flipName(contractor)),
        address: cells[1] || "",
        date: parseDate(isoFromUS(cells[3])),
        permitNo,
        phone: "",
        website: "",
        county: cfg.county,
        source: "wats",
      });
    }
  }
  const records = [...byPermit.values()];
  log.push(
    `WATS ${cfg.county}: ${records.length} SFR records in ${windowDays}d (${ownerRows} OWNER rows excluded)`,
  );
  return records;
}
