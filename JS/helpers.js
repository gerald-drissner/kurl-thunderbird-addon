window.Helpers = (function() {
  /**
   * Cleans and validates a URL, removing trailing slashes.
   * @param {string} u - The URL string.
   * @returns {string} The sanitized base URL.
   */
  function sanitizeBaseUrl(u) {
    if (!u) return "";
    try {
      u = String(u).trim().replace(/\s+/g, "").replace(/\/+$/, "");
      const x = new URL(u);
      const path = x.pathname.replace(/\/+$/, "");
      return x.origin + path;
    } catch {
      return "";
    }
  }

  /**
   * Converts a JavaScript object to a URLSearchParams instance.
   * @param {object} obj - The object to convert.
   * @returns {URLSearchParams}
   */
  function toFormData(obj) {
    const p = new URLSearchParams();
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) p.append(k, String(v));
    });
      return p;
  }

  /**
   * Retrieves settings from local storage with defaults.
   * @returns {Promise<{yourlsUrl: string, apiSignature: string, autoCopy: boolean}>}
   */
  async function getSettings() {
    const o = await browser.storage.local.get({
      yourlsUrl: "",
      apiSignature: "",
      autoCopy: true
    });
    // Ensure autoCopy is always a boolean
    return {
      yourlsUrl: o.yourlsUrl,
      apiSignature: o.apiSignature,
      autoCopy: o.autoCopy !== false
    };
  }

  /**
   * Saves settings to local storage.
   * @param {object} v - The settings object to save.
   */
  async function setSettings(v) {
    await browser.storage.local.set(v || {});
  }

  /**
   * Safely parses a string that might be JSON.
   * @param {string} t - The text to parse.
   * @returns {object|null} The parsed object or null if invalid.
   */
  function parseMaybeJson(t) {
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }

  /**
   * Extracts the short URL from various possible YOURLS API response formats.
   * @param {object} json - The parsed JSON response.
   * @param {string} base - The base URL of the YOURLS instance.
   * @returns {string|null}
   */
  function extractShort(json, base) {
    if (!json) return null;
    if (json.shorturl) return json.shorturl;
    if (json.url?.shorturl) return json.url.shorturl;
    if (json.link?.shorturl) return json.link.shorturl;
    // Fallback for responses that only return the keyword
    if (json.keyword) return base.replace(/\/+$/, "") + "/" + json.keyword;
    return null;
  }

  /**
   * Extracts the keyword from a short URL or a string.
   * @param {string} base - The base URL of the YOURLS instance.
   * @param {string} s - The short URL or keyword string.
   * @returns {string} The extracted keyword.
   */
  function extractKeyword(base, s) {
    if (!s) return "";
    s = String(s).trim();
    try {
      // If 's' is a full URL, parse it and get the last part of the path.
      const u = new URL(s);
      // Ensure we are not mistaking a path for a keyword from a different domain
      if (base && u.origin === new URL(base).origin) {
        return u.pathname.replace(/\/+$/, "").split("/").pop() || "";
      }
      // If origins don't match, or if it's just a keyword, return as is.
      return s;
    } catch {
      // If it's not a valid URL, assume it's already a keyword.
      return s;
    }
  }


  return {
    sanitizeBaseUrl,
    toFormData,
    getSettings,
    setSettings,
    parseMaybeJson,
    extractShort,
    extractKeyword
  };
})();
