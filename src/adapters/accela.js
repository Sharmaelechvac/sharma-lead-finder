// Accela Citizen Access is an ASP.NET portal (viewstate / session).
// A Cloudflare Worker cannot reliably search it without a browser.
export async function fetchAccela(_cfg, log = []) {
  log.push("Accela: needs browser (not fetched)");
  const err = new Error("needs_browser");
  err.code = "needs_browser";
  throw err;
}
