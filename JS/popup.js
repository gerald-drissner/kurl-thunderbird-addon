const H = window.Helpers;
const $ = (id) => document.getElementById(id);

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

/**
 * Updates all text content in the document based on the browser's locale.
 */
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

/**
 * Sets the status message text and appearance.
 * @param {string} text - The message to display.
 * @param {string} [cls=""] - An optional class to add (e.g., "ok").
 */
function setMsg(text, cls = "") {
  msg.className = "info " + cls;
  msg.textContent = text;
}

/**
 * Toggles the visibility of the JSON response box.
 * @param {boolean} show - Whether to show the box.
 * @param {object|string} [data] - The data to display in the box.
 */
function toggleJson(show, data) {
  jsonBox.style.display = show ? "block" : "none";
  if (show && data) {
    jsonBox.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  }
}

/**
 * Checks for and prefills the popup based on a URL passed from the context menu.
 */
async function prefillFromContextMenu() {
  try {
    const data = await browser.storage.local.get(["yourls_prefill_long", "yourls_prefill_short"]);

    // Case 1: An existing short URL was selected
    if (data.yourls_prefill_short) {
      const short = data.yourls_prefill_short;
      shortUrl.value = short;
      statsInput.value = short;
      btnDelete.disabled = false;

      longUrl.disabled = true;
      keyword.disabled = true;
      btnShorten.disabled = true;

      setMsg(browser.i18n.getMessage("popupInfoAutoStats"), "ok");
      await browser.storage.local.remove("yourls_prefill_short");
      btnStats.click();
    }
    // Case 2: A long URL was selected
    else if (data.yourls_prefill_long) {
      longUrl.value = data.yourls_prefill_long;
      await browser.storage.local.remove("yourls_prefill_long");
    }
  } catch (e) {
    console.error("kurl Addon:", e);
  }
}

/**
 * Handles the response when a URL is found to already exist.
 * @param {string} short - The existing short URL.
 */
function onAlreadyExists(short) {
  shortUrl.value = short || "";
  statsInput.value = short || "";
  btnDelete.disabled = !short;
  setMsg(browser.i18n.getMessage("popupInfoAlreadyShortened"), "ok");
}

// --- Event Listeners ---

btnShorten.addEventListener("click", async () => {
  const url = longUrl.value.trim();
  const kw = keyword.value.trim() || "";
  if (!/^https?:\/\//i.test(url)) {
    return setMsg(browser.i18n.getMessage("popupErrorInvalidUrl"));
  }
  setMsg(browser.i18n.getMessage("popupStatusShortening"));
  toggleJson(false);
  btnDetails.style.visibility = 'hidden'; // Hide JSON button on new action

  const r = await browser.runtime.sendMessage({ type: "SHORTEN_URL", longUrl: url, keyword: kw });

  if (!r || r.ok === false) {
    return setMsg(r?.reason || browser.i18n.getMessage("errorShortenFailed"));
  }

  if (r.already) {
    onAlreadyExists(r.shortUrl);
    return;
  }

  // Success case for a newly created URL
  shortUrl.value = r.shortUrl || "";
  statsInput.value = r.shortUrl || "";
  btnDelete.disabled = !r.shortUrl;
  setMsg(browser.i18n.getMessage("popupStatusCreated"), "ok");

  const settings = await H.getSettings();
  if (settings.autoCopy && r.shortUrl) {
    try {
      await navigator.clipboard.writeText(r.shortUrl);
      setMsg(browser.i18n.getMessage("popupStatusCreated") + " " + browser.i18n.getMessage("popupStatusCopied"), "ok");
    } catch (e) {
      console.error("Auto-copy failed:", e);
    }
  }
});

btnCopy.addEventListener("click", async () => {
  const v = shortUrl.value.trim();
  if (!v) return setMsg(browser.i18n.getMessage("popupErrorNothingToCopy"));
  try {
    await navigator.clipboard.writeText(v);
    setMsg(browser.i18n.getMessage("popupStatusCopied"), "ok");
  } catch (e) {
    setMsg(browser.i18n.getMessage("popupErrorCopyFailed"));
  }
});

btnInsert.addEventListener("click", async () => {
  const v = shortUrl.value.trim();
  if (!v) return setMsg(browser.i18n.getMessage("popupErrorNothingToInsert"));

  try {
    const { lastActiveComposeTabId } = await browser.storage.local.get("lastActiveComposeTabId");

    if (!lastActiveComposeTabId) {
      return setMsg(browser.i18n.getMessage("popupErrorNoCompose"));
    }

    function insertOrReplaceInPage(url, replaceLink) {
      try {
        const sel = window.getSelection();
        const node = sel && sel.anchorNode ? sel.anchorNode.parentElement || sel.anchorNode : null;
        const a = node && node.closest ? node.closest('a') : null;

        if (replaceLink && a) {
          a.href = url;
          a.textContent = url;
        } else {
          document.execCommand('insertText', false, url);
        }
      } catch (e) {
        console.error("kurl: Failed to insert text.", e);
      }
    }

    await browser.scripting.executeScript({
      target: { tabId: lastActiveComposeTabId },
      func: insertOrReplaceInPage,
      args: [v, true]
    });

    setMsg(browser.i18n.getMessage("popupStatusInserted"), "ok");

  } catch (e) {
    setMsg(String(e));
  }
});


btnStats.addEventListener("click", async () => {
  const q = (statsInput.value || shortUrl.value || longUrl.value).trim();
  if (!q) return setMsg(browser.i18n.getMessage("popupErrorEnterUrlForStats"));
  setMsg(browser.i18n.getMessage("popupStatusFetchingStats"));
  toggleJson(false);
  btnDetails.style.visibility = 'hidden';

  const r = await browser.runtime.sendMessage({ type: "GET_STATS", shortUrl: q });
  if (!r || r.ok === false) return setMsg(r?.reason || browser.i18n.getMessage("errorStatsFailed"));

  const l = r.data?.link || r.data?.url || {};
  const message = browser.i18n.getMessage("popupStatusStatsResult", [l.shorturl || "?", l.url || "?", l.clicks ?? "?"]);
  setMsg(message, "ok");

  jsonBox.textContent = JSON.stringify(r.data, null, 2);
  btnDetails.style.visibility = 'visible'; // Show the button now that we have data
});

btnDetails.addEventListener("click", () => {
  const isVisible = jsonBox.style.display === "block";
  toggleJson(!isVisible);
});

btnDelete.addEventListener("click", async () => {
  const v = (statsInput.value || shortUrl.value).trim();
  if (!v) return setMsg(browser.i18n.getMessage("popupErrorProvideUrlToDelete"));

  if (!btnDelete.classList.contains('confirm-delete')) {
    btnDelete.textContent = browser.i18n.getMessage("popupBtnConfirmDelete");
    btnDelete.classList.add('confirm-delete');
    setTimeout(() => {
      if (btnDelete.classList.contains('confirm-delete')) {
        btnDelete.textContent = browser.i18n.getMessage("popupBtnDelete");
        btnDelete.classList.remove('confirm-delete');
      }
    }, 4000);
    return;
  }

  btnDelete.textContent = browser.i18n.getMessage("popupBtnDelete");
  btnDelete.classList.remove('confirm-delete');

  setMsg(browser.i18n.getMessage("popupStatusDeleting"));
  toggleJson(false);
  btnDetails.style.visibility = 'hidden';
  const r = await browser.runtime.sendMessage({ type: "DELETE_SHORTURL", shortUrl: v });
  if (!r || r.ok === false) return setMsg(r?.reason || browser.i18n.getMessage("errorDeleteFailed"));

  setMsg(browser.i18n.getMessage("popupStatusDeleted"), "ok");
  shortUrl.value = "";
});

/**
 * Initializes the popup.
 */
function init() {
  internationalize();
  setMsg(browser.i18n.getMessage("popupStatusReady"));
  btnDetails.style.visibility = 'hidden'; // Hide on startup
  prefillFromContextMenu();
}

init();
