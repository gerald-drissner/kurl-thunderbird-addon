/**
 * kurl - background.js
 *
 * Handles API requests, add-on lifecycle events (install, startup),
 * context menus, and communication with other parts of the extension.
 */

const H = window.Helpers;

// --- API Action Implementations ---

/**
 * Fetches stats for a short URL. Handles 'not found' errors gracefully.
 * @param {string} shortOrKeyword - The short URL or keyword.
 * @returns {Promise<object>} The stats JSON data.
 */
async function apiStats(shortOrKeyword) {
  const { yourlsUrl, apiSignature } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  const kw = H.extractKeyword(base, shortOrKeyword);
  const { res, text, json } = await yourlsFetch(base, { action: "url-stats", format: "json", signature: apiSignature, shorturl: kw });

  // Handle the specific "not found" case from the YOURLS API.
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(browser.i18n.getMessage("popupErrorStatsNotFound"));
    }
    throw new Error(`HTTP ${res.status}${text ? ": " + text.slice(0, 100) : ""}`);
  }
  return json;
}

/**
 * Shortens a long URL.
 * @param {string} longUrl - The URL to shorten.
 * @param {string} keyword - An optional custom keyword.
 * @returns {Promise<object>}
 */
async function apiShorten(longUrl, keyword) {
  const { yourlsUrl, apiSignature } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  if (!base || !apiSignature) throw new Error(browser.i18n.getMessage("errorNoSettings"));

  const payload = { action: "shorturl", format: "json", signature: apiSignature, url: longUrl };
  if (keyword) payload.keyword = keyword;

  const { res, text, json } = await yourlsFetch(base, payload);
  const short = H.extractShort(json, base);

  // Handle success, including the case where the URL already existed.
  if (json?.status === "success" || (json?.code === "200" && short)) {
    if (/already exists/i.test(String(json.message || ""))) {
      toast(browser.i18n.getMessage("extensionName"), browser.i18n.getMessage("toastUrlExists"));
      return { ok: true, shortUrl: short, already: true };
    }
    toast(browser.i18n.getMessage("extensionName"), browser.i18n.getMessage("toastUrlCreated"));
    return { ok: true, shortUrl: short, already: false };
  }

  // Handle specific failure cases reported by the API.
  if (json?.status === "fail" && json.message) throw new Error(json.message);
  throw new Error(`HTTP ${res.status}${text ? (": " + text.slice(0, 200)) : ""}`);
}

/**
 * Deletes a short URL.
 * @param {string} shortOrKeyword - The short URL or keyword to delete.
 * @returns {Promise<object>}
 */
async function apiDelete(shortOrKeyword) {
  const { yourlsUrl, apiSignature } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  const keyword = H.extractKeyword(base, shortOrKeyword);
  if (!keyword) throw new Error(browser.i18n.getMessage("errorEnterKeywordToDelete"));

  const payload = { action: "delete", format: "json", signature: apiSignature, shorturl: keyword };
  const { res, json } = await yourlsFetch(base, payload);

  const isSuccess = (j) => j && (j.status === "success" || /success.*deleted/i.test(j.message || "") || j.statusCode === 200);

  if (res.ok && isSuccess(json)) {
    toast(browser.i18n.getMessage("extensionName"), browser.i18n.getMessage("toastUrlDeleted"));
    return { ok: true };
  }

  const errorDetails = json?.message || json?.error || "";
  throw new Error(`Delete failed: HTTP ${res.status} ${errorDetails ? `- ${errorDetails}` : ''}`);
}

/**
 * Checks the connection to the YOURLS API.
 * @returns {Promise<object>}
 */
async function apiCheck() {
  const { yourlsUrl, apiSignature } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  if (!base || !apiSignature) {
    return { ok: false, reason: browser.i18n.getMessage("errorNoSettings") };
  }
  try {
    const { res, json } = await yourlsFetch(base, { action: "stats", format: "json", signature: apiSignature });
    if (res.ok && json) {
      const total = (json.total_links ?? json.stats?.total_links ?? "?");
      return { ok: true, total };
    }
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
  return { ok: false, reason: browser.i18n.getMessage("optionsStatusConnFailed") };
}


// --- Add-on Integration & Event Listeners ---

/**
 * Handles clicks from the toolbar button and context menu.
 * It gets the selected URL and stores it for the popup to use.
 * @param {object} tab - The tab where the action was triggered.
 */
async function handleAction(tab) {
  if (tab?.type !== "messageCompose") return;

  const results = await browser.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: () => {
      const sel = window.getSelection();
      let text = sel ? String(sel).trim() : "";
      try {
        const node = sel?.anchorNode?.parentElement;
        const a = node?.closest('a');
        if (a?.href) text = a.href;
      } catch {}
      return text;
    }
  });

  const selectedUrl = (results.find(r => r.result)?.result || "").trim();
  if (!selectedUrl.startsWith('http')) {
    await browser.composeAction.openPopup(); // Open empty if no valid URL is found
    return;
  }

  // Store the found URL and tab ID for the popup to retrieve.
  const { yourlsUrl } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  await browser.storage.local.set({ lastActiveComposeTabId: tab.id });
  await browser.storage.local.remove(["yourls_prefill_long", "yourls_prefill_short"]); // Clear old data

  if (base && selectedUrl.startsWith(base)) {
    await browser.storage.local.set({ yourls_prefill_short: selectedUrl });
  } else {
    await browser.storage.local.set({ yourls_prefill_long: selectedUrl });
  }
  await browser.composeAction.openPopup();
}

/**
 * Central message hub for the extension.
 */
browser.runtime.onMessage.addListener(async (msg) => {
  try {
    switch (msg.type) {
      case "CHECK_CONNECTION": return await apiCheck();
      case "SHORTEN_URL": return await apiShorten(msg.longUrl, msg.keyword || "");
      case "GET_STATS": return { ok: true, data: await apiStats(msg.shortUrl) };
      case "DELETE_SHORTURL": return await apiDelete(msg.shortUrl);
      default: return { ok: false, reason: "Unknown message type" };
    }
  } catch (e) {
    // Catches errors from API functions and returns them in a structured way.
    return { ok: false, reason: String(e?.message || e) };
  }
});

// Event listener for the toolbar button.
browser.composeAction.onClicked.addListener(handleAction);

// Event listener for the context menu item.
browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "yourls-shorten-selection") {
    handleAction(tab);
  }
});


// --- Setup Functions (Menus, Notifications, etc.) ---

/**
 * Sets up the context menu item.
 */
function setupMenus() {
  browser.menus.removeAll(() => {
    browser.menus.create({
      id: "yourls-shorten-selection",
      title: browser.i18n.getMessage("menuItemShortenSelection"),
                         contexts: ["selection", "editable"]
    });
  });
}

/**
 * Shows the context menu item only in compose windows.
 */
browser.menus.onShown.addListener(async (info, tab) => {
  const visible = (tab?.type === "messageCompose");
  await browser.menus.update("yourls-shorten-selection", { visible });
  await browser.menus.refresh();
});

/**
 * Shows a browser notification.
 * @param {string} title
 * @param {string} message
 */
function toast(title, message) {
  browser.notifications.create({
    type: "basic",
    title,
    message,
    iconUrl: "images/kurl-icon-48.png"
  });
}

/**
 * A generic fetch wrapper for the YOURLS API.
 * @param {string} baseUrl
 * @param {object} payload
 * @returns {Promise<object>}
 */
async function yourlsFetch(baseUrl, payload) {
  const origin = new URL(baseUrl).origin;
  if (!(await browser.permissions.contains({ origins: [`${origin}/*`] }))) {
    throw new Error("Host permission was not granted.");
  }
  const endpoint = `${baseUrl}/yourls-api.php`;
  const params = H.toFormData(payload);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "Accept": "application/json" },
    body: params
  });
  const text = await res.text().catch(() => "");
  return { res, text, json: H.parseMaybeJson(text) };
}

// Initialize the extension on install or startup.
browser.runtime.onInstalled.addListener(setupMenus);
browser.runtime.onStartup.addListener(setupMenus);
