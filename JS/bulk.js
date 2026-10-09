/* Pasted-URL bulk creator. Never touches WordPress posts or the address book. */
"use strict";
const H = window.Helpers;
const $ = id => document.getElementById(id);
const t = (key, fallback) => browser.i18n.getMessage(key) || fallback;
let running = false;
let stopRequested = false;
let results = [];
const MAX_ROWS = 250;
function status(value) { $("bulk-status").textContent = value; }
function localize() {
  document.querySelectorAll("[data-i18n-key]").forEach(el => {
    const message = browser.i18n.getMessage(el.dataset.i18nKey);
    if (message) el.textContent = message;
  });
}
function parseRows() {
  const trimmed = $("bulk-input").value.trim();
  if (!trimmed) return [];
  const raw = trimmed.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (raw.length > MAX_ROWS) throw new Error("Maximum " + MAX_ROWS + " URLs per run.");
  const found = new Set();
  const list = [];
  for (const entry of raw) {
    const url = H.validHttpUrl(entry);
    if (!url) throw new Error("Invalid URL on line " + (list.length + 1) + ": " + entry.slice(0, 80));
    if (!found.has(url)) { found.add(url); list.push(url); }
  }
  return list;
}
function render() {
  const container = $("bulk-results");
  container.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const entry of results) {
    const row = document.createElement("div");
    row.className = "link-item";
    const target = document.createElement("span");
    target.className = "link-long";
    target.textContent = entry.longUrl;
    row.appendChild(target);
    if (H.validHttpUrl(entry.shortUrl)) {
      const a = document.createElement("a");
      a.href = entry.shortUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = entry.shortUrl;
      row.appendChild(a);
    }
    const note = document.createElement("span");
    note.textContent = entry.error ? "Error: " + entry.error :
      entry.already ? t("bulkExisting", "Existing") : t("bulkCreated", "Created");
    row.appendChild(note);
    fragment.appendChild(row);
  }
  container.appendChild(fragment);
  $("bulk-copy").disabled = !results.some(x => x.shortUrl);
}
$("bulk-preview").addEventListener("click", () => {
  if (running) return;
  try {
    const urls = parseRows();
    status(urls.length + " unique URLs ready. Existing links will be reused.");
  } catch (error) { status(error.message); }
});
$("bulk-start").addEventListener("click", async () => {
  if (running) return;
  let urls;
  try { urls = parseRows(); } catch (error) { return status(error.message); }
  if (!urls.length) return status("Enter at least one URL.");
  running = true;
  stopRequested = false;
  results = [];
  render();
  $("bulk-start").disabled = true;
  $("bulk-preview").disabled = true;
  $("bulk-stop").disabled = false;
  $("bulk-size").disabled = true;
  $("bulk-input").disabled = true;
  const batchSize = Number($("bulk-size").value) || 10;
  let succeeded = 0, failed = 0, reused = 0;
  try {
    for (let offset = 0; offset < urls.length && !stopRequested; offset += batchSize) {
      const slice = urls.slice(offset, offset + batchSize);
      for (const longUrl of slice) {
        // Sequential requests avoid hammering small self-hosted YOURLS servers.
        if (stopRequested) break;
        try {
          const response = await browser.runtime.sendMessage({ type: "SHORTEN_URL", longUrl });
          if (!response?.ok || !H.validHttpUrl(response.shortUrl)) {
            throw new Error(response?.reason || "No valid short URL returned.");
          }
          results.push({ longUrl, shortUrl: response.shortUrl, already: !!response.already });
          succeeded++;
          if (response.already) reused++;
        } catch (error) {
          results.push({ longUrl, error: String(error.message || error).slice(0, 200) });
          failed++;
        }
        $("bulk-progress").value = Math.round((results.length / urls.length) * 100);
        status(results.length + "/" + urls.length + " processed — " +
          succeeded + " successful (" + reused + " existing), " + failed + " failed.");
        render();
      }
    }
  } finally {
    running = false;
    $("bulk-start").disabled = false;
    $("bulk-preview").disabled = false;
    $("bulk-stop").disabled = true;
    $("bulk-size").disabled = false;
    $("bulk-input").disabled = false;
    if (stopRequested) status("Stopped. " + results.length + "/" + urls.length + " URLs processed.");
  }
});
$("bulk-stop").addEventListener("click", () => {
  stopRequested = true;
  $("bulk-stop").disabled = true;
  status("Stopping after current request…");
});
$("bulk-copy").addEventListener("click", async () => {
  const text = results.filter(r => r.shortUrl).map(r => r.longUrl + "\t" + r.shortUrl).join("\n");
  if (!text) return;
  try { await navigator.clipboard.writeText(text); status("Copied original and short URLs."); }
  catch (error) { status(error.message); }
});
localize();
