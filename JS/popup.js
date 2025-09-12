/**
 * kurl - popup.js
 *
 * This script controls the user interface and logic within the main popup window.
 */

(() => {
  "use strict";

  const H = window.Helpers;
  const $ = (id) => document.getElementById(id);

  async function getSelectedUrlFromActiveTab() {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) return '';
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => {
        try {
          const sel = window.getSelection?.();
          let text = sel ? String(sel).trim() : '';
          const node = sel?.anchorNode?.parentElement;
          const a = node?.closest?.('a');
          if (a?.href) return a.href;
          if (text) {
            const m = text.match(/https?:\/\/\S+/i);
            if (m) return m[0];
          }
          return '';
        } catch { return ''; }
      }
    });
    const hit = (results || []).find(r => r && r.result && r.result.trim());
    return hit ? hit.result.trim() : '';
  }

  // --- Element references ---
  const longUrl = $("longUrl");
  const keyword = $("keyword");
  const title = $("title");
  const shortUrl = $("shortUrl");
  const statsInput = $("statsInput");
  const btnShorten = $("btnShorten");
  const btnCopy = $("btnCopy");
  const btnCopyClose = $("btnCopyClose");
  const btnInsert = $("btnInsert");
  const btnDelete = $("btnDelete");
  const btnStats = $("btnStats");
  const btnDetails = $("btnDetails");
  const btnQrCode = $("btnQrCode");
  const btnDownloadQr = $("btnDownloadQr");
  const btnAttachQr = $("btnAttachQr");
  const qrcodeDisplay = $("qrcode-display");
  const msg = $("msg");
  const jsonBox = $("json");
  const setupMessage = $("setup-message");
  const mainContent = $("main-content");
  const openOptionsBtn = $("open-options");

  // --- UI Helper Functions ---
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
  function setMsg(text, cls = "") { msg.className = "info " + cls; msg.textContent = text; }
  function toggleJson(show, data) {
    jsonBox.style.display = show ? "block" : "none";
    if (show && data) {
      jsonBox.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    }
  }
  function displaySetupMessage() {
    mainContent.style.display = "none";
    setupMessage.style.display = "block";
  }

  function updateQrButtonVisibility() {
    const isShortUrlPresent = shortUrl.value.trim() !== '';
    btnQrCode.style.display = isShortUrlPresent ? 'inline-block' : 'none';
    // Always hide the secondary buttons and display; they are shown on btnQrCode click
    btnDownloadQr.style.display = 'none';
    if (btnAttachQr) btnAttachQr.style.display = 'none';
    qrcodeDisplay.style.display = 'none';
  }

  // --- QR Code Functions ---
  function generateQrCode(url) {
    qrcodeDisplay.replaceChildren();
    new QRCode(qrcodeDisplay, { text: url, width: 128, height: 128, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
  }

  async function attachQrCodeToEmail(url) {
    const { lastActiveComposeTabId } = await browser.storage.local.get("lastActiveComposeTabId");
    if (!lastActiveComposeTabId) {
      throw new Error("Invalid tab ID");
    }
    const qrContainer = document.createElement('div');
    document.body.appendChild(qrContainer);
    new QRCode(qrContainer, { text: url, width: 512, height: 512, correctLevel: QRCode.CorrectLevel.H });
    const canvas = qrContainer.querySelector('canvas');
    if (!canvas) { qrContainer.remove(); throw new Error("Could not create QR code canvas."); }
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    qrContainer.remove();
    const r = await browser.runtime.sendMessage({ type: "ATTACH_QR_CODE", blob: blob, name: 'kurl-qrcode.png' });
    if (!r?.ok) { throw new Error(r?.reason || "Failed to attach QR code."); }
  }

  // --- Button Event Listeners ---
  btnShorten.addEventListener("click", async () => {
    const url = longUrl.value.trim();
    if (!/^https?:\/\//i.test(url)) return setMsg(browser.i18n.getMessage("popupErrorInvalidUrl"));

      setMsg(browser.i18n.getMessage("popupStatusShortening"));
    toggleJson(false);
    btnDetails.style.visibility = 'hidden';
    shortUrl.value = "";
    statsInput.value = "";
    updateQrButtonVisibility();

    const r = await browser.runtime.sendMessage({ type: "SHORTEN_URL", longUrl: url, keyword: keyword.value.trim(), title: title.value.trim() });

    if (!r || !r.ok) return setMsg(r?.reason || browser.i18n.getMessage("errorShortenFailed"));

    setMsg(r.already ? browser.i18n.getMessage("popupInfoAlreadyShortened") : browser.i18n.getMessage("popupStatusCreated"), "ok");
    shortUrl.value = r.shortUrl || "";
    statsInput.value = r.shortUrl || "";
    btnDelete.disabled = !r.shortUrl;

    const settings = await H.getSettings();
    if (settings.autoCopy && r.shortUrl) {
      try {
        await navigator.clipboard.writeText(r.shortUrl);
        setMsg(msg.textContent + " " + browser.i18n.getMessage("popupStatusCopied"), "ok");
      } catch (err) {
        console.error("kurl: Auto-copy failed", err);
      }
    }
    updateQrButtonVisibility();
  });

  btnCopy.addEventListener("click", async () => {
    const v = shortUrl.value.trim();
    if (!v) return setMsg(browser.i18n.getMessage("popupErrorNothingToCopy"));
    try {
      await navigator.clipboard.writeText(v);
      setMsg(browser.i18n.getMessage("popupStatusCopied"), "ok");
    } catch (err) {
      console.error("kurl: Copy failed", err);
      setMsg(browser.i18n.getMessage("popupErrorCopyFailed"));
    }
  });

  btnCopyClose.addEventListener("click", async () => {
    const v = shortUrl.value.trim();
    if (!v) return setMsg(browser.i18n.getMessage("popupErrorNothingToCopy"));
    try {
      await navigator.clipboard.writeText(v);
      window.close();
    } catch (err) {
      console.error("kurl: Copy failed", err);
      // If copy fails, at least let the user know before closing.
      setMsg(browser.i18n.getMessage("popupErrorCopyFailed"));
    }
  });

  if (btnInsert) {
    btnInsert.addEventListener("click", async () => {
      const textToInsert = shortUrl.value.trim();
      if (!textToInsert) return setMsg(browser.i18n.getMessage("popupErrorNothingToInsert"));

      try {
        const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true, type: "messageCompose" });
        if (!tab) {
          throw new Error("No active compose tab found.");
        }

        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: (text) => {
            // Note: document.execCommand is obsolete in web contexts but is a reliable
            // method for inserting text into Thunderbird's legacy compose window.
            document.execCommand('insertText', false, text);
          },
          args: [textToInsert],
        });

        setMsg(browser.i18n.getMessage("popupStatusInserted"), "ok");
      } catch (e) {
        console.error("kurl: Insert failed", e);
        setMsg(browser.i18n.getMessage("popupErrorNoCompose"));
      }
    });
  }

  btnStats.addEventListener("click", async () => {
    const q = (statsInput.value || shortUrl.value).trim();
    if (!q) return setMsg(browser.i18n.getMessage("popupErrorEnterUrlForStats"));
    setMsg(browser.i18n.getMessage("popupStatusFetchingStats"));
    toggleJson(false);
    btnDetails.style.visibility = 'hidden';
    const r = await browser.runtime.sendMessage({ type: "GET_STATS", shortUrl: q });
    if (!r || !r.ok) return setMsg(r?.reason || browser.i18n.getMessage("errorStatsFailed"));
    const l = r.data?.link || r.data?.url || {};
    const message = browser.i18n.getMessage("popupStatusStatsResult", [l.shorturl || "?", l.url || "?", l.clicks ?? "?"]);
    setMsg(message, "ok");
    jsonBox.textContent = JSON.stringify(r.data, null, 2);
    btnDetails.style.visibility = 'visible';
  });

  btnDetails.addEventListener("click", () => {
    toggleJson(jsonBox.style.display !== "block");
  });

  btnQrCode.addEventListener("click", () => {
    if (qrcodeDisplay.style.display === "block") {
      qrcodeDisplay.style.display = "none";
      btnDownloadQr.style.display = 'none';
      if(btnAttachQr) btnAttachQr.style.display = 'none';
    } else {
      generateQrCode(shortUrl.value);
      qrcodeDisplay.style.display = "block";
      btnDownloadQr.style.display = 'inline-block';
      if(btnAttachQr) btnAttachQr.style.display = 'inline-block';
    }
  });

  // Future optimization: To avoid re-generating the QR code, the high-res version could be
  // created once when the main QR button is clicked, stored, and then reused for display,
  // download, and attachment.
  btnDownloadQr.addEventListener("click", () => {
    const v = shortUrl.value.trim();
    if (!v) return;
    const qrContainer = document.createElement('div');
    new QRCode(qrContainer, { text: v, width: 512, height: 512, correctLevel: QRCode.CorrectLevel.H });
    const canvas = qrContainer.querySelector('canvas');
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'kurl-qrcode.png';
      link.click();
    }
  });

  if (btnAttachQr) {
    btnAttachQr.addEventListener("click", async () => {
      const v = shortUrl.value.trim();
      if (!v) return setMsg(browser.i18n.getMessage("popupErrorNothingToAttach"));
      setMsg(browser.i18n.getMessage("popupStatusAttachingQr"));
      try {
        await attachQrCodeToEmail(v);
        setMsg(browser.i18n.getMessage("popupStatusQrAttached"), "ok");
      } catch (e) {
        const errorMessage = browser.i18n.getMessage("popupErrorAttachFailed");
        setMsg(`${errorMessage}: ${e.message}`);
      }
    });
  }

  btnDelete.addEventListener("click", async () => {
    const v = (statsInput.value || shortUrl.value).trim();
    if (!v) return setMsg(browser.i18n.getMessage("popupErrorProvideUrlToDelete"));

    if (!btnDelete.classList.contains('confirm-delete')) {
      btnDelete.textContent = browser.i18n.getMessage("popupBtnConfirmDelete");
      btnDelete.classList.add('confirm-delete');
      setTimeout(() => {
        btnDelete.textContent = browser.i18n.getMessage("popupBtnDelete");
        btnDelete.classList.remove('confirm-delete');
      }, 4000);
      return;
    }

    btnDelete.classList.remove('confirm-delete');
    btnDelete.textContent = browser.i18n.getMessage("popupBtnDelete");
    setMsg(browser.i18n.getMessage("popupStatusDeleting"));
    toggleJson(false);
    btnDetails.style.visibility = 'hidden';

    const r = await browser.runtime.sendMessage({ type: "DELETE_SHORTURL", shortUrl: v });
    if (!r || !r.ok) return setMsg(r?.reason || browser.i18n.getMessage("errorDeleteFailed"));

    setMsg(browser.i18n.getMessage("popupStatusDeleted"), "ok");
    shortUrl.value = "";
    statsInput.value = "";
    updateQrButtonVisibility(); // Use helper to clean up QR UI
    btnDelete.disabled = true;
  });

  openOptionsBtn.addEventListener("click", () => {
    browser.runtime.openOptionsPage();
  });

  const openDashboardLink = $("open-dashboard-link");
  if (openDashboardLink) {
    openDashboardLink.addEventListener("click", (e) => {
      e.preventDefault();
      browser.tabs.create({ url: browser.runtime.getURL("dashboard.html") });
      window.close();
    });
  }

  async function initializePopup() {
    internationalize();
    setMsg(browser.i18n.getMessage("popupStatusReady"));
    btnDetails.style.visibility = 'hidden';

    try {
      const settings = await H.getSettings();
      if (!settings.yourlsUrl || !settings.apiSignature) {
        displaySetupMessage();
        return;
      }
      mainContent.style.display = 'block';

      const storageData = await browser.storage.local.get([
        "yourls_prefill_long",
        "yourls_prefill_short",
        "popup_context"
      ]);

      const popupContext = storageData.popup_context || "default";
      if (popupContext !== 'compose') {
        btnInsert?.remove();
        btnAttachQr?.remove();
      }

      let url = storageData.yourls_prefill_long || storageData.yourls_prefill_short;
      const isShort = !!storageData.yourls_prefill_short;
      if (!url) {
        url = await getSelectedUrlFromActiveTab();
      }

      if (url) {
        const { yourlsUrl } = await H.getSettings();
        const base = H.sanitizeBaseUrl(yourlsUrl);
        const isAlreadyShort = isShort || (base && url.startsWith(base) && url.length > base.length + 1);
        if (isAlreadyShort) {
          shortUrl.value = url;
          statsInput.value = url;
          btnDelete.disabled = false;
          longUrl.disabled = true;
          keyword.disabled = true;
          title.disabled = true;
          btnShorten.disabled = true;
          setMsg(browser.i18n.getMessage("popupInfoAutoStats"), "ok");
          btnStats.click();
        } else {
          longUrl.value = url;
        }
      }

      await browser.storage.local.remove(["yourls_prefill_long", "yourls_prefill_short", "popup_context"]);

      if (popupContext === 'compose') {
        const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true, type: "messageCompose" });
        if (tab) {
          await browser.storage.local.set({ lastActiveComposeTabId: tab.id });
        }
      }
    } catch (e) {
      console.warn('kurl: Popup initialization failed', e);
      setMsg(browser.i18n.getMessage("errorGeneric"));
    }
  }

  document.addEventListener('DOMContentLoaded', initializePopup);

})();
