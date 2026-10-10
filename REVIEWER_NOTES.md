# Developer notes for eventual ATN submission (not bundled in the XPI)

- This extension sends user-requested original URLs, optional keywords/titles and short-URL metadata to the user-configured HTTPS YOURLS server. Token-derived SHA-256 time-limited signatures are used; the raw token stays local.
- `compose` and `scripting` are needed for explicit URL selection/replacement in the Thunderbird HTML and plain-text message composer; unrelated links and ambiguous selections are rejected.
- `messagesRead` is needed to acquire selected URL text in the message-reading view, not to collect full messages for transmission.
- `storage` keeps configuration and a small seven-day local activity log without email contents, target URLs or API tokens.
- `menus`, `notifications`, `clipboardWrite` are used for user-invoked shortcuts and copy/insert UI.
- `optional_host_permissions` requests HTTPS access only to the user-selected server, not automatically to arbitrary hosts.
- The QR implementation now bundles unchanged qrcode-generator 2.0.4 from its versioned upstream distribution; see VENDOR.md for exact source, commit and checksums. The npm tarball has not been independently byte-compared in this environment. Live Thunderbird integration testing remains outstanding.
