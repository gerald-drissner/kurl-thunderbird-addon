/* kURL popup: bound to the originating Thunderbird tab, not global prefill storage. */
(() => {
  "use strict";
  const H = window.Helpers;
  const $ = id => document.getElementById(id);
  const t = (key, fallback, replacements) =>
    browser.i18n.getMessage(key, replacements) || fallback;
  let composeTabId = null;
  let isBusy = false;

  function status(value, success = false) {
    $("msg").textContent = value;
    $("msg").className = success ? "info ok" : "info";
  }
  function translate() {
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
      $("btnAttachQr").style.display = "none";
      $("qrcode-display").style.display = "none";
      $("qrcode-display").replaceChildren();
    }
  }
  function renderQr(target, value, size) {
    target.replaceChildren();
    new QRCode(target, {
      text: value, width: size, height: size,
      colorDark: "#000000", colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
    return target.querySelector("canvas");
  }
  function clearResults() {
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
    await send("INSERT_URL", { tabId: composeTabId, url });
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
    $("shortUrl").value = response.shortUrl;
    $("statsInput").value = response.shortUrl;
    $("btnDelete").disabled = false;
    qrVisibility();
    status(response.already
      ? t("popupInfoAlreadyShortened", "This URL already has a short link.")
      : t("popupStatusCreated", "Short URL created."), true);
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
      renderQr(panel, $("shortUrl").value, 128);
      panel.style.display = "block";
      $("btnDownloadQr").style.display = "inline-block";
      if (composeTabId) $("btnAttachQr").style.display = "inline-block";
    } else {
      qrVisibility();
    }
  });
  $("btnDownloadQr").addEventListener("click", () => {
    const holder = document.createElement("div");
    const canvas = renderQr(holder, $("shortUrl").value, 512);
    if (!canvas) return status("Could not generate QR code.");
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "kurl-qrcode.png";
    link.click();
  });
  $("btnAttachQr").addEventListener("click", () => busy(async () => {
    if (!composeTabId) throw new Error(t("popupErrorNoCompose", "No compose window."));
    const url = H.validHttpUrl($("shortUrl").value);
    if (!url) throw new Error(t("popupErrorNothingToAttach", "Nothing to attach."));
    status(t("popupStatusAttachingQr", "Attaching QR code…"));
    const holder = document.createElement("div");
    const canvas = renderQr(holder, url, 512);
    if (!canvas) throw new Error("Unable to generate QR image.");
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
    if (!window.confirm("Permanently delete this short URL on YOURLS? It may be referenced by WordPress posts or existing emails.")) return;
    status(t("popupStatusDeleting", "Deleting…"));
    await send("DELETE_SHORTURL", { shortUrl: value });
    clearResults();
    status(t("popupStatusDeleted", "Link deleted."), true);
  }));
  $("open-options").addEventListener("click", () => browser.runtime.openOptionsPage());
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