// Accela Citizen Access adapter — plain HTTP, NO browser (reverses the old
// "needs browser" stub). Verified 2026-11-15/16 against browser-pull ground
// truth on POLKCO + PASCO, with permit-mode spot-checks on BREVARD, CITRUS,
// MANATEE, PINELLAS, hcfl, NASSAU. Full findings + traps:
// ~/workspace/lead-finder-fix/staging/taps-2026-11-15/accela-findings.md
// (probe script: accela-search.mjs in the same folder).
//
// Flow per tenant session:
//   1. GET /<AGENCY>/Cap/CapHome.aspx?module=<M> -> cookies + __VIEWSTATE
//      (no __EVENTVALIDATION on these tenants, no CAPTCHA, no login —
//      anonymous public search works; no account was needed anywhere).
//   2. POST the same URL as a full postback (__EVENTTARGET=btnNewSearch)
//      with ddlGSPermitType=<Residential New value> + a ONE-DAY GS window.
//      GS silently truncates any search at 100 rows (verified on Pasco), so
//      the configured window is walked day by day, newest first, with a
//      fresh CapHome GET per day. -> 200 with the results grid inline
//      (10 rows/page), or 302 straight to CapDetail when the day had
//      exactly one result (handled: synthetic row from the detail page's
//      lblPermitNumber / lblPermitType spans). A failed day is logged and
//      skipped — one bad day never kills the run (abort only after >10
//      consecutive failures).
//   3. Pagination: re-POST the results page's own form with __EVENTTARGET =
//      the pager link's __doPostBack target parsed from the grid footer.
//      Tenant variations: cfg.searchMode "notype" (Brevard has no type
//      field at all; Nassau's type dropdown is empty until a postback) +
//      cfg.gridTypeInclude on the grid Type column; coarse-type tenants
//      (Citrus/Manatee "Residential" covers alterations) add cfg.descInclude
//      / descExclude filters on the detail Project Description.
//   4. GET each row's CapDetail page in-session; builder = best Licensed
//      Professional whose licence class is General/Building/Residential/CERT
//      Building, scored +3 exact Owner match, +2 Applicant-business match,
//      -3 trade keywords in the name (penalty ranks only, never excludes —
//      e.g. "WCM CONSTRUCTION & ROOFING" can be the real GC). Phone is read
//      ONLY from the winning LP's own block. Fallbacks (Owner, then
//      Applicant business) fire only when no GC-class LP exists; an Owner
//      fallback that is a bare person name is an owner-build and is dropped.
// Traps handled: Lee's GS date window defaults to the last 30 days and
// applies even to permit-number search (widen txtGSStartDate); LP city line
// is not always FL (national builders are HQ-addressed); TMP records
// (26TMP-######) have no CapDetail link and are skipped; Hillsborough Owner
// strings can carry a trailing "/PERSON NAME" (stripped before scoring).
//
// cfg: { agency, module, county, permitType (optional — otherwise resolved
// from the tenant's own permit-type dropdown), windowDays, maxPages,
// maxDetails, mergeMode: "union" }
import { parseDate, cleanName } from "../normalize.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
const strip = (h) =>
  dec(
    h
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  );

function parseForm(html) {
  const f = new Map();
  for (const m of html.matchAll(/<input[^>]*>/gi)) {
    const t = m[0];
    const n = (t.match(/name="([^"]*)"/) || [])[1];
    if (!n) continue;
    const v = dec((t.match(/value="([^"]*)"/) || [])[1] ?? "");
    const ty = (t.match(/type="([^"]*)"/) || [])[1] || "text";
    if ((ty === "checkbox" || ty === "radio") && !/checked/.test(t)) continue;
    if (!f.has(n)) f.set(n, v);
  }
  for (const m of html.matchAll(/<select[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/select>/gi)) {
    let s = (m[2].match(/<option[^>]*selected[^>]*value="([^"]*)"/i) || [])[1];
    if (s === undefined) s = (m[2].match(/<option[^>]*value="([^"]*)"/i) || [])[1] ?? "";
    f.set(m[1], dec(s));
  }
  return f;
}

function permitTypeOptions(html) {
  const m = html.match(
    /<select[^>]*name="ctl00\$PlaceHolderMain\$generalSearchForm\$ddlGSPermitType"[^>]*>([\s\S]*?)<\/select>/i,
  );
  if (!m) return [];
  return [...m[1].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/gi)].map((o) => ({
    value: dec(o[1]),
    label: dec(o[2]),
  }));
}

async function req(jar, url, opts = {}) {
  const h = {
    "User-Agent": UA,
    Accept: "text/html,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    ...(opts.headers || {}),
  };
  if (jar.map.size) h["Cookie"] = jar.header();
  const r = await fetch(url, { ...opts, headers: h, redirect: "manual" });
  jar.absorb(r);
  return r;
}

async function postForm(jar, url, fields) {
  const b = new URLSearchParams();
  for (const [k, v] of fields) b.set(k, v);
  return req(jar, url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: url,
      Origin: "https://aca-prod.accela.com",
    },
    body: b.toString(),
  });
}

function parseGrid(html) {
  const byCtl = {};
  for (const m of html.matchAll(/gdvPermitList_ctl(\d+)_lbl(\w+)">([^<]*)<\/span>/g)) {
    (byCtl[m[1]] ??= {})[m[2]] = dec(m[3]);
  }
  for (const m of html.matchAll(/gdvPermitList_ctl(\d+)_lblUpdatedTime[^>]*>([^<]*)<\/span>/g)) {
    (byCtl[m[1]] ??= {}).UpdatedTime = dec(m[2]);
  }
  const hrefs = {};
  for (const m of html.matchAll(/gdvPermitList_ctl(\d+)_hlPermitNumber" href="([^"]+)"/g)) {
    hrefs[m[1]] = dec(m[2]);
  }
  const rows = [];
  for (const ctl of Object.keys(byCtl).sort()) {
    const r = byCtl[ctl];
    const permitNo = r.PermitNumber1 || r.PermitNumber;
    if (!permitNo) continue;
    rows.push({
      permitNo,
      type: r.Type || "",
      address: r.Address || r.PermitAddress || "",
      status: r.Status || "",
      date: r.UpdatedTime || "",
      detailUrl: hrefs[ctl] || null,
    });
  }
  const showing = (html.match(/Showing\s+\d+-\d+\s+of\s+(\d+)/) || [])[1];
  const pager = {};
  for (const m of html.matchAll(/__doPostBack\(&#39;([^&]+)&#39;,&#39;&#39;\)">([^<]*)</g)) {
    if (/^\d+$/.test(m[2].trim()) || /Next/.test(m[2])) pager[m[2].trim()] = dec(m[1]);
  }
  return { rows, total: showing ? parseInt(showing) : rows.length, pager };
}

function toISO(d) {
  const m = (d || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : d || "";
}

const BUSINESS_HINT =
  /LLC|INC|CORP|COMPANY|CONSTRUCTION|BUILDERS?|HOMES|GROUP|ENTERPRISES|DEVELOPMENT|CONTRACTING|PROPERTIES|CUSTOM|DESIGN|BUILD|REALTY|INVESTMENTS|HOLDINGS|PARTNERS|ASSOCIATES|FOUNDATION|HABITAT/i;

// Hillsborough trap: names arrive as "LENNAR HOMES, LLC/CHRISTOPHER JAMES
// SMITH" (business + the individual's name after a slash) in BOTH the Owner
// field and the Licensed Professional business lines — keep the business
// segment.
function businessSegment(name) {
  if (!name || !name.includes("/")) return name;
  const parts = name.split("/").map((s) => s.trim()).filter(Boolean);
  return parts.find((p) => BUSINESS_HINT.test(p)) || parts[0] || name;
}

function parseDetail(html) {
  const text = strip(html);
  let owner =
    (text.match(/Owner:\s*([A-Z0-9][A-Z0-9 &,\.\-']{2,60}?)(?:\s*\*|\s+More Details|\s+OWNER:)/) || [])[1]?.trim() || "";
  owner = businessSegment(owner);
  const applicantBiz =
    (text.match(/Applicant:\s*[A-Za-z][A-Za-z \.\-']+?\s{2,}([A-Z][A-Za-z0-9 &,\.\-']{2,60}?)(?:\s+Work Phone|\s+Home Phone|\s+Mobile Phone|\s+\d)/) || [])[1]?.trim() || "";
  const rawSeg = html.slice(html.indexOf("Licensed Professional:"), html.indexOf("Project Description:"));
  const lines = rawSeg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .split(/<br\s*\/?>/i)
    .map((s) => dec(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")))
    .filter(Boolean);
  const lps = [];
  lines.forEach((ln, i) => {
    const m = ln.match(/(.+?)\s+([A-Z]{2,4}\d{4,})(?:-\d+)?\s*$/);
    if (!m) return;
    if (!/(General|Building|Residential|Roofing|Air Condition|Plumbing|Electrical|Electric|Mechanical|Irrigation|PRIVATE PROVIDER|CERT|A\/C|Cntr|Contractor)/.test(m[1])) return;
    let cityIdx = -1;
    for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
      if (/, [A-Z]{2},?\s+\d{5}/.test(lines[j])) {
        cityIdx = j;
        break;
      }
    }
    if (cityIdx < 2) return;
    const block = lines.slice(cityIdx - 2, i + 1).join(" ");
    const pm = block.match(/(?:Home Phone|Mobile Phone|Work Phone|Primary Phone):\s*\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{4})/);
    lps.push({ business: businessSegment(lines[cityIdx - 2]), cls: m[1].trim(), code: m[2], phone: pm ? pm[1] + pm[2] + pm[3] : "" });
  });
  const norm = (s) =>
    s.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+(LLC|INC|LTD|CORP)\b/g, "").replace(/\s+/g, " ").trim();
  const gcLps = lps.filter((l) => /General|Building|Residential/.test(l.cls));
  let builder = "";
  let builderPhone = "";
  let via = "";
  const scored = gcLps
    .map((l) => {
      let s = 0;
      const n = norm(l.business);
      if (owner && (norm(owner) === n || norm(owner).includes(n) || n.includes(norm(owner)))) s += 3;
      if (applicantBiz && (norm(applicantBiz).includes(n) || n.includes(norm(applicantBiz)))) s += 2;
      if (/EXPEDIT|PERMITTING|MASONRY|ROOFING|PLUMBING|ELECTRIC|MECHANICAL|AIR CONDITION/.test(n)) s -= 3;
      return { l, s };
    })
    .sort((a, b) => b.s - a.s);
  if (scored.length) {
    builder = scored[0].l.business;
    builderPhone = scored[0].l.phone || "";
    via = "lp";
  }
  if (!builder && owner && !/^\d/.test(owner)) {
    builder = owner;
    via = "owner";
  }
  if (!builder && applicantBiz && !/EXPEDIT/.test(applicantBiz.toUpperCase())) {
    builder = applicantBiz;
    via = "applicant";
  }
  const wlSeg = html.slice(html.indexOf("divWorkLocationDetail"), html.indexOf("divWorkLocationDetail") + 3000);
  const wlText = dec(wlSeg.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  const address = (wlText.match(/(\d{2,6}\s+[A-Z0-9 \.]+?\s+[A-Z ]+?\s+FL\s+\d{5})/) || [])[1]?.trim() || "";
  const status = (html.match(/lblRecordStatus">([^<]*)</) || [])[1]?.trim() || "";
  const descAt = text.indexOf("Project Description:");
  const description = descAt >= 0 ? text.slice(descAt + "Project Description:".length, descAt + 260).trim() : "";
  return { builder: builder.toUpperCase(), phone: builderPhone, via, address, status, description };
}

function fmtUS(d) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

export async function fetchAccela(cfg, log = []) {
  const base = `https://aca-prod.accela.com/${cfg.agency}`;
  const home = `${base}/Cap/CapHome.aspx?module=${cfg.module || "Building"}`;
  const windowDays = cfg.windowDays || 120;
  const maxDetails = cfg.maxDetails || 250;
  const jar = new Jar();
  const typeRe = cfg.gridTypeInclude ? new RegExp(cfg.gridTypeInclude, "i") : null;
  const typeExRe = cfg.gridTypeExclude ? new RegExp(cfg.gridTypeExclude, "i") : null;
  const descInRe = cfg.descInclude ? new RegExp(cfg.descInclude, "i") : null;
  const descExRe = cfg.descExclude ? new RegExp(cfg.descExclude, "i") : null;

  // Accela GS silently truncates any search at 100 rows (verified: a Pasco
  // 4-day search reported "of 100" while the same days sum to 104 single-day),
  // so the window is walked DAY BY DAY, newest first. Each day gets a fresh
  // CapHome GET (fresh viewstate) in the same cookie session.
  const byPermit = new Map();
  const detailCache = new Map();
  let permitType = cfg.permitType || "";
  let capHitDays = 0;
  let singleDays = 0;
  let failedDays = 0;
  let consecutiveFailures = 0;
  for (let dOff = 0; dOff < windowDays; dOff++) {
    const day = new Date(Date.now() - dOff * 86400000);
    try {
      let res = await req(jar, home);
      let html = await res.text();
      if (res.status !== 200) throw new Error(`CapHome HTTP ${res.status}`);
      if (dOff === 0 && /captcha/i.test(html)) {
        const err = new Error(`Accela ${cfg.agency}: CAPTCHA present on search page`);
        err.code = "needs_browser";
        throw err;
      }
      if (!permitType && cfg.searchMode !== "notype") {
        const opts = permitTypeOptions(html);
        const hit =
          opts.find((o) => /residential\/new/i.test(o.value)) ||
          opts.find((o) => /residential/i.test(o.label) && /new/i.test(o.label));
        if (!hit) throw new Error(`Accela ${cfg.agency}: no Residential-New permit type in dropdown`);
        permitType = hit.value;
      }
      const fields = parseForm(html);
      fields.set("__EVENTTARGET", "ctl00$PlaceHolderMain$btnNewSearch");
      fields.set("__EVENTARGUMENT", "");
      if (cfg.searchMode !== "notype") {
        fields.set("ctl00$PlaceHolderMain$generalSearchForm$ddlGSPermitType", permitType);
      }
      fields.set("ctl00$PlaceHolderMain$generalSearchForm$txtGSStartDate", fmtUS(day));
      fields.set("ctl00$PlaceHolderMain$generalSearchForm$txtGSEndDate", fmtUS(day));
      res = await postForm(jar, home, fields);
      if (res.status === 302) {
        // Exactly one result that day: ACA redirects straight to its
        // CapDetail page (same behaviour as permit-number search). Build a
        // synthetic grid row from the detail page's own header spans.
        const loc = res.headers.get("location") || "";
        if (!/CapDetail\.aspx/i.test(loc)) throw new Error(`search 302 to ${loc.slice(0, 80)}`);
        const detailUrl = new URL(loc, home).toString();
        const rd = await req(jar, detailUrl);
        if (!rd.ok) throw new Error(`single-result detail HTTP ${rd.status}`);
        const dhtml = await rd.text();
        const permitNo = (dhtml.match(/lblPermitNumber"[^>]*>([^<]+)</) || [])[1]?.trim();
        if (!permitNo) throw new Error("single-result detail has no lblPermitNumber");
        const typeLabel = (dhtml.match(/lblPermitType"[^>]*>([^<]+)</) || [])[1]?.trim() || "";
        if (!byPermit.has(permitNo)) {
          byPermit.set(permitNo, {
            permitNo,
            type: typeLabel,
            address: "",
            status: "",
            date: fmtUS(day),
            detailUrl,
          });
          detailCache.set(permitNo, dhtml);
        }
        singleDays++;
        consecutiveFailures = 0;
        continue;
      }
      html = await res.text();
      if (res.status !== 200) throw new Error(`search HTTP ${res.status}`);
      let page = 1;
      let dayRows = 0;
      while (true) {
        const g = parseGrid(html);
        dayRows = g.total;
        for (const r of g.rows) if (!byPermit.has(r.permitNo)) byPermit.set(r.permitNo, r);
        const collected = [...byPermit.values()].filter(
          (r) => toISO(r.date) === toISO(fmtUS(day)),
        ).length;
        if (collected >= g.total || page >= 20) break;
        const nextTarget = g.pager[String(page + 1)] || g.pager["Next >"];
        if (!nextTarget) break;
        const f2 = parseForm(html);
        f2.set("__EVENTTARGET", nextTarget);
        f2.set("__EVENTARGUMENT", "");
        res = await postForm(jar, home, f2);
        html = await res.text();
        if (res.status !== 200) throw new Error(`page HTTP ${res.status}`);
        page++;
      }
      if (dayRows >= 100) capHitDays++;
      consecutiveFailures = 0;
    } catch (e) {
      if (e && e.code === "needs_browser") throw e;
      // One bad day must not kill a 120-day walk (a transient 500 or a
      // session hiccup would otherwise lose the whole county run).
      failedDays++;
      consecutiveFailures++;
      log.push(`Accela ${cfg.agency} ${fmtUS(day)}: day skipped — ${e.message}`);
      if (consecutiveFailures > 10) {
        throw new Error(`Accela ${cfg.agency}: ${consecutiveFailures} consecutive day failures — aborting (${e.message})`);
      }
    }
  }

  let rows = [...byPermit.values()];
  if (typeRe || typeExRe) {
    rows = rows.filter((r) => {
      if (typeRe && !typeRe.test(r.type || "")) return false;
      if (typeExRe && typeExRe.test(r.type || "")) return false;
      return true;
    });
  }
  if (cfg.skipRevisions) rows = rows.filter((r) => !/-R\d+$/i.test(r.permitNo));

  // Newest first; TMP records have no detail page and are not issued permits.
  const usable = rows
    .filter((r) => r.detailUrl && !/TMP/i.test(r.permitNo))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const slice = usable.slice(0, maxDetails);
  const records = [];
  let ownerBuilds = 0;
  let noBuilder = 0;
  let descDropped = 0;
  for (const r of slice) {
    let dhtml = detailCache.get(r.permitNo);
    if (!dhtml) {
      const rd = await req(jar, new URL(r.detailUrl, base).toString());
      if (!rd.ok) {
        noBuilder++;
        continue;
      }
      dhtml = await rd.text();
    }
    const d = parseDetail(dhtml);
    if (!d.builder) {
      noBuilder++;
      continue;
    }
    // Owner-fallback bare person name = owner-build, not a company lead.
    if (d.via === "owner" && !BUSINESS_HINT.test(d.builder)) {
      ownerBuilds++;
      continue;
    }
    // Coarse-type tenants (Citrus/Manatee "Residential" covers alterations
    // too): keep only records whose project description says new build.
    if (descInRe || descExRe) {
      const desc = d.description || "";
      if (!desc || (descExRe && descExRe.test(desc)) || (descInRe && !descInRe.test(desc))) {
        descDropped++;
        continue;
      }
    }
    records.push({
      builder: cleanName(d.builder),
      address: (d.address || r.address || "").replace(/\s+/g, " ").trim(),
      date: parseDate(toISO(r.date)),
      permitNo: r.permitNo,
      phone: d.phone || "",
      website: "",
      county: cfg.county,
      source: "accela",
    });
  }
  log.push(
    `Accela ${cfg.county} (${cfg.agency}): ${byPermit.size} grid rows over ${windowDays}d (${capHitDays} days hit the 100-row cap, ${singleDays} single-result days, ${failedDays} days skipped on error), ${rows.length} after type filters, ${slice.length} details fetched, ${records.length} records (${ownerBuilds} owner-builds dropped, ${noBuilder} no builder found, ${descDropped} description-filtered)`,
  );
  return records;
}
