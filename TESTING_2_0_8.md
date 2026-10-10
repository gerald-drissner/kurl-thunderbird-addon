# kURL 2.0.8 — local test plan

## User-facing changes

- Context menu entries are reconciled as the background event page starts and again on installation/startup events. Any persisted, hidden 2.0.7 Insert item is explicitly removed and replaced with a visible menu. The copy item appears on selected text and links; Shorten & Insert appears in Thunderbird's compose-body context. Menu visibility no longer depends on an asynchronous onShown handler.
- Each right-click result attempts a native Thunderbird/OS notification independently of an in-message toast and shows a short badge on available extension toolbar buttons. Notifications may still be suppressed by OS Do Not Disturb settings; no window is forcibly opened.
- Dashboard always shows Helper plugin state (`INSTALLED / OK`, `NOT FOUND`, or `UPDATE REQUIRED`) with version when known; installation instructions remain visible while missing.
- Most-clicked links have numbered 1–10 rank badges. Counts are colored, readable click badges. Redundant Stats buttons are removed from the top/recent lists; other statistics displays remain available.
- Log displays up to 15 entries per page, has next/previous controls, and copies or exports all currently stored entries to UTF-8 tab-separated plain text. The existing seven-day / 100-entry storage cap is unchanged, and logs contain no URLs or credentials.
- The primary options action tests the currently entered URL and API signature, requests the single-server permission, and saves them **only if** the YOURLS connection test succeeds. A secondary explicit *Save without testing* action remains for offline changes.
- The malformed `P *lugin Name` listing in YOURLS is an issue with the installed PHP plugin metadata. It cannot be changed through the Thunderbird add-on. Reinstall a clean `plugin.php` from the WordPress kURL repository if necessary.

## What automation verifies

- `npm test` (34 automated tests) including right-click copy handler, clipboard, notification creation, duplicate-menu avoidance, dashboard UI and setup workflow.
- `python tests/browser-compose-check.py` (four real Chromium editor tests).
- `python tests/browser-qr-check.py` (three QR codes decoded to exact canonical URL).
- JavaScript syntax, JSON schema constraints of packaged manifest, ZIP integrity and required assets via `scripts/build-xpi.py`.

## Required live Thunderbird tests

1. After installing 2.0.8, restart Thunderbird once. Right-click a URL in a received email, choose **kURL: Shorten and copy**. Verify URL in clipboard, a native notification (unless system notifications suppressed), and toolbar badge when supported.
2. In an HTML compose window, right-click a link, check **kURL: Shorten and insert**, then test again in a plain-text compose window and with a quoted reply. Ensure unrelated links are never modified.
3. In Settings, enter a **wrong** key and press **Test connection & save**: credentials must not be saved. Enter the real key and press again: verify successful save, including after closing and reopening settings.
4. Dashboard: verify Helper is shown as **INSTALLED / OK (1.1.5)** when `kurl_ping` is available and activated, and that the two list columns show green click pills and 1–10 ranking numbers for top links.
5. Protokoll: create more than 15 operations, page back and forward, copy full log, export `.txt`, and verify no URLs or tokens appear in the export.

No live Thunderbird engine was available while preparing this build. A successful Node test/Chromium run is not a Thunderbird compatibility certification.
