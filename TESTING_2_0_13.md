# kURL 2.0.13 — fixes following external review

- RTL settings switches: checked knob moves toward the inline end for LTR and RTL. Measured the actual switch/knob geometry in Chromium for English, Arabic and Hebrew, on and off (six positions). This is a browser rendering check, not a Thunderbird desktop test.
- Link click-count margins now use logical CSS margins in both general actions and dashboard lists.
- Context badge timers are scoped to tabs; removed the background listener for every tab-close event. Badge reset `.catch()` handles an invalid/closed tab without an unhandled rejection.
- Injected compose insertion returns stable error codes for duplicate clicked links, missing clicked links, and plain-text selections; background converts them to translated messages. All ten bundled locales contain these new messages.
- Helper `kurl_api_shorturl_belongs_to_installation` accepts external HTTPS when the same YOURLS host/path is internally configured as HTTP on standard ports, while disallowing HTTP downgrades or mismatched hosts/paths/custom ports. Ten isolated PHP checks passed. No destructive remote API tests were run on a production server.
- Bundled PHP header check tolerates CRLF line endings without changing the downloaded file.
- Existing ten-character API signature tokens prompt an advisory to copy a current token from YOURLS Admin → Tools; validation is not based on token length alone, and an invalid token is never saved by the connection-test workflow.
- QR code source is unchanged from version 2.0.12.
- 52/52 Node tests, browser editor/Control-click/QR/dashboard/Helper/auth tests and `php -l` pass locally.

## Release gates still open

- Live Thunderbird Windows/macOS QA, especially macOS Control-click and RTL settings.
- Mozilla's add-on validator on this new XPI and completion of ATN privacy-policy fields.
- Older locale gaps remain; English remains the documented fallback.
- WordPress kURL's Helper compatibility check needs updating before upgrading the server to Helper 1.1.6 in a private deployment.
