# Changelog — kURL for Thunderbird

The add-on's browser extension ID remains `yourls@drissner.me`. Version 2.0.20 is the next update to the existing Thunderbird add-on, not a different product.

## [2.0.20] — 2026-10-10

- Localize the success message after a short link is deleted from the top/recent lists (the same translation was already used after deleting from search results).
- Normalize XPI archive timestamps and permissions so repeat builds with the same compressor and source create matching packages.
- Add consolidated release notes, a privacy-policy draft, source-build documentation, and ATN update instructions.
- No changes to the YOURLS API protocol or bundled Helper 1.1.7.

## [2.0.19] — 2026-10-10

- Translate irreversible-delete confirmations in all ten shipped locale bundles and include the affected short URL.
- Open the connection/token settings directly from the first-run popup.
- Refresh link lists after a successful delete even if the user types another search while the delete request is pending.

## [2.0.18] — 2026-10-10

- Open the dashboard first. On new installations, explain how to configure the server without making unauthorized API requests.
- Add a verified connection-status indicator to Settings: connected, unchecked, permission missing, or failed.
- Allow deletion from a lookup result only with an active compatible Helper and explicit confirmation.

## [2.0.15–2.0.17] — 2026-10-10

- Add server-backed lookup by short URL/keyword or by original destination, including target, title, clicks, and relevant actions.
- Present an installed Helper as a compact row, expanding installation guidance when it is missing or outdated.
- Distinguish filtering *already loaded* recent links from a full server lookup.
- Recognize equivalent short URLs (`http`/`https`, trailing slash, query and fragment) while preventing inadvertent shortening of own-server paths.
- Fetch statistics by keyword to work behind HTTP-to-HTTPS reverse proxies.
- Correct lookup of same-host destinations outside a YOURLS subfolder installation.
- Improve Arabic and French wording in the new interface.

## [2.0.7–2.0.14] — 2026-10-10

- Move the full dashboard into a dedicated Thunderbird tab, with overview statistics, top and recent links, ranking and click counts.
- Add explicit Create, lookup, Edit, Regenerate, Copy, and Delete workflows with confirmation for destructive actions.
- Make success confirmations optional; retain errors when confirmations are disabled.
- Restore reliable context-menu registration and notifications without injecting status boxes into outgoing mail.
- Prevent wrong-position insertion when macOS Control-click leaves the caret unchanged; refuse ambiguous selections.
- Add local activity log with paging, copy and text export; avoid storing email text, URLs or API tokens in log entries.
- Add offline QR generation and clipboard actions; keep the QR library locally vendored.
- Add a bundled *optional* standalone YOURLS Helper, now 1.1.7, with safe installation instructions and source-copy/download functionality.
- Harden Helper actions with explicit authentication and protect deletion/regeneration on public YOURLS servers.
- Handle YOURLS 1.10.5+ token changes with actionable, localized connection errors and a verified Test & Save workflow.
- Correct RTL switches, click-count layout, localization placeholders and context-menu labels.

## [2.0.0–2.0.6] — 2026-10-10

- Modernize the Thunderbird kURL extension for Thunderbird 140+ (Manifest V3).
- Introduce user-selected HTTPS host permissions and time-limited SHA-256 API signatures; the raw YOURLS token remains local.
- Add context-menu shortening, message-compose insertion, one-by-one bulk shortening, dashboard link management and cross-platform regression tests.
- Harden URL parsing, duplicate keyword handling, response sizes/timeouts and source-selection safety.

## Earlier versions

Version 1.9 was the previous published line. It provided the original YOURLS shortening integration; the 2.0 series is a substantial update. Earlier historical release notes remain in the repository's git history where available.

## Compatibility notes

- Thunderbird 140 or newer on desktop; extension ID unchanged.
- Requires an HTTPS YOURLS server and its API signature token. New signatures may be needed after upgrading YOURLS.
- Bundled YOURLS Helper is **optional** and installed on the YOURLS server, not in Thunderbird. Helper 1.1.6+ is supported for advanced operations. Only one Helper installation is needed per server.
- The add-on includes ten locale folders, but some older strings still fall back to English. Do not claim full translation coverage.
- Automated checks run on Linux, macOS and Windows. Native Thunderbird GUI testing on Windows and macOS must be distinguished from automated tests.
