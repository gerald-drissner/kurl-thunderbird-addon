/* kURL dashboard: render untrusted YOURLS data with DOM APIs, never innerHTML. */
"use strict";
const H = window.Helpers;
const $ = id => document.getElementById(id);
const t = (key, fallback) => browser.i18n.getMessage(key) || fallback;
const PAGE_SIZE = 10;
let currentOffset = 0;
let recentLinks = [];
let loadingMoreGeneration = -1;
let viewGeneration = 0;
let helperReady = false;

function message(el, value, error = false) {
  el.textContent = String(value);
  el.className = error ? "info error-message" : "info";
}
function formatNumber(value) {
  return (Number(value) || 0).toLocaleString();
}
function i18n() {
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const translated = browser.i18n.getMessage(el.dataset.i18nPlaceholder);
    if (translated) el.placeholder = translated;
  });
  document.querySelectorAll("[data-i18n-key]").forEach(el => {
    const translated = browser.i18n.getMessage(el.dataset.i18nKey);
    if (translated) el.textContent = translated;
  });
}
async function send(type, extra = {}) {
  const response = await browser.runtime.sendMessage({ type, ...extra });
  if (!response?.ok) throw new Error(response?.reason || "YOURLS request failed.");
  return response;
}
function parseLinks(raw) {
  const links = raw?.links || raw?.stats?.links || {};
  return (Array.isArray(links) ? links : Object.values(links))
    .filter(link => link && typeof link === "object");
}
function makeButton(title, callback, className = "secondary") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = title;
  button.addEventListener("click", callback);
  return button;
}
function makeLinkRow(link) {
  const row = document.createElement("article");
  row.className = "link-item";
  const texts = document.createElement("div");
  texts.className = "link-urls";
  const short = H.validHttpUrl(link.shorturl);
  const target = H.validHttpUrl(link.url || link.longurl);
  if (short) {
    const anchor = document.createElement("a");
    anchor.href = short;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.className = "link-short";
    anchor.textContent = short.replace(/^https?:\/\//i, "");
    texts.appendChild(anchor);
  } else {
    const span = document.createElement("span");
    span.textContent = "Invalid short URL";
    texts.appendChild(span);
  }
  const long = document.createElement("span");
  long.className = "link-long";
  long.title = target || String(link.url || link.longurl || "");
  long.textContent = String(link.title || target || "No valid target URL");
  if (link.title && target) {
    const detail = document.createElement("small");
    detail.className = "link-long";
    detail.textContent = target;
    texts.appendChild(detail);
  }
  texts.appendChild(long);
  const created = link.timestamp || link.date;
  if (created) {
    const date = document.createElement("small");
    date.className = "kurl-date";
    date.textContent = String(created).slice(0, 32);
    texts.appendChild(date);
  }
  row.appendChild(texts);
  const actions = document.createElement("div");
  actions.className = "kurl-actions";
  const clicks = document.createElement("span");
  clicks.className = "link-clicks";
  clicks.textContent = formatNumber(link.clicks) + " clicks";
  actions.appendChild(clicks);
  if (short) {
    actions.appendChild(makeButton(t("popupBtnCopy", "Copy"), async () => {
      try {
        await navigator.clipboard.writeText(short);
        message($("dashboard-feedback"), "Copied: " + short);
      } catch (error) {
        message($("dashboard-feedback"), "Cannot copy to clipboard: " + error.message, true);
      }
    }));
    actions.appendChild(makeButton(t("popupBtnStats", "Stats"), async () => {
      try {
        const result = await send("GET_STATS", { shortUrl: short });
        const data = result.data?.link || result.data?.url || {};
        message($("dashboard-feedback"), short + " — " + formatNumber(data.clicks) + " clicks");
      } catch (error) {
        message($("dashboard-feedback"), error.message, true);
      }
    }));
    if (helperReady) {
      actions.appendChild(makeButton(t("popupBtnDelete", "Delete"), async () => {
        const question = "Delete " + short +
          " from YOURLS permanently? This could break links referenced by WordPress posts or emails.";
        if (!window.confirm(question)) return;
        try {
          await send("DELETE_SHORTURL", { shortUrl: short });
          message($("dashboard-feedback"), "Deleted " + short);
          await refresh();
        } catch (error) {
          message($("dashboard-feedback"), error.message, true);
        }
      }, "danger"));
    }
  }
  row.appendChild(actions);
  return row;
}
function renderRows(container, items, emptyText) {
  container.replaceChildren();
  if (!items.length) {
    const p = document.createElement("p");
    p.textContent = emptyText;
    container.appendChild(p);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const item of items) fragment.appendChild(makeLinkRow(item));
  container.appendChild(fragment);
}
function filterRecent() {
  const query = $("filter-links").value.trim().toLowerCase();
  const visible = recentLinks.filter(link =>
    String(link.shorturl || "").toLowerCase().includes(query) ||
    String(link.url || link.longurl || "").toLowerCase().includes(query) ||
    String(link.title || "").toLowerCase().includes(query) ||
    String(link.keyword || "").toLowerCase().includes(query)
  );
  renderRows($("recent-links-container"), visible,
    query ? "No matching links in the loaded pages." : t("dashboardNoLinksFound", "No links found."));
}
async function loadMore(generation) {
  if (loadingMoreGeneration === generation) return;
  loadingMoreGeneration = generation;
  const area = $("view-more-container");
  area.replaceChildren();
  const loading = document.createElement("span");
  loading.textContent = t("dashboardStatusLoading", "Loading…");
  area.appendChild(loading);
  try {
    const response = await send("GET_RECENT_LINKS", {
      limit: PAGE_SIZE, start: currentOffset
    });
    if (generation !== viewGeneration) return;
    const links = parseLinks(response.data);
    recentLinks.push(...links);
    currentOffset += links.length;
    filterRecent();
    area.replaceChildren();
    if (links.length === PAGE_SIZE) {
      area.appendChild(makeButton(
        t("dashboardBtnViewMore", "Load more"),
        () => loadMore(viewGeneration)
      ));
    }
  } catch (error) {
    if (generation !== viewGeneration) return;
    area.replaceChildren();
    message($("dashboard-feedback"), "Recent links: " + error.message, true);
    area.appendChild(makeButton("Retry", () => loadMore(viewGeneration)));
  } finally {
    if (loadingMoreGeneration === generation) loadingMoreGeneration = -1;
  }
}
async function refresh() {
  const generation = ++viewGeneration;
  currentOffset = 0;
  recentLinks = [];
  $("view-more-container").replaceChildren();
  $("top-links-container").replaceChildren();
  $("recent-links-container").replaceChildren();
  $("refresh-btn").disabled = true;
  message($("dashboard-feedback"), t("dashboardStatusLoading", "Loading…"));
  try {
    const response = await send("GET_INFO");
    if (generation !== viewGeneration) return;
    const info = response.data;
    helperReady = info.helperReady;
    $("manual-regenerate").disabled = !helperReady || !$("manual-result").value;
    $("total-links").textContent = formatNumber(info.totalLinks);
    $("total-clicks").textContent = formatNumber(info.totalClicks);
    $("avg-clicks").textContent = info.totalLinks > 0
      ? (info.totalClicks / info.totalLinks).toFixed(1) : "0.0";
    $("server-status").textContent = t("dashboardStatusOnline", "Online");
    $("server-status").classList.add("status-online");
    $("info-server").textContent = info.base || "—";
    $("info-version").textContent = info.yourlsVersion || "Unknown";
    $("info-helper").textContent = info.helperReady
      ? "Ready (" + info.helperVersion + ")"
      : info.helperVersion ? "Outdated (" + info.helperVersion + ")" : "Not installed / unavailable";
    message($("dashboard-feedback"), "Connected to " + info.base);
    try { $("info-activity").textContent = formatNumber((await send("GET_LOG")).data.length); }
    catch { $("info-activity").textContent = "—"; }
  } catch (error) {
    if (generation !== viewGeneration) return;
    helperReady = false;
    $("server-status").textContent = t("dashboardStatusError", "Error");
    $("server-status").classList.remove("status-online");
    message($("dashboard-feedback"), error.message, true);
  }
  const topTask = (async () => {
    try {
      const top = await send("GET_TOP_LINKS", { limit: 10 });
      if (generation === viewGeneration) {
        renderRows($("top-links-container"), parseLinks(top.data), "No top links found.");
      }
    } catch (error) {
      if (generation === viewGeneration) {
        renderRows($("top-links-container"), [], "Could not load top links: " + error.message);
      }
    }
  })();
  const recentTask = generation === viewGeneration
    ? loadMore(generation) : Promise.resolve();
  await Promise.all([topTask, recentTask]);
  if (generation === viewGeneration) $("refresh-btn").disabled = false;
}
function selectedShort() {
  const value = $("manual-result").value.trim();
  if (!value) return "";
  const base = $("info-server").textContent;
  return H.extractKeyword(base, value) ? value : "";
}
function updateManualButtons() {
  $("manual-copy").disabled = !selectedShort();
  $("manual-regenerate").disabled = !helperReady || !selectedShort();
}
async function lookup() {
  const input = H.validHttpUrl($("manual-long").value);
  if (!input) return message($("manual-status"), "Enter a valid target URL.", true);
  $("manual-lookup").disabled = true;
  try {
    const r = await send("LOOKUP_URL", { longUrl: input, preferredShort: selectedShort() });
    $("manual-result").value = r.data.found ? r.data.shortUrl : "";
    if (r.data.found) $("manual-keyword").value = r.data.keyword;
    updateManualButtons();
    message($("manual-status"), r.data.found
      ? t("dashFound", "Existing short URL found.")
      : t("dashNotFound", "No existing short URL found. You can create one."));
  } catch (error) {
    message($("manual-status"), error.message, true);
  } finally { $("manual-lookup").disabled = false; }
}
async function generateOrUpdate(event) {
  event.preventDefault();
  const input = H.validHttpUrl($("manual-long").value);
  if (!input) return message($("manual-status"), "Enter a valid target URL.", true);
  const previous = selectedShort();
  if (previous && !helperReady) {
    return message($("manual-status"), "Updating existing links requires kURL Helper 1.1.5.", true);
  }
  if (previous && !confirm("Update the existing YOURLS short URL? The target or keyword may be used in existing WordPress posts and emails.")) return;
  $("manual-submit").disabled = true;
  message($("manual-status"), previous ? "Updating existing link…" : "Creating short URL…");
  try {
    const response = await send(previous ? "UPDATE_URL" : "SHORTEN_URL", {
      longUrl: input, shortUrl: previous,
      keyword: $("manual-keyword").value.trim(),
      title: $("manual-title-input").value.trim()
    });
    $("manual-result").value = response.shortUrl;
    $("manual-keyword").value = H.extractKeyword($("info-server").textContent, response.shortUrl);
    updateManualButtons();
    message($("manual-status"), previous ? "Existing short URL updated safely." :
      response.already ? "This URL already has a short link." : "Short URL created.");
    void refresh();
  } catch (error) {
    message($("manual-status"), error.message, true);
  } finally { $("manual-submit").disabled = false; }
}
async function regenerate() {
  const input = H.validHttpUrl($("manual-long").value);
  const short = selectedShort();
  if (!helperReady || !short || !input) return message($("manual-status"),
    "Choose an existing short URL and valid target first.", true);
  if (!confirm("Regenerate this short URL? A new keyword can BREAK existing links in WordPress and emails. Continue?")) return;
  $("manual-regenerate").disabled = true;
  try {
    const response = await send("REGENERATE_URL", {
      longUrl: input, shortUrl: short,
      // An empty keyword tells kURL Helper to generate a random one.
      keyword: $("manual-keyword").value.trim(),
      title: $("manual-title-input").value.trim()
    });
    $("manual-result").value = response.shortUrl;
    $("manual-keyword").value = response.keyword;
    message($("manual-status"), "Existing short URL regenerated safely.");
    void refresh();
  } catch (error) {
    message($("manual-status"), error.message, true);
  } finally { updateManualButtons(); }
}

i18n();
$("refresh-btn").addEventListener("click", refresh);
$("manual-form").addEventListener("submit", generateOrUpdate);
$("manual-lookup").addEventListener("click", lookup);
$("manual-regenerate").addEventListener("click", regenerate);
$("manual-long").addEventListener("input", () => {
  $("manual-result").value = "";
  updateManualButtons();
});
$("manual-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("manual-result").value);
    message($("manual-status"), "Copied to clipboard.");
  } catch (error) {
    message($("manual-status"), error.message, true);
  }
});
$("filter-links").addEventListener("input", filterRecent);
refresh();