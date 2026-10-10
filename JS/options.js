/* kURL settings: test exactly what is entered; do not reuse tokens across hosts. */
"use strict";
const H = window.Helpers;
const $ = id => document.getElementById(id);
const t = (key, fallback) => browser.i18n.getMessage(key) || fallback;
let saved = { yourlsUrl: "", apiSignature: "", autoCopy: true };

function status(message, good = false) {
  $("status").textContent = message;
  $("status").className = good ? "info ok" : "info";
}
function connection() {
  const base = H.sanitizeBaseUrl($("yourlsUrl").value);
  const token = $("apiSignature").value.trim();
  if (!base || !token) throw new Error(t("optionsStatusEnterUrlAndToken", "Enter a valid URL and API token."));
  if (base !== saved.yourlsUrl && token === saved.apiSignature) {
    throw new Error("Server changed. Enter its own API signature; the previous token cannot be reused.");
  }
  return { yourlsUrl: base, apiSignature: token };
}
async function hostPermission(base) {
  const pattern = new URL(base).origin + "/*";
  const granted = await browser.permissions.request({ origins: [pattern] });
  if (!granted) throw new Error(t("optionsStatusPermNotGranted", "Host permission not granted."));
}
async function test() {
  let config;
  try { config = connection(); } catch (error) { return status(error.message); }
  try {
    // Request immediately in a click handler while user activation is available.
    await hostPermission(config.yourlsUrl);
    status(t("dashboardStatusLoading", "Checking connection..."));
    const result = await browser.runtime.sendMessage({
      type: "CHECK_CONNECTION", settings: config
    });
    if (!result?.ok) throw new Error(result?.reason || t("optionsStatusConnFailed", "Connection failed."));
    status(browser.i18n.getMessage("optionsStatusConnOk", String(result.total)) ||
      ("Connected. Total links: " + result.total), true);
  } catch (error) {
    status(String(error.message || error));
  }
}
async function save() {
  let config;
  try { config = connection(); } catch (error) { return status(error.message); }
  try {
    await hostPermission(config.yourlsUrl);
    await H.setSettings({ ...config, autoCopy: $("autoCopy").checked });
    saved = { ...config, autoCopy: $("autoCopy").checked };
    status(t("optionsStatusSaved", "Settings saved."), true);
  } catch (error) {
    status(String(error.message || error));
  }
}
async function revoke() {
  const base = H.sanitizeBaseUrl($("yourlsUrl").value);
  if (!base) return status(t("optionsStatusEnterUrlToRemove", "Enter your YOURLS URL."));
  try {
    await browser.permissions.remove({ origins: [new URL(base).origin + "/*"] });
    status(t("optionsStatusPermRemoved", "Permission removed."));
  } catch (error) {
    status(t("optionsStatusPermRemoveError", "Could not remove permission: ") + error.message);
  }
}
function internationalize() {
  document.querySelectorAll("[data-i18n-key]").forEach(el => {
    const translated = browser.i18n.getMessage(el.dataset.i18nKey);
    if (translated) {
      if (el.hasAttribute("placeholder")) el.placeholder = translated;
      else el.textContent = translated;
    }
  });
}
async function init() {
  internationalize();
  saved = await H.getSettings();
  $("yourlsUrl").value = saved.yourlsUrl;
  $("apiSignature").value = saved.apiSignature;
  $("autoCopy").checked = saved.autoCopy;
  status(t("optionsStatusLoaded", "Settings loaded."));
}
$("test").addEventListener("click", test);
$("save").addEventListener("click", save);
$("removePerm").addEventListener("click", revoke);
$("yourlsUrl").addEventListener("input", () => {
  const base = H.sanitizeBaseUrl($("yourlsUrl").value);
  if (base !== saved.yourlsUrl && $("apiSignature").value === saved.apiSignature) {
    $("apiSignature").value = "";
    status("Server changed. Enter the API signature for the new server.");
  }
});
init().catch(error => status(String(error.message || error)));