# kURL 2.0.7 — validation and manual tests

- Scope: dashboard presentation, options full-tab setting, optional helper setup guidance, right-click in-content confirmation with OS-notification fallback. YOURLS API logic, QR library, and editor replacement algorithm unchanged from 2.0.6.
- Automated suite: 28/28 passing in Node.js.
- Packager checks: syntax, archive integrity, required scripts, manifest, locale placeholder semantics and vendored QR library remain verifiable.
- Runtime caveat: the inline confirmation uses `scripting.executeScript` and may be restricted in Thunderbird's mail display surfaces. It falls back to existing `notifications.create`. Test both message display and compose in Thunderbird.
- Runtime caveat: `open_in_tab` means settings will open in a full tab when the add-on is reloaded; previously open inline settings panes may need closing and reopening.
- Helper requirement: the plugin is installed on **YOURLS**, not in Thunderbird. Helper actions need version 1.1.5+.
