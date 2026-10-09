/* Local, URL-free diagnostic activity log. */
"use strict";
const $ = id => document.getElementById(id);
const t = (key, fallback) => browser.i18n.getMessage(key) || fallback;
document.querySelectorAll("[data-i18n-key]").forEach(el => {
  const translated = browser.i18n.getMessage(el.dataset.i18nKey);
  if (translated) el.textContent = translated;
});
async function load() {
  const area = $("log-results");
  area.replaceChildren();
  try {
    const response = await browser.runtime.sendMessage({ type: "GET_LOG" });
    if (!response?.ok) throw new Error(response?.reason || "Cannot load log.");
    const entries = response.data || [];
    $("log-status").textContent = entries.length + " " + t("logEntries", "entries in the last 7 days");
    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = "link-item";
      const date = new Date(entry.time);
      const when = document.createElement("time");
      when.textContent = Number.isNaN(+date) ? "Unknown date" : date.toLocaleString();
      const action = document.createElement("span");
      action.textContent = entry.action;
      const level = document.createElement("span");
      level.textContent = entry.level;
      row.append(when, action, level);
      area.appendChild(row);
    }
  } catch (error) { $("log-status").textContent = error.message; }
}
$("log-refresh").addEventListener("click", load);
$("log-clear").addEventListener("click", async () => {
  if (!confirm(t("logConfirmClear", "Clear the local kURL activity log?"))) return;
  const result = await browser.runtime.sendMessage({ type: "CLEAR_LOG" });
  if (!result?.ok) return void($("log-status").textContent = result?.reason || "Cannot clear log.");
  await load();
});
load();
