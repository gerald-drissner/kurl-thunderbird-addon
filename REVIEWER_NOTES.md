# Developer notes for eventual ATN submission (not bundled in the XPI)

- This extension sends user-requested original URLs, optional keywords/titles and short-URL metadata to the user-configured HTTPS YOURLS server. Token-derived SHA-256 time-limited signatures are used; the raw token stays local.
- `compose` and `scripting` are needed for explicit URL selection/replacement in the Thunderbird HTML and plain-text message composer; unrelated links and ambiguous selections are rejected.
- `messagesRead` is needed to acquire selected URL text in the message-reading view, not to collect full messages for transmission.
- `storage` keeps configuration and a small seven-day local activity log without email contents, target URLs or API tokens.
- `menus`, `notifications`, `clipboardWrite` are used for user-invoked shortcuts and copy/insert UI.
- `optional_host_permissions` requests HTTPS access only to the user-selected server, not automatically to arbitrary hosts.
- The QR implementation now bundles unchanged qrcode-generator 2.0.4 from its versioned upstream distribution; see VENDOR.md for exact source, commit and checksums. The vendored QR distribution is byte-identical to the npm release of qrcode-generator 2.0.4. VENDOR.md supplies the SHA-256 checksum and pinned upstream source for independent verification.

- The XPI intentionally includes `helper/kurl-helper/plugin.php`: an optional PHP plugin for the user's separately administered YOURLS server. Thunderbird does **not** execute PHP. The dashboard only reads that bundled file as text to show/copy/download for users who want advanced link management. It never installs or runs server code. Current minimum supported Helper version: 1.1.6.
- Live QA for Windows/macOS composition, including macOS Control-click link replacement, is required prior to ATN submission; GitHub Actions across operating systems do not simulate native Thunderbird.
