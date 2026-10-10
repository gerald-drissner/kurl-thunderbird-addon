/* Shared input validation and YOURLS response helpers. */
window.Helpers = (() => {
  "use strict";

  function sanitizeBaseUrl(input) {
    try {
      const raw = String(input || "").trim();
      if (!raw || /\s/.test(raw)) return "";
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.username || url.password ||
          url.search || url.hash) return "";
      let path = url.pathname.replace(/\/+$/, "");
      path = path.replace(/\/yourls-api\.php$/i, "").replace(/\/admin$/i, "");
      return url.origin + path;
    } catch {
      return "";
    }
  }

  function validHttpUrl(input) {
    try {
      const raw = String(input || "").trim();
      if (!raw || /[\s\\]/.test(raw) || raw.length > 8192) return "";
      const url = new URL(raw);
      if (!["https:", "http:"].includes(url.protocol) || !url.hostname ||
          url.username || url.password) return "";
      return raw;
    } catch {
      return "";
    }
  }

  function validKeyword(value) {
    const keyword = String(value || "").trim();
    return /^[A-Za-z0-9_-]{1,100}$/.test(keyword) ? keyword : "";
  }

  function extractKeyword(base, input) {
    const str = String(input || "").trim();
    if (!str) return "";
    if (!/^https?:\/\//i.test(str)) return validKeyword(str);
    try {
      const server = new URL(sanitizeBaseUrl(base) + "/");
      const candidate = new URL(str);
      if (candidate.origin !== server.origin || candidate.search || candidate.hash ||
          !candidate.pathname.startsWith(server.pathname)) return "";
      const tail = candidate.pathname.slice(server.pathname.length);
      if (!tail || tail.includes("/") || /%/.test(tail)) return "";
      return validKeyword(tail);
    } catch {
      return "";
    }
  }

  function extractShort(json, base) {
    const candidates = [json?.shorturl, json?.url?.shorturl, json?.link?.shorturl];
    for (const candidate of candidates) {
      const url = validHttpUrl(candidate);
      if (url && extractKeyword(base, url)) return url;
    }
    const keyword = validKeyword(json?.keyword);
    return keyword && sanitizeBaseUrl(base)
      ? sanitizeBaseUrl(base) + "/" + keyword : null;
  }

  function toFormData(obj) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(obj || {})) {
      if (value !== undefined && value !== null) params.append(key, String(value));
    }
    return params;
  }

  async function getSettings() {
    const data = await browser.storage.local.get({
      yourlsUrl: "", apiSignature: "", autoCopy: true
    });
    return {
      yourlsUrl: sanitizeBaseUrl(data.yourlsUrl),
      apiSignature: String(data.apiSignature || ""),
      autoCopy: data.autoCopy !== false
    };
  }

  async function setSettings(values) {
    return browser.storage.local.set(values);
  }

  function parseMaybeJson(text) {
    try {
      const obj = JSON.parse(text);
      return obj && typeof obj === "object" ? obj : null;
    } catch {
      return null;
    }
  }

  return {
    sanitizeBaseUrl, validHttpUrl, validKeyword, extractKeyword, extractShort,
    toFormData, getSettings, setSettings, parseMaybeJson
  };
})();