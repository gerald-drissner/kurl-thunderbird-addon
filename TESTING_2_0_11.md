# kURL 2.0.11 verification

- Regression tests exercise recognized authentication failures, HTTP 401/403, malformed error payloads, and ordinary non-auth errors.
- All ten locale bundles provide human-readable recovery and the direct YOURLS Tools link.
- The SHA-256 time-limited signature is still used for read-only connection checks; token not sent in cleartext.
- The original Helper has been updated to 1.1.6 with separate authentication checks for public YOURLS API setups.
- Notification toasts are never written to the Thunderbird compose editor.
- Native Thunderbird, Windows/macOS integration, and live YOURLS server interaction require further manual testing.
