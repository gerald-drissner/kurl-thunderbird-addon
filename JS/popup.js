/**
 * kurl - popup.js
 *
 * This script controls the user interface and logic within the main popup window.
 * It handles fetching the selected URL, shortening, stats, copying, and inserting.
 */

const H = window.Helpers;
const $ = (id) => document.getElementById(id);

// --- NEW SOLUTION: Logic to prefill the popup on load ---
// This is the main entry point for getting the selected URL when the popup opens,
// especially via the keyboard shortcut. It runs as soon as the popup is ready.
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // First, check if the popup was opened by the context menu or toolbar button,
    // which store the URL in local storage.
    const storageData = await browser.storage.local.get(["yourls_prefill_long", "yourls_prefill_short"]);
    let url = storageData.yourls_prefill_long || storageData.yourls_prefill_short;
    const isShort = !!storageData.yourls_prefill_short;

    // If no URL was in storage, it was likely opened by the shortcut, so we fetch it directly.
    if (!url) {
      url = await getSelectedUrlFromActiveTab();
    }

    // If we have a URL, process and display it.
    if (url) {
      const { yourlsUrl } = await H.getSettings();
      const base = H.sanitizeBaseUrl(yourlsUrl);

      // Determine if the URL is an existing short URL or a long one to be shortened.
      const isAlreadyShort = isShort || (base && url.startsWith(base) && url.length > base.length + 1);

      if (isAlreadyShort) {
        shortUrl.value = url;
        statsInput.value = url;
        btnDelete.disabled = false;
        longUrl.disabled = true;
        keyword.disabled = true;
        btnShorten.disabled = true;
        setMsg(browser.i18n.getMessage("popupInfoAutoStats"), "ok");
        btnStats.click(); // Automatically fetch stats
      } else {
        longUrl.value = url;
      }
    }

    // Clean up storage data after using it.
    await browser.storage.local.remove(["yourls_prefill_long", "yourls_prefill_short"]);

    // Ensure the tab ID is stored for the "Insert" button.
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true, type: "messageCompose" });
    if (tab) {
      await browser.storage.local.set({ lastActiveComposeTabId: tab.id });
    }

  } catch (e) {
    console.warn('kurl: Prefill from selection failed', e);
  }
});

/**
 * Injects a script into the active tab to find the user's selection.
 * This is robust, searching all frames to find text inside the compose editor's iframe.
 * @returns {Promise<string>} The selected URL, or an empty string.
 */
async function getSelectedUrlFromActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) return '';

  const results = await browser.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: () => {
      try {
        const sel = window.getSelection?.();
        let text = sel ? String(sel).trim() : '';
        const node = sel?.anchorNode?.parentElement;
        const a = node?.closest?.('a');
        if (a?.href) return a.href; // Prioritize the link's href
        if (text) {
          const m = text.match(/https?:\/\/\S+/i); // Fallback to finding a URL in the text
          if (m) return m[0];
        }
        return '';
      } catch {
        return '';
      }
    }
  });

  const hit = (results || []).find(r => r && r.result && r.result.trim());
  return hit ? hit.result.trim() : '';
}
// --- END OF NEW SOLUTION ---

// Element references
const longUrl = $("longUrl");
const keyword = $("keyword");
const shortUrl = $("shortUrl");
const statsInput = $("statsInput");
const btnShorten = $("btnShorten");
const btnCopy = $("btnCopy");
const btnInsert = $("btnInsert");
const btnDelete = $("btnDelete");
const btnStats = $("btnStats");
const btnDetails = $("btnDetails");
const msg = $("msg");
const jsonBox = $("json");

// --- UI Helper Functions ---
function internationalize() {
  document.querySelectorAll('[data-i18n-key]').forEach(el => {
    const key = el.getAttribute('data-i18n-key');
    const message = browser.i18n.getMessage(key);
    if (message) {
      if (el.placeholder) el.placeholder = message;
      else el.textContent = message;
    }
  });
}

function setMsg(text, cls = "") {
  msg.className = "info " + cls;
  msg.textContent = text;
}

function toggleJson(show, data) {
  jsonBox.style.display = show ? "block" : "none";
  if (show && data) {
    jsonBox.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  }
}

// --- Button Event Listeners ---
btnShorten.addEventListener("click", async () => {
  const url = longUrl.value.trim();
  if (!/^https?:\/\//i.test(url)) return setMsg(browser.i18n.getMessage("popupErrorInvalidUrl"));

    setMsg(browser.i18n.getMessage("popupStatusShortening"));
  toggleJson(false);
  btnDetails.style.visibility = 'hidden';

  const r = await browser.runtime.sendMessage({ type: "SHORTEN_URL", longUrl: url, keyword: keyword.value.trim() });

  if (!r || !r.ok) return setMsg(r?.reason || browser.i18n.getMessage("errorShortenFailed"));

  if (r.already) {
    setMsg(browser.i18n.getMessage("popupInfoAlreadyShortened"), "ok");
  } else {
    setMsg(browser.i18n.getMessage("popupStatusCreated"), "ok");
  }

  shortUrl.value = r.shortUrl || "";
  statsInput.value = r.shortUrl || "";
  btnDelete.disabled = !r.shortUrl;

  const settings = await H.getSettings();
  if (settings.autoCopy && r.shortUrl) {
    navigator.clipboard.writeText(r.shortUrl).then(() => {
      setMsg(msg.textContent + " " + browser.i18n.getMessage("popupStatusCopied"), "ok");
    });
  }
});

btnCopy.addEventListener("click", () => {
  const v = shortUrl.value.trim();
  if (!v) return setMsg(browser.i18n.getMessage("popupErrorNothingToCopy"));
  navigator.clipboard.writeText(v).then(() => {
    setMsg(browser.i18n.getMessage("popupStatusCopied"), "ok");
  }).catch(() => {
    setMsg(browser.i18n.getMessage("popupErrorCopyFailed"));
  });
});

btnInsert.addEventListener("click", async () => {
  const v = shortUrl.value.trim();
  if (!v) return setMsg(browser.i18n.getMessage("popupErrorNothingToInsert"));

  try {
    const { lastActiveComposeTabId } = await browser.storage.local.get("lastActiveComposeTabId");
    if (!lastActiveComposeTabId) return setMsg(browser.i18n.getMessage("popupErrorNoCompose"));

    await browser.scripting.executeScript({
      target: { tabId: lastActiveComposeTabId },
      func: (url) => {
        document.execCommand('insertText', false, url);
      },
      args: [v]
    });
    setMsg(browser.i18n.getMessage("popupStatusInserted"), "ok");
  } catch (e) {
    setMsg(String(e));
  }
});

btnStats.addEventListener("click", async () => {
  const q = (statsInput.value || shortUrl.value).trim();
  if (!q) return setMsg(browser.i18n.getMessage("popupErrorEnterUrlForStats"));

  setMsg(browser.i18n.getMessage("popupStatusFetchingStats"));
  toggleJson(false);
  btnDetails.style.visibility = 'hidden';

  const r = await browser.runtime.sendMessage({ type: "GET_STATS", shortUrl: q });
  if (!r || !r.ok) return setMsg(r?.reason || browser.i18n.getMessage("errorStatsFailed"));

  const l = r.data?.link || r.data?.url || {};
  const message = browser.i18n.getMessage("popupStatusStatsResult", [l.shorturl || "?", l.url || "?", l.clicks ?? "?"]);
  setMsg(message, "ok");

  jsonBox.textContent = JSON.stringify(r.data, null, 2);
  btnDetails.style.visibility = 'visible';
});

btnDetails.addEventListener("click", () => {
  toggleJson(jsonBox.style.display !== "block");
});

btnDelete.addEventListener("click", async () => {
  const v = (statsInput.value || shortUrl.value).trim();
  if (!v) return setMsg(browser.i18n.getMessage("popupErrorProvideUrlToDelete"));

  // Add a confirmation step to prevent accidental deletion.
  if (!btnDelete.classList.contains('confirm-delete')) {
    btnDelete.textContent = browser.i18n.getMessage("popupBtnConfirmDelete");
    btnDelete.classList.add('confirm-delete');
    setTimeout(() => {
      btnDelete.textContent = browser.i18n.getMessage("popupBtnDelete");
      btnDelete.classList.remove('confirm-delete');
    }, 4000);
    return;
  }

  btnDelete.classList.remove('confirm-delete');
  btnDelete.textContent = browser.i18n.getMessage("popupBtnDelete");
  setMsg(browser.i18n.getMessage("popupStatusDeleting"));
  toggleJson(false);
  btnDetails.style.visibility = 'hidden';

  const r = await browser.runtime.sendMessage({ type: "DELETE_SHORTURL", shortUrl: v });
  if (!r || !r.ok) return setMsg(r?.reason || browser.i18n.getMessage("errorDeleteFailed"));

  setMsg(browser.i18n.getMessage("popupStatusDeleted"), "ok");
  shortUrl.value = "";
  statsInput.value = "";
  btnDelete.disabled = true;
});

/**
 * Initializes the popup UI.
 */
function init() {
  internationalize();
  setMsg(browser.i18n.getMessage("popupStatusReady"));
  btnDetails.style.visibility = 'hidden';
  // The new DOMContentLoaded listener now handles all prefilling logic.
}

init();
