// Columbia County PermitSearch adapter — ASP.NET WebForms postback.
// Verified end-to-end 2026-11-15 (feeds-sweep-b.md + columbia-sample.mjs in
// ~/workspace/lead-finder-fix/staging/taps-2026-11-15/): GET the search page
// with a cookie jar, harvest viewstate/CSRF, POST ddPermitType=18
// ("New Residential Construction") + date range. IMPORTANT: the form's
// btnSaveToExcel / btnSaveToMap fields must NOT be submitted — ASP.NET fires
// whichever button field is present (the map button returns a KML download).
// Results table: Permit Info (# + Issued date) | Project Address (Type /
// Parcel / Address / Owner) | Contractor list with license numbers.
// Builder rule: the contractor list mixes the GC with every trade — the
// builder is the CGC / CBC / CRC license holder (EC/CAC/CFC/CCC are trades).
// Records with no GC-class license holder are skipped (counted in the log).
// cfg: { county, windowDays, chunkDays }
import { parseDate, cleanName } from "../normalize.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const PAGE = "https://www.columbiacountyfla.com/PermitSearch/";

class Jar {
  constructor() {
    this.map = new Map();
  }
  absorb(r) {
    for (const c of r.headers.getSetCookie?.() || []) {
      const [p] = c.split(";");
      const i = p.indexOf("=");
      if (i > 0) this.map.set(p.slice(0, i).trim(), p.slice(i + 1).trim());
    }
  }
  header() {
    return [...this.map].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

const dec = (s) =>
  (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
const cellText = (h) => dec(h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));

function fmtUS(d) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}
function isoFromUS(s) {
  const m = (s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : "";
}

export async function fetchColumbia(cfg, log = []) {
  const windowDays = cfg.windowDays || 90;
  const chunkDays = cfg.chunkDays || 45;
  const byPermit = new Map();
  let noGc = 0;
  for (let off = 0; off < windowDays; off += chunkDays) {
    const to = new Date(Date.now() - off * 86400000);
    const from = new Date(Date.now() - Math.min(off + chunkDays - 1, windowDays - 1) * 86400000);
    const jar = new Jar();
    let res = await fetch(PAGE, { headers: { "User-Agent": UA } });
    jar.absorb(res);
    if (!res.ok) throw new Error(`Columbia PermitSearch GET HTTP ${res.status}`);
    const html = await res.text();
    const fields = new Map();
    for (const m of html.matchAll(/<input[^>]*>/gi)) {
      const t = m[0];
      const n = (t.match(/name="([^"]*)"/) || [])[1];
      if (!n) continue;
      if (!fields.has(n)) fields.set(n, dec((t.match(/value="([^"]*)"/) || [])[1] ?? ""));
    }
    // Only the clicked button may be present in the POST body.
    fields.delete("ctl00$MainContent$btnSaveToExcel");
    fields.delete("ctl00$MainContent$btnSaveToMap");
    fields.delete("ctl00$LetUsKnow");
    fields.set("__EVENTTARGET", "");
    fields.set("__EVENTARGUMENT", "");
    fields.set("ctl00$MainContent$ddPermitType", "18");
    fields.set("ctl00$MainContent$startDate", fmtUS(from));
    fields.set("ctl00$MainContent$endDate", fmtUS(to));
    fields.set("ctl00$MainContent$SearchText", "");
    fields.set("ctl00$MainContent$Searchbutton", "Search");
    const body = new URLSearchParams();
    for (const [k, v] of fields) body.set(k, v);
    res = await fetch(PAGE, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: jar.header(),
        Referer: PAGE,
      },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Columbia PermitSearch POST HTTP ${res.status}`);
    const out = await res.text();
    for (const m of out.matchAll(/<tr class="ps-row[^"]*">([\s\S]*?)<\/tr>/gi)) {
      const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1]);
      if (cells.length < 3) continue;
      const info = cellText(cells[0]);
      const permitNo = (info.match(/#\s*(\d+)/) || [])[1];
      if (!permitNo || byPermit.has(permitNo)) continue;
      const issued = (info.match(/Issued:\s*(\d{1,2}\/\d{1,2}\/\d{4})/) || [])[1] || "";
      const addrM = cellText(cells[1]).match(/Address:\s*(.+?)\s*Owner:/);
      const address = addrM ? addrM[1].trim() : "";
      // Contractor cell: <strong>NAME</strong><br/> Lic: PREFIX1234567 blocks.
      let builder = "";
      for (const cm of cells[2].matchAll(/<strong>([^<]+)<\/strong>\s*<br\s*\/?>\s*Lic:\s*([A-Z]{2,4})\d+/gi)) {
        if (/^(CGC|CBC|CRC)$/i.test(cm[2])) {
          builder = dec(cm[1]);
          break;
        }
      }
      if (!builder) {
        noGc++;
        continue;
      }
      byPermit.set(permitNo, {
        builder: cleanName(builder),
        address,
        date: parseDate(isoFromUS(issued)),
        permitNo,
        phone: "",
        website: "",
        county: cfg.county,
        source: "columbia",
      });
    }
  }
  const records = [...byPermit.values()];
  log.push(
    `Columbia PermitSearch: ${records.length} New Residential Construction records in ${windowDays}d (${noGc} skipped — no CGC/CBC/CRC license holder listed)`,
  );
  return records;
}
