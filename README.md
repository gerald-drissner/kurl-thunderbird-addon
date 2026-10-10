# kURL for Thunderbird 2.0.12 (test build)

This MailExtension shortens and manages links on a user-controlled HTTPS YOURLS server, with an integrated Thunderbird compose workflow. The optional YOURLS Helper is bundled here, separately from other kURL projects.

## Installation

In Thunderbird (140 or later): **Add-ons and Themes > gear icon > Install Add-on From File** and select `kurl-thunderbird-2.0.12-test.xpi`. The extension ID is `yourls@drissner.me`: **the build may replace an earlier kURL add-on**, so use a separate Thunderbird profile first.

Configure your HTTPS YOURLS server and signature token under kURL settings. Assign keyboard shortcuts via **Manage Extension Shortcuts**; this build installs without default key bindings.

## Corrections retained from 2.0.3

- Compose editor insertion uses **raw DOM Text.data slice and Range offsets** rather than whitespace-normalized `Selection.toString()` to locate a URL within selected quoted HTML.
- The popup retains the exact source URL and short URL pair from the successful shortening request, and refuses to insert a stale result when the source field changes.
- Creating a URL in the dashboard clears the one-time custom keyword, avoiding collisions on the next Create. The explicit **Edit** and **Update existing link** flow continues to prefill the proper keyword.
- Arabic UI uses minimal distinguishing vowel marks; action verbs, shortcut instructions and terminology are consistent, including *جارٍ*, *عدّل*, *نزّل* and *إحصاءات*.
- German fixes **„in das Verfassenfenster“** and consistently uses *Tastenkürzel*, *Kürzel* (slug) and *Kurz-URL*.

## Verification and outstanding review work

Run `npm test` (Node.js 22+) for offline regression tests. Chromium integration checks are in `tests/browser-compose-check.py` and `tests/browser-qr-check.py` (Playwright, OpenCV).

The 2015 untagged QR library has been replaced by **qrcode-generator 2.0.4**, sourced from its release-versioned upstream distribution. Its source file and SHA-256 are declared in `VENDOR.md`; the app-side canvas renderer is independently maintained. In a browser engine, generated PNGs have been QR-decoded successfully for ASCII, accented and Arabic short URLs; non-ASCII URL paths use their browser-equivalent percent-encoded representation in the QR code. An external independent reviewer has since confirmed a byte-for-byte match with the published npm 2.0.4 tarball.

**Not yet fully release-tested:** Live Thunderbird compose, right-click, clipboard and QR attachment tests are outstanding. Seven non-English locale bundles still rely on English fallback for many new strings, and some runtime messages remain hard-coded English. Documentation of permissions for eventual ATN review is in `REVIEWER_NOTES.md` (not packaged).
The `.xpi` is a zip archive containing only runtime files and vendor declaration; the separate source `.zip` contains tests, reproducible packing script and documentation.

## kURL 2.0.4

- Updated Arabic and German interface wording.
- Replaced the 2015 untagged QR library with qrcode-generator 2.0.4; our code renders the module matrix onto a white PNG canvas with 4-module quiet zone.
- Still requires live Thunderbird testing before release.

## kURL 2.0.6

- Corrected the translated dashboard help text so it accurately explains Create → Edit/Check YOURLS → Update and is not replaced at load by outdated translations.
- Corrected Arabic UI descriptions of the active compose window, API signature token, and kURL shortcut.
- Harmonized German shortening terminology, loading/empty states and the local-log privacy wording.
- Standardized remaining English kURL capitalization.
- Updated `VENDOR.md` with the exact npm CDN reference and independent byte-comparison report; QR source bytes are unchanged.
- No changes to network, compose editor, QR renderer or data handling. Live Thunderbird tests still required.

## 2.0.6

This is a localized-copy-only follow-up to 2.0.5. It updates the shortcut guidance, adds the Arabic dashboard instructions, standardizes several German labels, removes a redundant reviewer attribution from the third-party library declaration, and leaves JS behavior and the QR library unchanged. Live Thunderbird 153 ESR / 157 testing is still required before submission.

## Thunderbird 2.0.8 usability update

The extension settings open in a full Thunderbird tab (`options_ui.open_in_tab = true`), rather than the narrow Add-ons Manager inline preferences panel. From there open **Dashboard**, **Bulk**, or **Logs**. The dashboard uses a wide, two-column layout on large screens and collapses into one column on small screens; server details are tucked into an expandable section.

The optional kURL Helper is now maintained independently in the **Thunderbird repository** under `helper/kurl-helper/plugin.php`. It is also bundled in the XPI, and the dashboard offers **Show full PHP source**, **Copy PHP source**, and **Save plugin.php**. It must be installed in `user/plugins/kurl-helper/plugin.php` on the **YOURLS server** and activated in **Manage Plugins**, not installed in Thunderbird. For remote edit, lookup and delete, this build requires Helper **1.1.6 or newer**. Older versions must be updated; there is still only one server-side Helper installation. **Note:** current WordPress kURL versions that compare the Helper version exactly with 1.1.5 may mark 1.1.6 as outdated until their version check is updated. This is a separate WordPress compatibility issue, not a second Helper to install. The dashboard's Helper status remains visible, with instructions available even when the Helper is installed.

Right-click shortening uses desktop notifications and a temporary badge on the active Thunderbird tab. It never injects confirmation HTML into the compose editor, because that could become part of a sent message or draft. System notification display depends on operating-system settings.

### Manual test checklist

1. Open Add-ons → kURL → Settings: verify a full Thunderbird tab, then navigate to the Dashboard. Confirm the wide layout and the collapsible connection details.
2. With the helper absent, confirm that the onboarding card appears, but ordinary shorten/copy/statistics still work.
3. Right-click a URL in the compose editor → Shorten and copy. Confirm the clipboard contents and Thunderbird notification or badge; repeat from a read-only message.
4. Install the helper on YOURLS, refresh the dashboard, then verify helper state changes to Ready and helper-only controls are enabled.
5. Repeat HTML/plain-text insertion, QR attachment, and reading historical URLs. No live Thunderbird tests are represented by the automated Node regression suite.

## New in 2.0.8

Right-click menus register on installation/update and browser startup; context shortening attempts a native confirmation and a temporary toolbar badge. The dashboard displays a persistent Helper status, rank numbers for popular links and highlighted click counts. The redundant list Stats button is removed. The local log supports pagination, clipboard copying and `.txt` export. **Test connection & save** is now the primary setup action; credentials are committed only after the live YOURLS check succeeds, while **Save without testing** remains available explicitly.

The YOURLS server-side kURL Helper must be installed separately. A malformed plugin name in YOURLS cannot be repaired from Thunderbird; use the clean `helper/kurl-helper/plugin.php` from this repository and ensure the top PHP comment contains `Plugin Name: kURL Helper`.


## 2.0.9: standalone YOURLS Helper

- Standalone Helper lives in `helper/kurl-helper/plugin.php` in the Thunderbird repository and is packaged as a static, unexecuted file inside the XPI.
- Dashboard installer works offline: copy complete PHP file, save as `plugin.php`, or show the source inside an expandable, scrollable block.
- Source link points to an immutable commit in the Thunderbird repository; the WordPress plugin repository is no longer needed for Thunderbird setup.
- Updated EN/DE labels and warnings use neutral client names; unchanged YOURLS API.
- Verify installation in YOURLS by refreshing the dashboard. Downloading a PHP file does not install it on the server automatically.

## 2.0.12: Optional copy confirmations and platform review

- Dashboard row copy and manual short-URL copy show a brief, unobtrusive toast after the clipboard operation succeeds.
- **Show success notifications** is available in Dashboard and Settings, **on by default**; changing the switch saves immediately to `browser.storage.local`, without sending or changing the YOURLS token. Both pages remain synchronized.
- When turned off, successful right-click copy/insert suppresses desktop notifications, desktop notifications and toolbar badges. **Failures remain visible.** Clipboard operations are unaffected.
- The extension uses Thunderbird WebExtension APIs and has no Windows/macOS/Linux-specific binary dependencies. CI runs Node.js regression tests, JavaScript syntax checks, and XPI packing on Linux, Windows, and macOS hosted runners. This is **not a substitute for running Thunderbird itself on all three operating systems**.
- The compatibility checklist, including system notification and clipboard permissions, is in `PLATFORM_TESTING.md`.

## Recovering API access after a YOURLS upgrade

A signed **read-only `db-stats` API call** is used to verify the credentials
when you select **Test connection & save**. The add-on does not need or accept
your YOURLS admin username and password; these are entered only into YOURLS in
a normal browser. If YOURLS responds with `Please log in` or an authentication
error code, kURL displays localized recovery steps and an **Admin → Tools** link.

YOURLS 1.10.5 changed the secret API signature. After an upgrade, copy the
current signature from the YOURLS admin Tools page and paste it into kURL.
Signature checks use time-limited SHA-256 tokens over HTTPS and the add-on never
stores an invalid replacement following a failed connection test. Errors from
reverse proxies or clock skew may also require server-side fixes. A 401/403
is not proof the secret alone is wrong. A public YOURLS server should use the
included **Helper 1.1.6** for authenticated remote editing/deletion.

## 2.0.12: installer fixes and release preparation

- Fixed all ten HTTP status-code locale placeholders and added translated API-test button labels to the remaining languages.
- Context-menu success/error feedback and dashboard click counters now use localized messages.
- Right-click Control-click on macOS matches the clicked link by target URL, regardless of caret location. Ambiguous duplicate links are refused rather than editing the wrong one.
- Toolbar badges have independent timers per tab and never appear in the outgoing email body.
- Persistent context menus are registered on install/update and startup, not each background wake.
- The Helper source link is pinned to the immutable 1.1.6-containing revision (not falsely labeled a tag).
- GitHub Actions updated to current runtimes; local and CI regression tests cover these cases.

**Not yet a published ATN release.** A real macOS Control-click test and a Windows/macOS Thunderbird check are needed. The WordPress client currently uses strict Helper version matching; update it before installing Helper 1.1.6 unless API is publicly accessible.
