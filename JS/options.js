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
  if (base && saved.yourlsUrl && new URL(base).host !== new URL(saved.yourlsUrl).host && token === saved.apiSignature) {
    throw new Error("Server changed. Enter its own API signature; the previous token cannot be reused.");
  }
  return { yourlsUrl: base, apiSignature: token };
}
async function hostPermission(base) {
  const pattern = new URL(base).origin + "/*";
  const granted = await browser.permissions.request({ origins: [pattern] });
  if (!granted) throw new Error(t("optionsStatusPermNotGranted", "Host permission not granted."));
}
let testing = false;
async function test() {
  let config;
  try { config = connection(); } catch (error) { return status(error.message); }
  if (testing) return;
  testing = true;
  $("test").disabled = true;
  try {
    // Request immediately in a click handler while user activation is available.
    await hostPermission(config.yourlsUrl);
    status(t("dashboardStatusLoading", "Checking connection..."));
    const result = await browser.runtime.sendMessage({
      type: "CHECK_CONNECTION", settings: config
    });
    if (!result?.ok) throw new Error(result?.reason || t("optionsStatusConnFailed", "Connection failed."));
    // Commit only AFTER the API actually accepted the credentials.
    const finalSettings = { ...config, autoCopy: $("autoCopy").checked };
    await H.setSettings(finalSettings);
    saved = finalSettings;
    status(t("optionsStatusVerifiedSaved", "Connection verified and settings saved. " ) +
      (browser.i18n.getMessage("optionsStatusConnOk", String(result.total)) ||
        ("Total links: " + result.total)), true);
  } catch (error) {
    status(t("optionsStatusNotSaved", "Connection failed. Settings were not saved. ") +
      String(error.message || error));
  } finally {
    testing = false;
    $("test").disabled = false;
  }
}
async function save() {
  let config;
  try { config = connection(); } catch (error) { return status(error.message); }
  try {
    await hostPermission(config.yourlsUrl);
    await H.setSettings({ ...config, autoCopy: $("autoCopy").checked });
    saved = { ...config, autoCopy: $("autoCopy").checked };
    status(t("optionsStatusSavedUnchecked", "Settings saved without connection verification. You can test the connection later."));
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
  document.documentElement.lang = browser.i18n.getUILanguage().split("-")[0];
  document.documentElement.dir = browser.i18n.getMessage("@@bidi_dir") || "ltr";
  try {
    const commands = await browser.commands.getAll();
    const command = commands.find(x => x.name === "_execute_compose_action");
    const shortcut = command?.shortcut || "Not set";
    $("shortcut-text").textContent = command?.shortcut
      ? browser.i18n.getMessage("optionsShortcutSentence",[shortcut])
      : t("optionsShortcutUnassigned", "No shortcut assigned. Choose one with Configure shortcuts or use the toolbar button.");
  } catch { $("shortcut-text").textContent = "Open the kURL toolbar button to shorten a URL."; }

  saved = await H.getSettings();
  const raw = await browser.storage.local.get("yourlsUrl");
  const old = String(raw.yourlsUrl || "").trim();
  $("yourlsUrl").value = old.startsWith("http://")
    ? "https://" + old.slice("http://".length) : saved.yourlsUrl;
  $("apiSignature").value = saved.apiSignature;
  $("autoCopy").checked = saved.autoCopy;
  status(old.startsWith("http://") ?
    "Old HTTP connection detected. HTTPS has been filled in; test the connection and save the updated settings." :
    t("optionsStatusLoaded", "Settings loaded."));
}
$("test").addEventListener("click", test);
$("save").addEventListener("click", save);
$("removePerm").addEventListener("click", revoke);
$("yourlsUrl").addEventListener("input", () => {
  const base = H.sanitizeBaseUrl($("yourlsUrl").value);
  if (base && saved.yourlsUrl && new URL(base).host !== new URL(saved.yourlsUrl).host && $("apiSignature").value === saved.apiSignature) {
    $("apiSignature").value = "";
    status("Server changed. Enter the API signature for the new server.");
  }
});
init().catch(error => status(String(error.message || error)));
$("edit-shortcuts")?.addEventListener("click", async () => {
  try { await browser.commands.openShortcutSettings(); }
  catch { status("Open the Thunderbird Add-ons Manager and select Manage Extension Shortcuts."); }
});
