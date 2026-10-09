/* kURL Thunderbird MV3 event page: all YOURLS network traffic lives here. */
"use strict";
const H = window.Helpers;
const i18n = (key, fallback) => browser.i18n.getMessage(key) || fallback;
const MAX_BODY = 1048576;
const TIMEOUT = 15000;
const HELPER_VERSION = "1.1.5";

function notify(message) {
  return browser.notifications.create({
    type: "basic", title: "kURL", message: String(message),
    iconUrl: "images/kurl-icon-48.png"
  }).catch(() => {});
}

function requireTarget(value) {
  const url = H.validHttpUrl(value);
  if (!url) throw new Error(i18n("popupErrorInvalidUrl", "Enter a valid HTTP(S) URL."));
  return url;
}

async function request(action, options = {}, override = null) {
  const settings = override || await H.getSettings();
  const base = H.sanitizeBaseUrl(settings.yourlsUrl);
  const token = String(settings.apiSignature || "").trim();
  if (!base || !token) throw new Error(i18n("errorNoSettings", "Configure your YOURLS connection first."));
  const allowed = await browser.permissions.contains({
    origins: [new URL(base).origin + "/*"]
  });
  if (!allowed) throw new Error("YOURLS host permission is not granted. Open Settings.");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const body = H.toFormData({ ...options, action, format: "json", signature: token });
    const response = await fetch(base + "/yourls-api.php", {
      method: "POST",
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Accept": "application/json"
      },
      body, signal: controller.signal
    });
    if (Number(response.headers.get("content-length")) > MAX_BODY) {
      throw new Error("YOURLS response is too large.");
    }
    const reader = response.body?.getReader();
    let text = "";
    if (reader) {
      const chunks = [];
      let length = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > MAX_BODY) {
          await reader.cancel();
          throw new Error("YOURLS response is too large.");
        }
        chunks.push(part.value);
      }
      const joined = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
      text = new TextDecoder().decode(joined);
    } else {
      text = await response.text();
      if (text.length > MAX_BODY) throw new Error("YOURLS response is too large.");
    }
    const json = H.parseMaybeJson(text);
    if (!json) throw new Error("YOURLS did not return valid JSON (HTTP " + response.status + ").");
    return { httpOK: response.ok, status: response.status, json };
  } catch (error) {
    if (error.name === "AbortError") throw new Error("YOURLS request timed out (15 s).");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function success(result) {
  const j = result.json;
  if (!result.httpOK || j?.status === "fail" || j?.status === "error" ||
      j?.statusCode === "error" || Number(j?.statusCode) >= 400) {
    throw new Error("YOURLS rejected the request (HTTP " + result.status + ").");
  }
  return j;
}

async function checkConnection(override) {
  const r = await request("db-stats", {}, override);
  const j = success(r);
  return { ok: true, total: Number(j.total_links ?? j["db-stats"]?.total_links ?? 0) || 0 };
}

async function shorten(long, keyword = "", title = "") {
  const url = requireTarget(long);
  const rawKeyword = String(keyword || "").trim();
  const cleanKeyword = rawKeyword ? H.validKeyword(rawKeyword) : "";
  if (rawKeyword && !cleanKeyword) throw new Error("Invalid custom keyword. Use letters, digits, _ or -.");
  const { yourlsUrl } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  const r = await request("shorturl", {
    url, ...(cleanKeyword ? { keyword: cleanKeyword } : {}),
    ...(title ? { title: String(title).slice(0, 300) } : {})
  });
  const short = H.extractShort(r.json, base);
  const existing = r.json?.code === "error:url" ||
    /already exists/i.test(String(r.json?.message || ""));
  if (short && (existing || (r.httpOK && r.json?.status !== "fail" &&
      r.json?.status !== "error" && Number(r.json?.statusCode || 200) < 400))) {
    return { ok: true, shortUrl: short, already: existing };
  }
  throw new Error("Could not create a short URL (HTTP " + r.status + ").");
}

async function stats(value) {
  const settings = await H.getSettings();
  const base = H.sanitizeBaseUrl(settings.yourlsUrl);
  const kw = H.extractKeyword(base, value);
  if (!kw) throw new Error("Enter a keyword or a short URL from your YOURLS server.");
  const r = await request("url-stats", { shorturl: base + "/" + kw });
  return success(r);
}

async function listLinks(filter, limit, start = 0) {
  const safeFilter = filter === "top" ? "top" : "last";
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
  const safeStart = Math.max(0, Math.min(1000000, Number(start) || 0));
  const r = await request("stats", {
    filter: safeFilter, limit: safeLimit, start: safeStart
  });
  return success(r);
}

async function info() {
  const config = await H.getSettings();
  // These are independent read-only requests. Run them concurrently.
  const [dbResult, versionResult, pingResult] = await Promise.allSettled([
    request("db-stats").then(success),
    request("version").then(success),
    request("kurl_ping").then(success)
  ]);
  if (dbResult.status !== "fulfilled") throw dbResult.reason;
  const db = dbResult.value;
  const version = versionResult.status === "fulfilled" ? versionResult.value : {};
  const ping = pingResult.status === "fulfilled" ? pingResult.value : {};
  const extended = ping.kurl_extended === true || ping.kurl_extended === "1" ||
    ping.kurl_extended === 1;
  const helperVersion = extended ? String(ping.kurl_helper_version || "") : "";
  const capabilities = extended && Array.isArray(ping.kurl_capabilities)
    ? ping.kurl_capabilities.filter(v => typeof v === "string") : [];
  return {
    base: H.sanitizeBaseUrl(config.yourlsUrl),
    yourlsVersion: String(version.version || version.version_number || ""),
    helperVersion,
    helperReady: helperVersion === HELPER_VERSION &&
      ["delete", "find_by_url", "regenerate"].every(cap => capabilities.includes(cap)),
    totalLinks: Number(db.total_links ?? db["db-stats"]?.total_links ?? 0) || 0,
    totalClicks: Number(db.total_clicks ?? db["db-stats"]?.total_clicks ?? 0) || 0
  };
}
async function deleteLink(input) {
  const config = await H.getSettings();
  const base = H.sanitizeBaseUrl(config.yourlsUrl);
  const kw = H.extractKeyword(base, input);
  if (!kw) throw new Error("This is not a valid short URL from your configured YOURLS server.");
  const ping = success(await request("kurl_ping"));
  if (String(ping.kurl_helper_version || "") !== HELPER_VERSION ||
      !Array.isArray(ping.kurl_capabilities) ||
      !ping.kurl_capabilities.includes("delete")) {
    throw new Error("Remote deletion requires the current kURL Helper " + HELPER_VERSION + ".");
  }
  const r = await request("kurl_delete", { shorturl: base + "/" + kw });
  success(r);
  return { ok: true };
}

async function attachQr(dataUrl, tabId, filename) {
  if (!Number.isInteger(tabId) || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl || "") ||
      dataUrl.length > 2000000) throw new Error("Invalid QR image or compose tab.");
  const tab = await browser.tabs.get(tabId);
  if (tab.type !== "messageCompose") throw new Error("The selected tab is not a compose window.");
  const bytes = atob(dataUrl.split(",")[1]);
  const array = Uint8Array.from(bytes, c => c.charCodeAt(0));
  const file = new File([array], filename || "kurl-qrcode.png", { type: "image/png" });
  await browser.compose.addAttachment(tabId, { file });
  return { ok: true };
}

async function selectedUrl(tabId) {
  if (!Number.isInteger(tabId)) return "";
  try {
    const frames = await browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const s = window.getSelection();
        const text = s ? String(s).trim() : "";
        const el = s?.anchorNode?.parentElement;
        const link = el?.closest?.("a[href]");
        if (link?.href && /^https?:\/\//i.test(link.href)) return link.href;
        const match = text.match(/https?:\/\/[^\s<>"']+/i);
        return match ? match[0] : "";
      }
    });
    return frames.find(x => x.result)?.result || "";
  } catch {
    return "";
  }
}

async function insertUrl(tabId, value) {
  const tab = await browser.tabs.get(tabId);
  if (tab.type !== "messageCompose") throw new Error("Open a compose window first.");
  const frames = await browser.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: (url) => {
      const editable = document.body?.isContentEditable ? document.body :
        document.querySelector('[contenteditable="true"]');
      if (!editable) return false;
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (range && editable.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        const node = document.createTextNode(url);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editable.append(document.createTextNode(url));
      }
      editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: url }));
      return true;
    },
    args: [value]
  });
  if (!frames.some(x => x.result === true)) {
    throw new Error("Cannot access the compose editor. The short URL was not inserted.");
  }
  return { ok: true };
}

browser.runtime.onMessage.addListener(async message => {
  try {
    if (!message || typeof message.type !== "string") return { ok: false, reason: "Invalid request." };
    switch (message.type) {
      case "CHECK_CONNECTION": return await checkConnection(message.settings || null);
      case "SHORTEN_URL": return await shorten(message.longUrl, message.keyword, message.title);
      case "GET_STATS": return { ok: true, data: await stats(message.shortUrl) };
      case "GET_DASHBOARD_STATS": return { ok: true, data: await info() };
      case "GET_INFO": return { ok: true, data: await info() };
      case "GET_RECENT_LINKS": return { ok: true, data: await listLinks("last", message.limit, message.start) };
      case "GET_TOP_LINKS": return { ok: true, data: await listLinks("top", message.limit) };
      case "DELETE_SHORTURL": return await deleteLink(message.shortUrl);
      case "ATTACH_QR_CODE": return await attachQr(message.dataUrl, message.tabId, message.name);
      case "GET_SELECTED_URL": return { ok: true, url: await selectedUrl(message.tabId) };
      case "INSERT_URL": return await insertUrl(message.tabId, requireTarget(message.url));
      default: return { ok: false, reason: "Unknown request." };
    }
  } catch (error) {
    console.warn("kURL:", error?.message || "Request failed");
    return { ok: false, reason: String(error?.message || "Request failed") };
  }
});

/* Register menus once per event-page start; never remove all menus on right-click. */
browser.menus.create({
  id: "kurl-quick-copy", title: i18n("menuQuickCopy", "kURL: Shorten and copy"),
  contexts: ["link", "selection"]
});
browser.menus.create({
  id: "kurl-quick-insert", title: i18n("menuQuickInsert", "kURL: Shorten and insert"),
  contexts: ["link", "selection", "compose_body"], visible: false
});

browser.menus.onShown.addListener(async (info, tab) => {
  try {
    await browser.menus.update("kurl-quick-insert", {
      visible: tab?.type === "messageCompose" && !!(info.linkUrl || info.selectionText)
    });
    await browser.menus.refresh();
  } catch (error) {
    console.warn("kURL menu update:", error);
  }
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (!["kurl-quick-copy", "kurl-quick-insert"].includes(info.menuItemId)) return;
  const raw = info.linkUrl ||
    (String(info.selectionText || "").match(/https?:\/\/[^\s<>"']+/i) || [])[0];
  const url = H.validHttpUrl(raw);
  if (!url) return notify("Select a complete HTTP(S) URL.");
  try {
    const result = await shorten(url);
    if (info.menuItemId === "kurl-quick-insert") {
      await insertUrl(tab.id, result.shortUrl);
      await notify("Short URL inserted: " + result.shortUrl);
    } else {
      await navigator.clipboard.writeText(result.shortUrl);
      await notify("Short URL copied: " + result.shortUrl);
    }
  } catch (error) {
    await notify("kURL: " + (error?.message || "Shortening failed"));
  }
});