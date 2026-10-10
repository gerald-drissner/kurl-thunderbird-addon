/* kURL popup: bound to the originating Thunderbird tab, not global prefill storage. */
(() => {
  "use strict";
  const H = window.Helpers;
  const $ = id => document.getElementById(id);
  const t = (key, fallback, replacements) =>
    browser.i18n.getMessage(key, replacements) || fallback;
  let composeTabId = null;
  let isBusy = false;
  let lastShortenedPair = null;

  function status(value, success = false) {
    $("msg").textContent = value;
    $("msg").className = success ? "info ok" : "info";
  }
  function translate() {
    document.documentElement.lang = browser.i18n.getUILanguage().split("-")[0];
    document.documentElement.dir = browser.i18n.getMessage("@@bidi_dir") || "ltr";
    document.querySelectorAll("[data-i18n-key]").forEach(el => {
      const translated = browser.i18n.getMessage(el.dataset.i18nKey);
      if (translated) {
        if (el.hasAttribute("placeholder")) el.placeholder = translated;
        else el.textContent = translated;
      }
    });
  }
  async function send(type, params = {}) {
    const response = await browser.runtime.sendMessage({ type, ...params });
    if (!response?.ok) throw new Error(response?.reason || "Request failed.");
    return response;
  }
  async function busy(action) {
    if (isBusy) return;
    isBusy = true;
    $("btnShorten").disabled = true;
    const quick = $("btnShortenInsert");
    if (quick) quick.disabled = true;
    try { await action(); }
    catch (error) { status(String(error?.message || error)); }
    finally {
      isBusy = false;
      $("btnShorten").disabled = false;
      if (quick) quick.disabled = false;
    }
  }
  function qrVisibility(reset = true) {
    const hasShort = !!$("shortUrl").value.trim();
    $("btnQrCode").style.display = hasShort ? "inline-block" : "none";
    if (reset) {
      $("btnDownloadQr").style.display = "none";
      if ($("btnAttachQr")) $("btnAttachQr").style.display = "none";
      $("qrcode-display").style.display = "none";
      $("qrcode-display").replaceChildren();
    }
  }
  // qrcode-generator 2.0.4 (unmodified vendor code in JS/qrcode.js).
  // Render the QR modules ourselves; the 4-module white quiet zone is part of the PNG.
  function renderQr(target, value, size) {
    target.replaceChildren();
    const qr = qrcode(0, "H");
    // Encode the browser-equivalent ASCII URI for reliable cross-device QR
    // scanning (percent-encoded UTF-8 paths and punycode hostnames).
    // This does not modify the original URL stored in YOURLS or the UI.
    qr.addData(new URL(value).href, "Byte");
    qr.make();

    const count = qr.getModuleCount();
    const marginModules = 4;
    const minimumSide = count + 2 * marginModules;
    const side = Math.max(size, minimumSide);
    const step = Math.max(1, Math.floor(side / minimumSide));
    const quiet = (side - count * step) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create QR drawing context.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, side, side);
    ctx.fillStyle = "#000000";
    const x0 = Math.floor(quiet);
    const y0 = Math.floor(quiet);
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(x0 + col * step, y0 + row * step, step, step);
        }
      }
    }
    target.appendChild(canvas);
    return canvas;
  }
  function clearResults() {
    lastShortenedPair = null;
    $("shortUrl").value = "";
    $("statsInput").value = "";
    $("btnDelete").disabled = true;
    $("json").textContent = "";
    $("json").style.display = "none";
    $("btnDetails").style.visibility = "hidden";
    qrVisibility();
  }
  async function insertCurrent() {
    if (!composeTabId) throw new Error(t("popupErrorNoCompose", "Open a compose window."));
    const url = H.validHttpUrl($("shortUrl").value);
    if (!url) throw new Error("There is no valid short URL to insert.");
    if (!lastShortenedPair || lastShortenedPair.shortUrl !== url) {
      throw new Error(t("popupErrorNoOriginal", "Shorten the target URL first before inserting it."));
    }
    if (H.validHttpUrl($("longUrl").value) !== lastShortenedPair.longUrl) {
      throw new Error(t("popupErrorTargetChanged", "Target URL changed. Shorten again before inserting."));
    }
    await send("INSERT_URL", { tabId: composeTabId, url,
      original: lastShortenedPair.longUrl });
    status(t("popupStatusInserted", "Short URL inserted."), true);
  }
  async function shortenAndMaybeInsert(insert = false) {
    const url = H.validHttpUrl($("longUrl").value);
    if (!url) throw new Error(t("popupErrorInvalidUrl", "Enter a valid HTTP(S) URL."));
    clearResults();
    status(t("popupStatusShortening", "Shortening…"));
    const response = await send("SHORTEN_URL", {
      longUrl: url,
      keyword: $("keyword").value.trim(),
      title: $("title").value.trim()
    });
    if (!H.validHttpUrl(response.shortUrl)) throw new Error("YOURLS returned an invalid short URL.");
    lastShortenedPair = { longUrl: url, shortUrl: response.shortUrl };
    $("shortUrl").value = response.shortUrl;
    $("statsInput").value = response.shortUrl;
    $("btnDelete").disabled = false;
    qrVisibility();
    status(response.already
      ? t("popupInfoAlreadyShortened", "This URL already has a short link.")
      : t("popupStatusCreated", "Short URL created."), true);
    if (response.keywordAdjusted && !response.already) status(t("keywordAdjusted", "YOURLS changed your custom keyword; the returned short URL was used."), true);
    if (insert) {
      await insertCurrent();
    } else if ((await H.getSettings()).autoCopy) {
      try {
        await navigator.clipboard.writeText(response.shortUrl);
        status(t("popupStatusCopied", "Copied to clipboard."), true);
      } catch (error) {
        console.warn("kURL: Auto-copy unavailable:", error.message);
      }
    }
  }

  $("btnShorten").addEventListener("click", () => busy(() => shortenAndMaybeInsert()));
  $("btnShortenInsert")?.addEventListener("click", () => busy(() => shortenAndMaybeInsert(true)));
  $("btnInsert")?.addEventListener("click", () => busy(insertCurrent));

  $("btnCopy").addEventListener("click", async () => {
    try {
      const url = H.validHttpUrl($("shortUrl").value);
      if (!url) throw new Error(t("popupErrorNothingToCopy", "Nothing to copy."));
      await navigator.clipboard.writeText(url);
      status(t("popupStatusCopied", "Copied to clipboard."), true);
    } catch (error) { status(error.message); }
  });
  $("btnCopyClose").addEventListener("click", async () => {
    try {
      const url = H.validHttpUrl($("shortUrl").value);
      if (!url) throw new Error(t("popupErrorNothingToCopy", "Nothing to copy."));
      await navigator.clipboard.writeText(url);
      window.close();
    } catch (error) { status(error.message); }
  });
  $("btnStats").addEventListener("click", () => busy(async () => {
    const query = ($("statsInput").value || $("shortUrl").value).trim();
    if (!query) throw new Error(t("popupErrorEnterUrlForStats", "Enter a short URL or keyword."));
    status(t("popupStatusFetchingStats", "Fetching stats…"));
    const result = await send("GET_STATS", { shortUrl: query });
    const item = result.data?.link || result.data?.url || {};
    status(t("popupStatusStatsResult",
      String(item.shorturl || query) + ": " + String(item.clicks ?? "?") + " clicks",
      [String(item.shorturl || query), String(item.url || "?"), String(item.clicks ?? "?")]), true);
    $("json").textContent = JSON.stringify(result.data, null, 2);
    $("btnDetails").style.visibility = "visible";
  }));
  $("btnDetails").addEventListener("click", () => {
    $("json").style.display = $("json").style.display === "block" ? "none" : "block";
  });
  $("btnQrCode").addEventListener("click", () => {
    const panel = $("qrcode-display");
    if (panel.style.display !== "block") {
      try {
        renderQr(panel, $("shortUrl").value, 128);
        panel.style.display = "block";
        $("btnDownloadQr").style.display = "inline-block";
        if (composeTabId && $("btnAttachQr")) $("btnAttachQr").style.display = "inline-block";
      } catch (error) {
        status(t("popupErrorQrGeneration", "Could not generate QR code.") + " " + error.message);
      }
    } else {
      qrVisibility();
    }
  });
  $("btnDownloadQr").addEventListener("click", () => {
    const holder = document.createElement("div");
    try {
      const canvas = renderQr(holder, $("shortUrl").value, 512);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "kurl-qrcode.png";
      link.click();
    } catch (error) {
      status(t("popupErrorQrGeneration", "Could not generate QR code.") + " " + error.message);
    }
  });
  $("btnAttachQr").addEventListener("click", () => busy(async () => {
    if (!composeTabId) throw new Error(t("popupErrorNoCompose", "No compose window."));
    const url = H.validHttpUrl($("shortUrl").value);
    if (!url) throw new Error(t("popupErrorNothingToAttach", "Nothing to attach."));
    status(t("popupStatusAttachingQr", "Attaching QR code…"));
    const holder = document.createElement("div");
    const canvas = renderQr(holder, url, 512);

    await send("ATTACH_QR_CODE", {
      tabId: composeTabId,
      dataUrl: canvas.toDataURL("image/png"),
      name: "kurl-qrcode.png"
    });
    status(t("popupStatusQrAttached", "QR code attached."), true);
  }));
  $("btnDelete").addEventListener("click", () => busy(async () => {
    const value = ($("statsInput").value || $("shortUrl").value).trim();
    if (!value) throw new Error(t("popupErrorProvideUrlToDelete", "Enter a short URL."));
    if (!window.confirm(t("confirmDelete", "Delete this YOURLS short URL permanently? Links in websites and sent emails may stop working."))) return;
    status(t("popupStatusDeleting", "Deleting…"));
    await send("DELETE_SHORTURL", { shortUrl: value });
    clearResults();
    status(t("popupStatusDeleted", "Link deleted."), true);
  }));
  $("open-options").addEventListener("click", async () => {
    try {
      // openOptionsPage() points to the dashboard; onboarding needs the token form.
      await browser.tabs.create({ url: browser.runtime.getURL("options.html") });
      window.close();
    } catch (error) {
      status(String(error?.message || error));
    }
  });
  $("open-dashboard-link")?.addEventListener("click", event => {
    event.preventDefault();
    browser.tabs.create({ url: browser.runtime.getURL("dashboard.html") });
    window.close();
  });

  async function init() {
    translate();
    clearResults();
    status(t("popupStatusReady", "Ready."));
    const config = await H.getSettings();
    if (!config.yourlsUrl || !config.apiSignature) {
      $("setup-message").style.display = "block";
      return;
    }
    $("main-content").style.display = "block";
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.type === "messageCompose") composeTabId = tab.id;
    if (!composeTabId) {
      $("btnInsert")?.remove();
      $("btnShortenInsert")?.remove();
      $("btnAttachQr")?.remove();
    }
    if (!tab) return;
    try {
      const selected = await send("GET_SELECTED_URL", { tabId: tab.id });
      const url = H.validHttpUrl(selected.url);
      if (!url) return;
      const base = H.sanitizeBaseUrl(config.yourlsUrl);
      if (H.extractKeyword(base, url)) {
        $("shortUrl").value = url;
        $("statsInput").value = url;
        $("btnDelete").disabled = false;
        qrVisibility();
        $("btnStats").click();
      } else {
        $("longUrl").value = url;
      }
    } catch (error) {
      console.warn("kURL: Unable to inspect selection:", error.message);
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    init().catch(error => status(String(error.message || error)));
  });
})();