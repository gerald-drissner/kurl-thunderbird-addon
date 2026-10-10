# Thunderbird kURL 2.0.10 — platform compatibility review

The extension ID remains `yourls@drissner.me` and `strict_min_version` remains Thunderbird 140.0. This is a Thunderbird WebExtension (JavaScript / HTML / CSS / PHP helper as static source), not a native application. **There are no native add-on executables, external OS commands, or platform-specific paths.** The PHP helper is installed on the YOURLS server and is not executed on the client OS.

| Environment | Code/API review | Node/packaging CI | Real Thunderbird smoke test |
|---|---|---|---|
| Linux | No platform-specific dependencies | GitHub Actions Ubuntu runner | Reported working by user (2.0.9; test 2.0.10) |
| Windows (Thunderbird 140+) | Uses portable MailExtension APIs | GitHub Actions Windows runner | Not yet performed |
| macOS (Thunderbird 140+) | Uses portable MailExtension APIs | GitHub Actions macOS runner | Not yet performed |

Thunderbird itself must support the host operating system. Thunderbird 157 system requirements include Windows 10+, macOS 10.15+, and contemporary 64-bit GNU/Linux; these restrictions belong to Thunderbird, not to the kURL extension.

## OS-specific items to verify in live Thunderbird

1. **Clipboard:** copy from dashboard, compose popup, selected-link right-click and `Copy & Close`. Inspect resulting URL, not just notification. Clipboard APIs require appropriate permissions/user activation; right-click uses a fallback if direct clipboard access is unavailable.
2. **System notifications:** on Linux check desktop notification daemon (KDE/GNOME); on Windows check Windows notification permissions / Do Not Disturb; on macOS check Notification Center permissions / Focus modes. Confirm success notifications appear only when the setting is on. OS policies may suppress them independently.
3. **Inline confirmation:** copy in dashboard and check toast appears for ~2.8 seconds; disable the switch on Dashboard, copy again (still copied, no toast), then enable it in Settings and verify Dashboard syncs.
4. **Errors:** deliberately try shortening an invalid selection; user must still receive failure feedback when success notifications are disabled.
5. **Email composition:** insert in HTML and plain text; right-click on an existing link; quoted replies; two compose windows; QR code creation and attachment.
6. **Keyboard shortcuts:** Thunderbird → Add-ons and Themes → Manage Extension Shortcuts; macOS users may use the Command key instead of Ctrl. No default combination is assigned to avoid conflicts.
7. **Downloads:** save the YOURLS Helper `plugin.php` from Dashboard, then confirm the filename and content. OS download dialogs / download folder selection can differ.
8. **Connection:** test HTTPS YOURLS connection and add-on restart/persistence; no OS-specific network utility should be required.

Automated tests exercise logic with mocks and Chromium; they do not certify the native Thunderbird shell or Windows/macOS notification systems. A published listing should say **cross-platform by design, Windows/macOS live verification pending** until an actual smoke test is recorded.
