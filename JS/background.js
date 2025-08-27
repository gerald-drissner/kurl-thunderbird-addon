/**
 * kurl - background.js
 *
 * Handles API requests, add-on lifecycle events (install, startup),
 * dynamic context menus, and communication with other parts of the extension.
 */

const H = window.Helpers;

// --- API Action Implementations (from your working file) ---
async function apiStats(shortOrKeyword) {
  const { yourlsUrl, apiSignature } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  const kw = H.extractKeyword(base, shortOrKeyword);
  const { res, text, json } = await yourlsFetch(base, { action: "url-stats", format: "json", signature: apiSignature, shorturl: kw });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(browser.i18n.getMessage("popupErrorStatsNotFound"));
    }
    throw new Error(`HTTP ${res.status}${text ? ": " + text.slice(0, 100) : ""}`);
  }
  return json;
}
async function apiShorten(longUrl, keyword, title) {
  const { yourlsUrl, apiSignature } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  if (!base || !apiSignature) throw new Error(browser.i18n.getMessage("errorNoSettings"));
  const payload = { action: "shorturl", format: "json", signature: apiSignature, url: longUrl };
  if (keyword) payload.keyword = keyword;
  if (title) payload.title = title;
  const { res, text, json } = await yourlsFetch(base, payload);
  if (json && /already exists/i.test(String(json.message || ""))) {
    let existingShortUrl = null;
    const match = String(json.message).match(/\(short URL: (https?:\/\/\S+)\)/i);
    if (match && match[1]) {
      existingShortUrl = match[1];
    } else {
      existingShortUrl = H.extractShort(json, base);
    }
    toast(browser.i18n.getMessage("extensionName"), browser.i18n.getMessage("toastUrlExists"));
    return { ok: true, shortUrl: existingShortUrl, already: true };
  }
  const short = H.extractShort(json, base);
  if (res.ok && json && short) {
    toast(browser.i18n.getMessage("extensionName"), browser.i18n.getMessage("toastUrlCreated"));
    return { ok: true, shortUrl: short, already: false };
  }
  if (json?.status === "fail" && json.message) throw new Error(json.message);
  throw new Error(`HTTP ${res.status}${text ? (": " + text.slice(0, 200)) : ""}`);
}
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
async function handleAttachQrCode(payload) {
  const { blob, name } = payload;
  const { lastActiveComposeTabId } = await browser.storage.local.get("lastActiveComposeTabId");
  if (!lastActiveComposeTabId) {
    throw new Error("Invalid tab ID"); // More specific error
  }
  const file = new File([blob], name, { type: blob.type });
  await browser.compose.addAttachment(lastActiveComposeTabId, { file });
  toast(browser.i18n.getMessage("extensionName"), "QR code attached.");
}

// --- Add-on Integration & Event Listeners ---
browser.runtime.onMessage.addListener(async (msg) => {
  try {
    switch (msg.type) {
      case "CHECK_CONNECTION": return await apiCheck();
      case "SHORTEN_URL": return await apiShorten(msg.longUrl, msg.keyword || "", msg.title || "");
      case "GET_STATS": return { ok: true, data: await apiStats(msg.shortUrl) };
      case "DELETE_SHORTURL": return await apiDelete(msg.shortUrl);
      case "ATTACH_QR_CODE":
        await handleAttachQrCode(msg);
        return { ok: true };
      default: return { ok: false, reason: "Unknown message type" };
    }
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
});

// --- NEW/RESTORED SECTION ---

async function getUrlFromTab(tab) {
  if (!tab) return "";
  try {
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
    return (results.find(r => r.result)?.result || "").trim();
  } catch (e) { return ""; }
}

// Toolbar button/shortcut handler for the COMPOSE window.
browser.composeAction.onClicked.addListener(async (tab) => {
  const url = await getUrlFromTab(tab);
  await browser.storage.local.set({
    yourls_prefill_long: url,
    popup_context: "compose",
    lastActiveComposeTabId: tab.id // FIX: Ensure tab ID is set here
  });
  await browser.composeAction.openPopup();
});

// Toolbar button handler for the MESSAGE DISPLAY window.
browser.messageDisplayAction.onClicked.addListener(async (tab) => {
  const url = await getUrlFromTab(tab);
  await browser.storage.local.set({
    yourls_prefill_long: url,
    popup_context: "display"
  });
  await browser.messageDisplayAction.openPopup();
});

// Dynamic menu that creates the correct right-click option for each context.
browser.menus.onShown.addListener(async (info, tab) => {
  await browser.menus.removeAll();
  if (!info.linkUrl && !info.selectionText) return;

  const isThreePane = tab && tab.url && tab.url.includes("messenger.xhtml");
  const context = tab?.type === "messageCompose" ? "compose" :
  tab?.type === "messageDisplay" && !isThreePane ? "display" : "three-pane";

  if (context === "compose" || context === "display") {
    browser.menus.create({
      id: "kurl-shorten-and-open",
      title: "kurl: Shorten selection…",
      contexts: ["link", "selection", "editable"]
    });
  } else if (context === "three-pane") {
    browser.menus.create({
      id: "kurl-prime-url",
      title: "kurl: Copy URL to prime (no popup)",
                         contexts: ["link", "selection"]
    });
  }
  await browser.menus.refresh();
});

// Handler for when a context menu item is clicked.
browser.menus.onClicked.addListener(async (info, tab) => {
  const sel = String(info.selectionText || "").trim();
  const url = info.linkUrl || (sel.match(/https?:\/\/[^\s<>"']+/i)?.[0]);
  if (!url) return;

  await browser.storage.local.set({ yourls_prefill_long: url });

  if (info.menuItemId === "kurl-shorten-and-open") {
    if (tab.type === "messageCompose") {
      await browser.storage.local.set({ popup_context: "compose", lastActiveComposeTabId: tab.id }); // FIX: Ensure tab ID is set here
      await browser.composeAction.openPopup();
    } else if (tab.type === "messageDisplay") {
      await browser.storage.local.set({ popup_context: "display" });
      await browser.messageDisplayAction.openPopup();
    }
  } else if (info.menuItemId === "kurl-prime-url") {
    await browser.storage.local.set({ popup_context: "display" });
    toast("kurl", "URL primed. Click the kurl icon in the message header.");
  }
});

// --- END NEW/RESTORED SECTION ---

// --- Helper Functions ---
function toast(title, message) {
  browser.notifications.create({
    type: "basic",
    title,
    message,
    iconUrl: "images/kurl-icon-48.png"
  });
}
async function yourlsFetch(baseUrl, payload) {
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
