const H = window.Helpers;

/**
 * Shows a browser notification.
 * @param {string} title - The notification title.
 * @param {string} message - The notification message.
 */
function toast(title, message) {
  try {
    browser.notifications.create("yourls-" + Date.now(), {
      type: "basic",
      title,
      message,
      iconUrl: "../images/yourls-logo.svg"
    });
  } catch (e) {
    console.error("Failed to create notification:", e);
  }
}

/**
 * Extracts the origin from a URL string.
 * @param {string} base - The URL.
 * @returns {string} The origin.
 */
function originOf(base) {
  try {
    return new URL(base).origin;
  } catch {
    return "";
  }
}

/**
 * Checks if the add-on has permission for a given origin.
 * @param {string} origin - The origin to check.
 * @returns {Promise<boolean>}
 */
async function hasOriginPermission(origin) {
  try {
    return await browser.permissions.contains({ origins: [origin + "/*"] });
  } catch {
    return false;
  }
}

// --- API Fetch Functions ---

async function fetchPOST(url, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "Accept": "application/json" },
    body: params
  });
  const text = await res.text().catch(() => "");
  return { res, text };
}

async function fetchGET(url, params) {
  const u = url + "?" + params.toString();
  const res = await fetch(u, { method: "GET", headers: { "Accept": "application/json" } });
  const text = await res.text().catch(() => "");
  return { res, text };
}

/**
 * A generic fetch wrapper for the YOURLS API.
 * @param {string} baseUrl - The base URL of the YOURLS instance.
 * @param {object} payload - The API parameters.
 * @returns {Promise<{res: Response, text: string, json: object|null}>}
 */
async function yourlsFetch(baseUrl, payload) {
  const origin = originOf(baseUrl);
  if (!(await hasOriginPermission(origin))) {
    throw new Error("Host permission was not granted.");
  }
  const endpoint = baseUrl + "/yourls-api.php";
  const params = H.toFormData(payload);

  // POST first, then GET fallback for certain server errors (e.g., misconfigured WAF)
  let { res, text } = await fetchPOST(endpoint, params);
  if (!res.ok && [400, 403, 405, 415].includes(res.status)) {
    ({ res, text } = await fetchGET(endpoint, params));
  }
  const json = H.parseMaybeJson(text);
  return { res, text, json };
}

// --- API Action Implementations ---

/**
 * Checks the connection to the YOURLS API.
 * @returns {Promise<{ok: boolean, reason?: string, total?: string}>}
 */
async function apiCheck() {
  const { yourlsUrl, apiSignature } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  if (!base || !apiSignature) {
    return { ok: false, reason: browser.i18n.getMessage("errorNoSettings") };
  }
  try {
    // Try 'stats' action first, which is more common
    let { res, json } = await yourlsFetch(base, { action: "stats", format: "json", signature: apiSignature });
    if (res.ok && json) {
      const total = (json.total_links ?? json.stats?.total_links ?? "");
      return { ok: true, total };
    }
    // Fallback to 'db-stats'
    ({ res, json } = await yourlsFetch(base, { action: "db-stats", format: "json", signature: apiSignature }));
    if (res.ok && json) {
      const total = json["db-stats"]?.total_links ?? "";
      return { ok: true, total };
    }
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
  return { ok: false, reason: browser.i18n.getMessage("optionsStatusConnFailed") };
}

/**
 * Shortens a long URL.
 * @param {string} longUrl - The URL to shorten.
 * @param {string} keyword - An optional custom keyword.
 * @returns {Promise<{ok: boolean, shortUrl?: string, already?: boolean, reason?: string}>}
 */
async function apiShorten(longUrl, keyword) {
  const { yourlsUrl, apiSignature } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  if (!base || !apiSignature) throw new Error(browser.i18n.getMessage("errorNoSettings"));

  const payload = { action: "shorturl", format: "json", signature: apiSignature, url: longUrl };
  if (keyword) payload.keyword = keyword;

  const { res, text, json } = await yourlsFetch(base, payload);

  const short = H.extractShort(json, base);
  if (res.ok && json && short) {
    toast(browser.i18n.getMessage("extensionName"), browser.i18n.getMessage("toastUrlCreated"));
    return { ok: true, shortUrl: short, already: false };
  }

  // Handle "already exists" case
  if (json && /already exists/i.test(String(json.message || ""))) {
    toast(browser.i18n.getMessage("extensionName"), browser.i18n.getMessage("toastUrlExists"));
    return { ok: true, shortUrl: short, already: true };
  }

  if (json?.status === "fail" && json.message) throw new Error(json.message);
  throw new Error(`HTTP ${res.status}${text ? (": " + text.slice(0, 200)) : ""}`);
}

/**
 * Gets statistics for a short URL.
 * @param {string} shortOrKeyword - The short URL or keyword.
 * @returns {Promise<object>} The stats JSON data.
 */
async function apiStats(shortOrKeyword) {
  const { yourlsUrl, apiSignature } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  const kw = H.extractKeyword(base, shortOrKeyword);
  const { res, text, json } = await yourlsFetch(base, { action: "url-stats", format: "json", signature: apiSignature, shorturl: kw });
  if (!res.ok) throw new Error(`HTTP ${res.status}${text ? (": " + text.slice(0, 200)) : ""}`);
  return json;
}

/**
 * Checks multiple possible success responses for a delete action.
 * @param {object} j - The JSON response from the API.
 * @returns {boolean}
 */
function isDeleteSuccessful(j) {
  if (!j) return false;
  // Standard YOURLS plugins often return this format
  if (j.status === "success" || (j.message && /success.*deleted/i.test(j.message))) return true;
  // Some YOURLS versions or delete plugins might return this
  if (j.statusCode === 200) return true;
  return false;
}

/**
 * Deletes a short URL.
 * @param {string} shortOrKeyword - The short URL or keyword to delete.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function apiDelete(shortOrKeyword) {
  const { yourlsUrl, apiSignature } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  const keyword = H.extractKeyword(base, shortOrKeyword);
  if (!keyword) throw new Error(browser.i18n.getMessage("errorEnterKeywordToDelete"));

  const payload = { action: "delete", format: "json", signature: apiSignature, shorturl: keyword };
  const { res, json } = await yourlsFetch(base, payload);

  if (res.ok && isDeleteSuccessful(json)) {
    toast(browser.i18n.getMessage("extensionName"), browser.i18n.getMessage("toastUrlDeleted"));
    return { ok: true };
  }

  const errorDetails = json?.message || json?.error || "";
  throw new Error(`Delete failed: HTTP ${res.status} ${errorDetails ? `- ${errorDetails}` : ''}`);
}


// --- Add-on Integration (Menus, Messaging) ---

/**
 * Sets up the context menus for the add-on.
 */
function setupMenus() {
  browser.menus.removeAll(() => {
    browser.menus.create({
      id: "yourls-shorten-selection",
      title: "kurl: Shorten selection…",
      contexts: ["selection", "editable"]
    });
  });
}

// Setup menus on install and startup
browser.runtime.onInstalled.addListener(setupMenus);
browser.runtime.onStartup.addListener(setupMenus);


browser.menus.onShown.addListener(async (info, tab) => {
  // Only show the menu item in compose windows to avoid clutter.
  const visible = (tab?.type === "messageCompose");
  try {
    await browser.menus.update("yourls-shorten-selection", { visible });
    await browser.menus.refresh();
  } catch {}
});

// This function will be injected into the compose window to get the selection.
function getSelectionInPage() {
  const sel = window.getSelection();
  let text = sel ? String(sel).trim() : "";
  try {
    const node = sel && sel.anchorNode ? sel.anchorNode.parentElement || sel.anchorNode : null;
    const a = node && node.closest ? node.closest('a') : null;
    if (a && a.href) {
      text = a.href;
    }
  } catch {}
  return text;
}

// When the toolbar icon is clicked, save the tab ID.
browser.composeAction.onClicked.addListener(async (tab) => {
  if (tab && tab.id) {
    await browser.storage.local.set({ lastActiveComposeTabId: tab.id });
  }
});


browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "yourls-shorten-selection") {
    if (tab?.type !== "messageCompose") {
      return;
    }

    const composeTabId = tab.id;
    let results;

    try {
      // Use the scripting API to execute a function directly in the page context.
      results = await browser.scripting.executeScript({
        target: { tabId: composeTabId },
        func: getSelectionInPage,
      });
    } catch (e) {
      console.error("kurl Addon: Failed to execute script in compose window.", e);
      return;
    }

    const selectedUrl = (results[0]?.result || "").trim();
    if (!selectedUrl || !selectedUrl.startsWith('http')) {
      return;
    }

    try {
      const { yourlsUrl } = await H.getSettings();
      const base = H.sanitizeBaseUrl(yourlsUrl);

      await browser.storage.local.set({ lastActiveComposeTabId: composeTabId });
      await browser.storage.local.remove(["yourls_prefill_long", "yourls_prefill_short"]);

      // **THE FIX**: Check if the selected URL is longer than the base URL.
      // This correctly identifies it as a real short link with a keyword,
      // not just the base domain itself.
      if (base && selectedUrl.startsWith(base) && selectedUrl.length > base.length + 1) {
        await browser.storage.local.set({ yourls_prefill_short: selectedUrl });
      } else {
        await browser.storage.local.set({ yourls_prefill_long: selectedUrl });
      }

      await browser.composeAction.openPopup();

    } catch (windowError) {
      console.error("kurl Addon: Error processing the URL or creating the popup.", windowError);
    }
  }
});


browser.runtime.onMessage.addListener(async (msg) => {
  try {
    switch (msg.type) {
      case "CHECK_CONNECTION":
        return await apiCheck();
      case "SHORTEN_URL":
        return await apiShorten(msg.longUrl, msg.keyword || "");
      case "GET_STATS":
        return { ok: true, data: await apiStats(msg.shortUrl) };
      case "DELETE_SHORTURL":
        return await apiDelete(msg.shortUrl);
      default:
        return { ok: false, reason: "Unknown message type" };
    }
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
});
