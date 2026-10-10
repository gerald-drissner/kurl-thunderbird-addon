# kURL for Thunderbird 2.0.20 — release-candidate verification

Date: 2026-10-10.

## Package / static checks

- Manifest MV3 version 2.0.20; Gecko ID `yourls@drissner.me` (unchanged); minimum Thunderbird 140.0.
- Runtime package contains only the 32 required files; the optional YOURLS Helper PHP file is shipped as static text and never executed by Thunderbird.
- Vendored `JS/qrcode.js` SHA-256: `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c`, unmodified qrcode-generator 2.0.4.
- `npm run check`, `npm test`, `php -l helper/kurl-helper/plugin.php`, `php tests/helper-address-check.php`.
- Browser tests: `python3 tests/browser-*.py` (execute every script independently); tests require local Chromium and Python test dependencies.
- Build twice with `python3 scripts/build-xpi.py` and compare hashes to verify reproducible archive metadata within the build environment.
- ATN validator: the external reviewer reported 0 errors and 5 known Thunderbird-irrelevant warnings for **2.0.19**. The 2.0.20 XPI must be validated separately by ATN; that result must not be falsely claimed as already obtained.

## Regression targets

- Delete from top/recent list: requires Helper; translated confirmation and translated success status; no deletion after Cancel.
- Delete from search result while another search starts: server mutation succeeds once and lists refresh without discarding the newer search query.
- Popup first run leads directly to connection/token Settings; unconfigured dashboard makes no API requests.
- Connection check is an authenticated read-only request; token is saved only after success, traffic HTTPS only.
- Two-way lookup, reverse proxies, same-host alternate short links and subfolder installations.
- HTML/plain-text compose actions, especially Control-click with caret elsewhere and ambiguous duplicate links.
- RTL slider geometry, badges per tab, QR code, clipboard and notification preference.

## Native Thunderbird checks still to distinguish from automation

- Linux: user previously confirmed working Thunderbird build for the same general features.
- Windows: open Dashboard, right-click links, copy and insert into HTML/plain-text mail, use QR attachment, verify notifications and Settings.
- macOS: repeat Windows checks **including Control-click** on a link with the caret in another paragraph and when several links share a destination.
- Use a **disposable** YOURLS short link when testing deletion (irreversible). Never use production links for destructive tests.

## Release and store process

- GitHub release should start as a draft, with packaged XPI, source ZIP and SHA256SUMS attached.
- A GitHub draft does not update the Thunderbird Add-ons listing. Follow `ATN_SUBMISSION.md` to upload the higher version to the **existing** kURL listing.
- Full `PRIVACY_POLICY.md` must be pasted into ATN's dedicated privacy-policy field; adding a link to GitHub alone is insufficient.
