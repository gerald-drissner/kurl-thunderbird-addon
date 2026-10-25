# Developer notes for eventual ATN submission (not bundled in the XPI)

- This extension sends user-requested original URLs, optional keywords/titles and short-URL metadata to the user-configured HTTPS YOURLS server. Token-derived SHA-256 time-limited signatures are used; the raw token stays local.
- `compose` and `scripting` are needed for explicit URL selection/replacement in the Thunderbird HTML and plain-text message composer; unrelated links and ambiguous selections are rejected.
- `messagesRead` has been removed in 2.0.22: no `messages` or `messageDisplay` API is used. The previous permission justification was incorrect. Reading-view right-click copy uses `linkUrl`/`selectionText` from the menu event. Popup script injection into received messages would need `messagesModify`, which is not requested; users can paste a URL or use the right-click menu. Compose selection/insertion is covered by `compose` and `scripting`.
- `storage` keeps configuration and a small seven-day local activity log without email contents, target URLs or API tokens.
- `menus`, `notifications`, `clipboardWrite` are used for user-invoked shortcuts and copy/insert UI.
- `optional_host_permissions` requests HTTPS access only to the user-selected server, not automatically to arbitrary hosts.
- The QR implementation now bundles unchanged qrcode-generator 2.0.4 from its versioned upstream distribution; see VENDOR.md for exact npm CDN file and checksum. The vendored QR distribution is byte-identical to the npm release of qrcode-generator 2.0.4. VENDOR.md supplies the SHA-256 checksum and pinned upstream source for independent verification.

- The XPI intentionally includes `helper/kurl-helper/plugin.php`: an optional PHP plugin for the user's separately administered YOURLS server. Thunderbird does **not** execute PHP. The dashboard only reads that bundled file as text to show/copy/download for users who want advanced link management. It never installs or runs server code. Current minimum supported Helper version: 1.1.6.
- CI verifies source, archive, and browser-simulated behavior on Linux/macOS/Windows. The project test reports distinguish these from native Thunderbird GUI testing; no claim of live macOS or Windows validation is made.

## 2.0.21 reviewer note

This update changes dashboard presentation only: the version label is loaded with `browser.runtime.getManifest().version`; two static external anchors link to `https://drissner.media/kontakt` and `https://www.paypal.com/paypalme/drissner`. Both are user-clicked, open with `rel="noopener noreferrer"`, and do not read or transmit mailbox, YOURLS, or credential data. No new permissions. The Helper PHP source is unchanged and is not executed by Thunderbird.


## 2.0.22 reviewer note

Addresses John Bieling's review of 2.0.21 dated 2026-10-21:

1. `runtime.onMessage` is a plain listener. It returns `handleMessage(message)` only for known dispatch types and otherwise returns `undefined`. The asynchronous handler preserves structured errors and local logging.
2. The unused `messagesRead` permission is removed. No mailbox permission was added.
3. `VENDOR.md` has one file declaration and one pinned jsDelivr npm URL for `qrcode-generator@2.0.4/dist/qrcode.js`. The bundled source is unchanged and its SHA-256 matches the downloaded file.

See `TESTING_2_0_22.md` for reproducible validation results and native-test limits.
