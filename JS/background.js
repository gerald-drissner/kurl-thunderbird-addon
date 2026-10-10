/* kURL Thunderbird MV3 event page: all YOURLS network traffic lives here. */
"use strict";
const H = window.Helpers;
const i18n = (key, fallback) => browser.i18n.getMessage(key) || fallback;
const i18nArg = (key, value, fallback) =>
  browser.i18n.getMessage(key, [String(value)]) || fallback.replace("$1", String(value));
const MAX_BODY = 1048576;
const TIMEOUT = 15000;
const HELPER_VERSION = "1.1.6";
const HELPER_CACHE_MS = 5 * 60 * 1000;
let helperCache = null;
function helperVersionAtLeast(found, minimum = HELPER_VERSION) {
  if (!/^\d+(\.\d+){1,2}$/.test(String(found))) return false;
  const a = String(found).split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i=0;i<3;i++) { if ((a[i]||0)!==(b[i]||0)) return (a[i]||0)>(b[i]||0); }
  return true;
}
// YOURLS API does not provide a browser login. A signed read-only db-stats
// request is our connection/token verification. Classify failures by the
// structured API error fields first, not just an English server message.
function apiFailureKind(json, httpStatus) {
  const value = typeof json?.message === "string" ? json.message.trim() : "";
  const code = Number(json?.errorCode ?? json?.statusCode ?? httpStatus);
  const explicitAuth = /^(?:please log in[.!]?|authentication required[.!]?|invalid (?:api )?signature[.!]?|invalid username or password[.!]?)$/i.test(value);
  if (explicitAuth) return "AUTH_REJECTED";
  if (code === 401 || code === 403) return "ACCESS_DENIED";
  return "OTHER";
}
function apiError(json, code) {
  const kind = apiFailureKind(json, code);
  if (kind === "AUTH_REJECTED") {
    return i18n("apiAuthRejected", "YOURLS rejected API authentication. After an update the signature token may have changed. Sign in to the YOURLS admin page in your browser, open Admin → Tools, copy your current API signature into kURL Settings, then select Test connection & save. kURL does not need your YOURLS username or password. If it still fails, check your computer/server clocks and server access rules.");
  }
  if (kind === "ACCESS_DENIED") {
    return i18n("apiAccessDenied", "The server refused API access (HTTP 401/403). Check the signature token in YOURLS Admin → Tools, then test the connection again. If the token is current, check server security rules, API access and system clocks; kURL cannot sign in through the browser for you.");
  }
  const value = typeof json?.message === "string" ? json.message.trim() : "";
  return value ? value.slice(0, 300) : `YOURLS request failed (HTTP ${code}).`;
}
function apiFailure(json, code) {
  const e = new Error(apiError(json, code));
  const kind = apiFailureKind(json, code);
  if (kind !== "OTHER") e.code = kind;
  return e;
}
function extractFirstUrl(raw) {
  let found = String(raw || "").match(/https?:\/\/[^\s<>"'«»“”]+/i)?.[0] || "";
  // Closing brackets are meaningful inside Wikipedia-style URLs and query values.
  // Remove only unmatched trailing brackets (and ordinary prose punctuation).
  const pairs = {")":"(", "]":"[", "}":"{"};
  while (found) {
    const last = found.slice(-1);
    if (/[.,;:!?»”]/u.test(last)) {found = found.slice(0,-1);continue;}
    if (pairs[last]) {
      const count = char => [...found].filter(c => c === char).length;
      if (count(last) > count(pairs[last])) {found = found.slice(0,-1);continue;}
    }
    break;
  }
  return H.validHttpUrl(found);
}

async function getHelperInfo(force = false) {
  const config = await H.getSettings();
  const key = config.yourlsUrl + ":" + config.apiSignature;
  if (!force && helperCache?.key === key && Date.now() - helperCache.time < HELPER_CACHE_MS)
    return helperCache.info;
  let ping;
  try { ping = success(await request("kurl_ping")); }
  catch { ping = {}; }
  const caps = Array.isArray(ping.kurl_capabilities)
    ? ping.kurl_capabilities.filter(x => typeof x === "string") : [];
  const version = String(ping.kurl_helper_version || "");
  const info = {version, capabilities: caps,
    ready: helperVersionAtLeast(version) &&
      ["delete", "find_by_url", "regenerate"].every(x => caps.includes(x))};
  helperCache = ping.kurl_helper_version ? {key,time: Date.now(),info} : null;
  return info;
}


// Never insert transient status nodes in a Thunderbird compose editor: they
// can be serialized into an outgoing message or an autosaved draft.
const badgeTimers = new Map();
async function signalToolbar(kind, tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  const previous = badgeTimers.get(tabId);
  if (previous) clearTimeout(previous);
  const value = kind === "error" ? "!" : "✓";
  const color = kind === "error" ? "#b91c1c" : "#15803d";
  const actions = [browser.action, browser.messageDisplayAction, browser.composeAction];
  for (const api of actions) {
    try {
      if (api?.setBadgeText) await api.setBadgeText({text: value, tabId});
      if (api?.setBadgeBackgroundColor) await api.setBadgeBackgroundColor({color, tabId});
    } catch { /* This toolbar API may not exist in the current Thunderbird view. */ }
  }
  const timeout = setTimeout(() => {
    if (badgeTimers.get(tabId) !== timeout) return;
    badgeTimers.delete(tabId);
    for (const api of actions) {
      try { void api?.setBadgeText?.({text: "", tabId})?.catch?.(() => {}); } catch {}
    }
  }, 3500);
  badgeTimers.set(tabId, timeout);
}
async function contextFeedback(tab, message, kind = "success") {
  // Suppress only optional success messages. Failures must remain visible.
  if (kind === "success") {
    const settings = await H.getSettings();
    if (!settings.showCopyNotifications) return;
  }
  // OS notifications and a tab-scoped badge do not modify the email body.
  await Promise.allSettled([notify(message), signalToolbar(kind, tab?.id)]);
}

function notify(message) {
  return browser.notifications.create({
    type: "basic", title: "kURL", message: String(message),
    iconUrl: browser.runtime.getURL("images/kurl-icon-48.png")
  }).catch(error => console.warn("kURL notification unavailable:", error?.message || error));
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
  if (!base || !token) throw new Error(i18n("errorNoSettings", "Configure an HTTPS YOURLS connection first."));
  if (!base.startsWith("https://")) throw new Error("An HTTPS YOURLS server is required to protect your API token.");
  const allowed = await browser.permissions.contains({
    origins: [new URL(base).origin + "/*"]
  });
  if (!allowed) throw new Error("YOURLS host permission is not granted. Open Settings.");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const bytes = new TextEncoder().encode(timestamp + token);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const signature = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
    const body = H.toFormData({ ...options, action, format: "json",
      signature, timestamp, hash: "sha256" });
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
    if (!json) {
      if (response.status === 401 || response.status === 403) throw apiFailure(null, response.status);
      throw new Error(browser.i18n.getMessage("apiInvalidResponse", [String(response.status)]) ||
        `YOURLS did not return a valid API response (HTTP ${response.status}). Check the server URL, HTTPS and any proxy or login redirect.`);
    }
    return { httpOK: response.ok, status: response.status, json };
  } catch (error) {
    if (error.name === "AbortError") throw new Error("YOURLS request timed out (15 s).");
    if (error instanceof TypeError) throw new Error("Connection failed. Check HTTPS, the YOURLS hostname, certificate and redirects (redirects are not allowed).");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function success(result) {
  const j = result.json;
  if (!result.httpOK || j?.status === "fail" || j?.status === "error" ||
      j?.statusCode === "error" || Number(j?.statusCode) >= 400 ||
      Number(j?.errorCode) >= 400) {
    throw apiFailure(j, result.status);
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
  if (rawKeyword && !cleanKeyword) throw new Error("Invalid custom keyword; letters, digits, - and _ are accepted, but YOURLS may adjust unsupported characters.");
  const { yourlsUrl } = await H.getSettings();
  const base = H.sanitizeBaseUrl(yourlsUrl);
  const r = await request("shorturl", {
    url, ...(cleanKeyword ? { keyword: cleanKeyword } : {}),
    ...(title ? { title: String(title).slice(0, 300) } : {})
  });
  const short = H.extractShort(r.json, base);
  // error:url means the long URL exists; a keyword collision is a real failure.
  const existing = r.json?.code === "error:url";
  if (short && (existing || (r.httpOK && r.json?.status !== "fail" &&
      r.json?.status !== "error" && Number(r.json?.statusCode || 200) < 400))) {
    return { ok: true, shortUrl: short, already: existing,
      keywordAdjusted: !existing && !!cleanKeyword && H.extractKeyword(base, short) !== cleanKeyword };
  }
  throw apiFailure(r.json, r.status);
}

async function expandShort(value) {
  const settings = await H.getSettings();
  const base = H.sanitizeBaseUrl(settings.yourlsUrl);
  const keyword = H.extractKeyword(base, value);
  if (!keyword) throw new Error(i18n("lookupInvalid", "Enter a short URL from your YOURLS server."));
  // Use the keyword for YOURLS installations whose public HTTPS endpoint sits
  // behind a reverse proxy with an internal HTTP base URL.
  const result = success(await request("expand", {shorturl:keyword}));
  const target = H.validHttpUrl(result.longurl);
  if (!target) throw new Error(i18n("lookupNotFound", "Short URL not found."));
  return {shortUrl:base + "/" + keyword, target,
    title:typeof result.title === "string" ? result.title : ""};
}

async function stats(value) {
  const settings = await H.getSettings();
  const base = H.sanitizeBaseUrl(settings.yourlsUrl);
  const kw = H.extractKeyword(base, value);
  if (!kw) throw new Error("Enter a keyword or a short URL from your YOURLS server.");
  // YOURLS url-stats compares full URLs with YOURLS_SITE. A keyword works
  // for public HTTPS origins proxied to an internal HTTP YOURLS_SITE.
  const r = await request("url-stats", { shorturl: kw });
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

async function info(forceHelper = false) {
  const config = await H.getSettings();
  // These are independent read-only requests. Run them concurrently.
  const [dbResult, versionResult, pingResult] = await Promise.allSettled([
    request("db-stats").then(success),
    request("version").then(success),
    getHelperInfo(forceHelper)
  ]);
  if (dbResult.status !== "fulfilled") throw dbResult.reason;
  const db = dbResult.value;
  const version = versionResult.status === "fulfilled" ? versionResult.value : {};
  const ping = pingResult.status === "fulfilled" ? pingResult.value : {};
  const helperVersion = String(ping.version || "");
  const capabilities = ping.capabilities || [];
  return {
    base: H.sanitizeBaseUrl(config.yourlsUrl),
    yourlsVersion: String(version.version || version.version_number || ""),
    helperVersion,
    helperReady: helperVersionAtLeast(helperVersion) &&
      ["delete", "find_by_url", "regenerate"].every(cap => capabilities.includes(cap)),
    totalLinks: Number(db.total_links ?? db["db-stats"]?.total_links ?? 0) || 0,
    totalClicks: Number(db.total_clicks ?? db["db-stats"]?.total_clicks ?? 0) || 0
  };
}

/* WordPress kURL feature parity: safe reverse lookup and non-destructive edits. */
async function requireHelper(capability) {
  const info = await getHelperInfo();
  if (!info.ready || !info.capabilities.includes(capability))
    throw new Error("This action requires kURL Helper 1.1.6 or newer with the advertised capabilities.");
}

function isHelperNotFound(r) {
  const data = r.json || {};
  return Number(data.statusCode) === 404;
}

async function lookupUrl(rawUrl, preferredShort = "") {
  const url = requireTarget(rawUrl);
  await requireHelper("find_by_url");
  const base = H.sanitizeBaseUrl((await H.getSettings()).yourlsUrl);
  const preferredKw = preferredShort ? H.extractKeyword(base, preferredShort) : "";
  if (preferredShort && !preferredKw) throw new Error("Invalid preferred short URL.");
  const r = await request("kurl_find_by_url", {
    url, ...(preferredKw ? { preferred_shorturl: base + "/" + preferredKw } : {})
  });
  if (isHelperNotFound(r)) return { found: false, shortUrl: "", keyword: "", target: url };
  const json = success(r);
  const shortUrl = H.extractShort(json, base);
  if (!shortUrl) throw new Error("Lookup returned no usable short URL.");
  return { found: true, shortUrl, keyword: H.extractKeyword(base, shortUrl),
    target: H.validHttpUrl(json.longurl || url) || url,
    title: typeof json.title === "string" ? json.title : "" };
}


async function regenerateUrl(rawUrl, existing, rawKeyword = "", title = "") {
  const target = requireTarget(rawUrl);
  const base = H.sanitizeBaseUrl((await H.getSettings()).yourlsUrl);
  const oldKeyword = H.extractKeyword(base, existing);
  if (!oldKeyword) throw new Error("Choose an existing short URL on your YOURLS server.");
  const keyword = String(rawKeyword || "").trim();
  if (keyword && !H.validKeyword(keyword)) {
    throw new Error("Invalid keyword; letters, digits, hyphens and underscores are permitted by this add-on.");
  }
  await requireHelper("regenerate");
  // kurl_regenerate calls yourls_edit_link, preserving the existing row/click history.
  const r = await request("kurl_regenerate", {
    url: target, shorturl: base + "/" + oldKeyword,
    ...(keyword ? { keyword } : {}),
    ...(title ? { title: String(title).slice(0, 300) } : {})
  });
  const data = success(r);
  const result = H.extractShort(data, base);
  if (!result) throw new Error("YOURLS did not return the edited short URL.");
  return { ok: true, shortUrl: result, keyword: H.extractKeyword(base, result) };
}

/* Seven-day, bounded, local operation history. Never store URL targets or tokens. */
const LOG_WINDOW = 7 * 24 * 60 * 60 * 1000;
const LOG_MAX = 100;
let logQueue = Promise.resolve();
function writeLog(action, level = "info") {
  logQueue = logQueue.catch(() => {}).then(async () => {
    const { kurlActivityLog } = await browser.storage.local.get("kurlActivityLog");
    const now = Date.now();
    const current = Array.isArray(kurlActivityLog) ? kurlActivityLog : [];
    const entries = current.filter(row => row && Number.isFinite(row.time) &&
      row.time > now - LOG_WINDOW && row.time <= now && typeof row.action === "string");
    entries.push({ time: now, action: String(action).slice(0, 64),
      level: level === "error" ? "error" : "info" });
    await browser.storage.local.set({ kurlActivityLog: entries.slice(-LOG_MAX) });
  });
  return logQueue.catch(() => {});
}
async function listLog() {
  await logQueue.catch(() => {});
  const { kurlActivityLog } = await browser.storage.local.get("kurlActivityLog");
  const now = Date.now();
  const entries = (Array.isArray(kurlActivityLog) ? kurlActivityLog : [])
    .filter(row => row && row.time > now - LOG_WINDOW && row.time <= now)
    .slice(-LOG_MAX).reverse();
  return entries.map(row => ({ time: row.time,
    action: String(row.action).slice(0, 64),
    level: row.level === "error" ? "error" : "info" }));
}
async function clearLog() {
  await logQueue.catch(() => {});
  await browser.storage.local.remove("kurlActivityLog");
  return { ok: true };
}

async function deleteLink(input) {
  const config = await H.getSettings();
  const base = H.sanitizeBaseUrl(config.yourlsUrl);
  const kw = H.extractKeyword(base, input);
  if (!kw) throw new Error("This is not a short URL from your configured YOURLS server.");
  await requireHelper("delete");
  const r = await request("kurl_delete", { shorturl: base + "/" + kw });
  if (!isHelperNotFound(r)) success(r);
  return { ok: true, alreadyMissing: isHelperNotFound(r) };
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
        const sel = window.getSelection();
        const text = sel ? String(sel).trim() : "";
        const element = sel?.anchorNode?.nodeType === 1
          ? sel.anchorNode : sel?.anchorNode?.parentElement;
        const link = element?.closest?.("a[href]");
        if (link?.href && /^https?:\/\//i.test(link.href))
          return { url: link.href, linked: true };
        return {text};
      }
    });
    for (const frame of frames) {
      const value = frame.result;
      if (value?.linked && H.validHttpUrl(value.url)) return value.url;
      const extracted = extractFirstUrl(value?.text);
      if (extracted) return extracted;
    }
  } catch { /* compose frame may not be scriptable */ }
  return "";
}

/* Self-contained function: executeScript serializes it into the compose frame. */
function performComposeInsertion(url, originalUrl, isPlainText, fromLink = false) {
  const editor = document.body?.isContentEditable ? document.body :
    document.querySelector('[contenteditable="true"]');
  if (!editor?.isContentEditable) return {ok:false,reason:"No editable message body."};
  const sel = window.getSelection();
  if (!sel?.rangeCount && !fromLink) return {ok:false,reason:"Place the cursor inside the message body."};
  let range = sel?.rangeCount ? sel.getRangeAt(0) : null;
  if (!fromLink && !editor.contains(range.commonAncestorContainer))
    return {ok:false,reason:"Place the cursor in the message body."};
  const escape = value => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  if (fromLink && isPlainText && originalUrl &&
      (!range || range.collapsed || sel.toString() !== originalUrl))
    return {ok:false,reason:"PLAIN_TEXT_SELECT_URL"};
  const sameURL = (left,right) => {
    try {return new URL(left).href === new URL(right).href;} catch{return false;}
  };
  if (fromLink && !isPlainText && originalUrl) {
    // macOS Control-click does not move the selection to the clicked link.
    // Target the correct anchor only when it can be identified unambiguously.
    const matches = [...editor.querySelectorAll("a[href]")]
      .filter(a => sameURL(a.getAttribute("href"), originalUrl));
    const touched = range && editor.contains(range.commonAncestorContainer)
      ? matches.filter(a => range.intersectsNode(a)) : [];
    const target = touched.length === 1 ? touched[0]
      : touched.length === 0 && matches.length === 1 ? matches[0] : null;
    if (!target) return {ok:false,reason: matches.length
      ? "AMBIGUOUS_CLICKED_LINK"
      : "CLICKED_LINK_NOT_FOUND"};
    range = document.createRange(); range.selectNodeContents(target); range.collapse(true);
    sel.removeAllRanges(); sel.addRange(range);
  }
  if (!range || !editor.contains(range.commonAncestorContainer))
    return {ok:false,reason:"Place the cursor in the message body."};
  const node = range.commonAncestorContainer;
  const element = node.nodeType === 1 ? node : node.parentElement;
  const anchor = element?.closest?.("a[href]");
  if (anchor && (!originalUrl || !sameURL(anchor.getAttribute("href"),originalUrl))) {
    // A caret in an unrelated link must NEVER rewrite its destination.
    return {ok:false,reason:"Cursor is inside a different hyperlink. Move it outside that link."};
  }
  const chooseRange = r => {sel.removeAllRanges();sel.addRange(r);};
  if (anchor && !isPlainText && originalUrl && sameURL(anchor.getAttribute("href"),originalUrl)) {
    const oldLabel = anchor.textContent || "";
    const looksLikeUrl = /^\S+$/.test(oldLabel.trim()) &&
      (/^https?:\/\//i.test(oldLabel.trim()) ||
       /^(?:www\.)?[^\s/]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(oldLabel.trim()));
    const label = looksLikeUrl ? url : oldLabel || url;
    const replacement = document.createRange();replacement.selectNode(anchor);chooseRange(replacement);
    return {ok:document.execCommand("insertHTML",false,
      '<a href="'+escape(url)+'">'+escape(label)+'</a>')};
  }
  if (!range.collapsed) {
    // A selection can contain more than a URL; do not delete surrounding prose.
    // Narrow to an unambiguous occurrence in a *single* selected text node.
    if (!originalUrl) return {ok:false,reason:"Cannot identify the URL to replace safely."};
    let targetRange = null;
    const selectedText = sel.toString();
    if (selectedText === originalUrl) targetRange = range;
    else if (range.startContainer === range.endContainer && range.startContainer.nodeType === 3) {
      // Selection.toString() normalizes whitespace in quoted HTML. Use raw
      // Text.data and the Range offsets to avoid corrupting adjacent text.
      const rawSelection = range.startContainer.data.slice(range.startOffset, range.endOffset);
      const found = rawSelection.indexOf(originalUrl);
      if (found >= 0 && rawSelection.lastIndexOf(originalUrl) === found) {
        targetRange = document.createRange();
        targetRange.setStart(range.startContainer,range.startOffset + found);
        targetRange.setEnd(range.startContainer,range.startOffset + found + originalUrl.length);
      }
    } else {
      // Support cross-node selections, but only when the URL lives in one text node.
      const scope = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
      const walker = document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
      let candidate, hits = [];
      while ((candidate=walker.nextNode())) {
        const haystack = candidate.textContent || "";
        let at=haystack.indexOf(originalUrl);
        while(at!==-1) {
          const test = document.createRange();test.setStart(candidate,at);
          test.setEnd(candidate,at+originalUrl.length);
          if (range.compareBoundaryPoints(Range.START_TO_START,test)<=0 &&
              range.compareBoundaryPoints(Range.END_TO_END,test)>=0) hits.push(test);
          at=haystack.indexOf(originalUrl,at+1);
        }
      }
      if(hits.length===1) targetRange=hits[0];
    }
    if (!targetRange) return {ok:false,reason:"Select only the URL or place the cursor outside the selected paragraph."};
    // A paragraph selection can cross a pre-existing hyperlink. Do not insert
    // an <a> inside another <a>; replace only the matching original link.
    const textElement = targetRange.startContainer?.nodeType === 3
      ? targetRange.startContainer.parentElement : targetRange.startContainer;
    const nestedAnchor = textElement?.closest?.("a[href]");
    if (nestedAnchor && !isPlainText) {
      if (!originalUrl || !sameURL(nestedAnchor.getAttribute("href"),originalUrl))
        return {ok:false,reason:"Selected text belongs to a different hyperlink."};
      const labelText = (nestedAnchor.textContent || "").trim();
      const labelIsUrl = /^\S+$/.test(labelText) &&
        (/^https?:\/\//i.test(labelText) ||
         /^(?:www\.)?[^\s/]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(labelText));
      const replacement = document.createRange();replacement.selectNode(nestedAnchor);chooseRange(replacement);
      return {ok:document.execCommand("insertHTML",false,
        '<a href="'+escape(url)+'">'+escape(labelIsUrl ? url : labelText || url)+'</a>')};
    }
    chooseRange(targetRange);
  }
  if (isPlainText) return {ok:document.execCommand("insertText",false,url)};
  return {ok:document.execCommand("insertHTML",false,
    '<a href="'+escape(url)+'">'+escape(url)+'</a>')};
}
async function insertUrl(tabId, value, original = "", fromLink = false) {
  const tab = await browser.tabs.get(tabId);
  if (tab.type !== "messageCompose") throw new Error("Open a compose window first.");
  const details = await browser.compose.getComposeDetails(tabId);
  const eligible = await browser.scripting.executeScript({
    target: {tabId,allFrames:true},
    func: (clickedLink) => {
      const editor = document.body?.isContentEditable ? document.body :
        document.querySelector('[contenteditable="true"]');
      if (!editor?.isContentEditable) return false;
      const sel = window.getSelection();
      return !!(clickedLink || (sel?.rangeCount && editor.contains(sel.getRangeAt(0).commonAncestorContainer)));
    }, args: [fromLink]
  });
  const candidates=eligible.filter(frame=>frame.result===true);
  if(candidates.length!==1) throw new Error("Select a URL or place the caret in exactly one compose editor.");
  const frames=await browser.scripting.executeScript({
    target:{tabId,frameIds:[candidates[0].frameId]},
    func:performComposeInsertion,
    args:[value,original,!!details.isPlainText,fromLink]
  });
  const result=frames[0]?.result;
  if(!result?.ok) {
    // Codes cross the script-injection boundary; the background translates them.
    const reasons = {
      AMBIGUOUS_CLICKED_LINK: ["insertAmbiguousLink", "Several links use this URL. Click inside the desired link and try again."],
      CLICKED_LINK_NOT_FOUND: ["insertClickedLinkMissing", "The clicked link was not found in the message body."],
      PLAIN_TEXT_SELECT_URL: ["insertPlainTextSelectUrl", "In plain-text mode, select the URL before using Shorten and insert."]
    };
    const message = reasons[result?.reason];
    throw new Error(message ? i18n(message[0], message[1]) :
      (result?.reason || i18n("insertCannotSafely", "Could not insert the short URL safely.")));
  }
  return {ok:true};
}

browser.runtime.onMessage.addListener(async message => {
  try {
    if (!message || typeof message.type !== "string") return { ok: false, reason: "Invalid request." };
    // Log read-only requests only on explicit failure, never their URLs or tokens.
    const eventTypes = new Set(["SHORTEN_URL", "DELETE_SHORTURL", "LOOKUP_URL", "UPDATE_URL", "REGENERATE_URL"]);
    try {
      const response = await dispatch(message);
      if (eventTypes.has(message.type) && !message.bulk) {
        await writeLog(message.type, response?.ok ? "info" : "error");
      }
      return response;
    } catch (error) {
      if (eventTypes.has(message.type) && !message.bulk) await writeLog(message.type, "error");
      throw error;
    }
  } catch (error) {
    console.warn("kURL:", error?.message || "Request failed");
    return { ok: false, reason: String(error?.message || "Request failed"),
      ...(error?.code === "AUTH_REJECTED" || error?.code === "ACCESS_DENIED"
        ? { errorCode: error.code } : {}) };
  }
});

async function dispatch(message) {
    switch (message.type) {
      case "CHECK_CONNECTION": return await checkConnection(message.settings || null);
      case "SHORTEN_URL": return await shorten(message.longUrl, message.keyword, message.title);
      case "GET_STATS": return { ok: true, data: await stats(message.shortUrl) };
      case "EXPAND_URL": return { ok: true, data: await expandShort(message.shortUrl) };
      case "GET_INFO": return { ok: true, data: await info(!!message.forceHelper) };
      case "GET_RECENT_LINKS": return { ok: true, data: await listLinks("last", message.limit, message.start) };
      case "GET_TOP_LINKS": return { ok: true, data: await listLinks("top", message.limit) };
      case "DELETE_SHORTURL": return await deleteLink(message.shortUrl);
      case "ATTACH_QR_CODE": return await attachQr(message.dataUrl, message.tabId, message.name);
      case "GET_SELECTED_URL": return { ok: true, url: await selectedUrl(message.tabId) };
      case "INSERT_URL": return await insertUrl(message.tabId, requireTarget(message.url),
        message.original ? requireTarget(message.original) : "");
      case "LOOKUP_URL": return { ok: true, data: await lookupUrl(message.longUrl, message.preferredShort) };
      case "UPDATE_URL": return await regenerateUrl(message.longUrl, message.shortUrl,
        message.keyword || H.extractKeyword(H.sanitizeBaseUrl((await H.getSettings()).yourlsUrl), message.shortUrl),
        message.title);
      case "REGENERATE_URL": return await regenerateUrl(message.longUrl, message.shortUrl, message.keyword, message.title);
      case "LOG_BULK":
        await writeLog("BULK: " + Math.min(250, Math.max(0, Number(message.total) || 0)) + " URLs",
          message.failures ? "error" : "info");
        return {ok:true};
      case "GET_LOG": return { ok: true, data: await listLog() };
      case "CLEAR_LOG": return await clearLog();
      default: return { ok: false, reason: "Unknown request." };
    }
}

/* Migrate persistent 2.0.7 menus, including a previously hidden Insert item. */
const KURL_MENU_COPY = "kurl-quick-copy";
const KURL_MENU_INSERT = "kurl-quick-insert";
// Remove and recreate ONLY this extension's IDs; never remove other extensions' menus.
let menuInitialization = Promise.resolve();
function ensureMenus() {
  menuInitialization = menuInitialization.catch(() => {}).then(async () => {
    const definitions = [
      {id: KURL_MENU_COPY, title: i18n("menuQuickCopy", "kURL: Shorten and copy"),
       contexts: ["link", "selection"]},
      {id: KURL_MENU_INSERT, title: i18n("menuQuickInsert", "kURL: Shorten and insert"),
       contexts: ["compose_body"], visible: true}
    ];
    for (const definition of definitions) {
      try { await browser.menus.remove(definition.id); }
      catch { /* absent before initial install */ }
      try { browser.menus.create(definition); }
      catch (error) {console.warn("kURL context menu unavailable:", error);}
    }
  });
  return menuInitialization;
}
// Event listeners must be registered synchronously in MV3 background pages.
browser.runtime.onInstalled.addListener(() => { void ensureMenus(); });
browser.runtime.onStartup?.addListener(() => { void ensureMenus(); });

browser.menus.onClicked.addListener(async (info, tab) => {
  if (!["kurl-quick-copy", "kurl-quick-insert"].includes(info.menuItemId)) return;
  const raw = info.linkUrl ||
    extractFirstUrl(info.selectionText);
  const url = H.validHttpUrl(raw);
  if (!url) return contextFeedback(tab, i18n("contextSelectUrl", "Select a complete HTTP(S) URL."), "error");
  try {
    const result = await shorten(url);
    if (info.menuItemId === "kurl-quick-insert") {
      await insertUrl(tab.id, result.shortUrl, url, !!info.linkUrl);
      await writeLog("RIGHT_CLICK_INSERT");
      await contextFeedback(tab, i18nArg("contextInserted", result.shortUrl, "✓ Short URL inserted: $1"));
    } else {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.shortUrl);
      } else {
        const field = document.createElement("textarea");
        field.value = result.shortUrl;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        try {
          if (!document.execCommand("copy")) throw new Error("Clipboard access denied.");
        } finally { field.remove(); }
      }
      await writeLog("RIGHT_CLICK_COPY");
      await contextFeedback(tab, i18nArg("contextCopied", result.shortUrl, "✓ Copied to clipboard: $1"));
    }
  } catch (error) {
    await writeLog("RIGHT_CLICK_FAILED", "error");
    await contextFeedback(tab, "kURL: " + (error?.message || i18n("contextShorteningFailed", "Shortening failed")), "error");
  }
});