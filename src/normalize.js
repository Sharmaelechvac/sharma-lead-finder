// Do-not-contact (from sharma-outreach/do-not-contact.csv + standing exclusions).
// Never invent phones, websites, or builders. Hide DNC. Split production vs custom.

const DNC_SUBSTR = [
  "michael alan",
  "michaelalan",
  "iron shield",
  "lenhart electric",
  "truemark",
  "martins",
  "tampa shell",
  "del nero",
  "delnero",
  "danto",
  "dala",
];

// "adc" is too short for a substring match — use a word boundary.
// SAKC / S.A. Casey: skip per Bob Myers (2026-11-11, confirmed by Sanjay) —
// moved here from LOW_PRIORITY so these builders are hidden, not just flagged.
const DNC_WORD = [/\badc\b/i, /\bsakc\b/i, /s\.?\s*a\.?\s*casey/i, /sa casey/i];

const PRODUCTION = [
  "lennar",
  "d.r. horton",
  "dr horton",
  "d r horton",
  "drhorton",
  "pulte",
  "pulte home",
  "pulte group",
  "pultehomes",
  "meritage",
  "kb home",
  "kb homes",
  "taylor morrison",
  "taylormorrison",
  "centex",
  "ryan homes",
  "beazer",
  "toll brothers",
  "toll bros",
  "tollbros",
  "toll brothers",
  "toll bros",
  "tollbros",
  "landsea",
  "hanover family",
  "mattamy",
  "kolter",
  "highland homes",
  "m/i homes",
  "mi homes",
  "m i homes",
  "david weekley",
  "weekley homes",
  "holiday builders",
  "holiday build",
  "maronda",
  "dream finders",
  "dreamfinders",
  "av homes",
  "calatlantic",
  "ryland homes",
  "standard pacific",
  "neal communities",
  "gl homes",
  "stock development",
  "wci communities",
  "wci homes",
  "homes by westbay",
  "ashton woods",
  "lgi homes",
  "drees homes",
  "the drees company",
  "adams homes",
  "ici homes",
  "homes by towne",
  "century complete",
  "century communities",
  "drb group",
  "american heritage homes",
];

const LOW_PRIORITY = [];

const STATUSES = ["New", "Called", "Interested", "Not interested", "Won"];

export { STATUSES };

export function cleanName(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/\s+/g, " ")
    .replace(/,?\s*d\/b\/a\s+/i, " ")
    .trim();
}

export function normName(raw) {
  return cleanName(raw)
    .toLowerCase()
    .replace(/[.,'"()]/g, " ")
    .replace(/\b(llc|l l c|inc|incorporated|corp|corporation|co|ltd|limited|company|companies|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugId(raw) {
  const n = normName(raw) || cleanName(raw).toLowerCase();
  return n.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "unknown";
}

export function isDnc(raw) {
  const n = normName(raw);
  const full = cleanName(raw).toLowerCase();
  if (!n && !full) return true;
  if (DNC_SUBSTR.some((s) => n.includes(s) || full.includes(s))) return true;
  if (DNC_WORD.some((re) => re.test(n) || re.test(full))) return true;
  return false;
}

export function isProduction(raw) {
  const n = normName(raw);
  return PRODUCTION.some((s) => n.includes(s));
}

export function isLowPriority(raw) {
  const n = cleanName(raw);
  return LOW_PRIORITY.some((re) => re.test(n) || re.test(normName(raw)));
}

export function parseDate(v) {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

export function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export function monthsAgoIso(months) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function betterPhone(a, b) {
  const da = (a || "").replace(/\D/g, "");
  const db = (b || "").replace(/\D/g, "");
  if (db.length > da.length) return b;
  return a || b || "";
}

export function aggregate(records, statusMap = {}) {
  const byId = new Map();
  let skippedDnc = 0;
  let skippedNoBuilder = 0;

  for (const rec of records) {
    const builder = cleanName(rec.builder);
    if (!builder) {
      skippedNoBuilder++;
      continue;
    }
    if (isDnc(builder)) {
      skippedDnc++;
      continue;
    }
    const id = slugId(builder);
    const date = parseDate(rec.date);
    let row = byId.get(id);
    if (!row) {
      const saved = statusMap[id] || {};
      row = {
        id,
        name: builder,
        counties: [],
        permitCount: 0,
        latestDate: null,
        addresses: [],
        permitNos: [],
        phone: "",
        website: "",
        production: isProduction(builder),
        lowPriority: isLowPriority(builder),
        status: saved.status || "New",
        notes: saved.notes || "",
        updatedAt: saved.updatedAt || null,
      };
      byId.set(id, row);
    }
    row.permitCount++;
    if (rec.county && !row.counties.includes(rec.county)) row.counties.push(rec.county);
    if (date && (!row.latestDate || date > row.latestDate)) row.latestDate = date;
    const addr = (rec.address || "").replace(/\s+/g, " ").trim();
    if (addr && !row.addresses.includes(addr) && row.addresses.length < 5) row.addresses.push(addr);
    if (rec.permitNo && row.permitNos.length < 8) row.permitNos.push(String(rec.permitNo));
    if (rec.phone) row.phone = betterPhone(row.phone, String(rec.phone).trim());
    if (rec.website && !row.website) row.website = String(rec.website).trim();
    // Prefer a cleaner / longer official-looking name
    if (builder.length > row.name.length && !/d\/b\/a/i.test(builder)) row.name = builder;
  }

  const builders = [...byId.values()].sort((a, b) => {
    if (a.latestDate && b.latestDate && a.latestDate !== b.latestDate) return a.latestDate < b.latestDate ? 1 : -1;
    if (a.latestDate && !b.latestDate) return -1;
    if (!a.latestDate && b.latestDate) return 1;
    return b.permitCount - a.permitCount || a.name.localeCompare(b.name);
  });

  return {
    builders,
    skippedDnc,
    skippedNoBuilder,
    customCount: builders.filter((b) => !b.production).length,
    productionCount: builders.filter((b) => b.production).length,
  };
}
