# kURL 2.0.0 — release acceptance checklist

Run this in a **separate Thunderbird test profile**, against a dedicated YOURLS installation or with test-only URLs. Test current monthly Thunderbird (157.0.1 on 2026-10-09), current 153 ESR, and ideally Thunderbird 140 ESR. A clean test profile is necessary to catch retained permissions or old storage state.

## Installation and settings

- [ ] Add-on installs and enables without console errors.
- [ ] Settings loads; unsaved URL/token works with **Test Connection**.
- [ ] Invalid URL, pasted query string, and embedded userinfo are rejected.
- [ ] Change YOURLS hostname and path; old token is cleared and not transmitted.
- [ ] Deny optional host permission: test and create show a useful error.
- [ ] Revoke permission and repeat; grant it again and retest.
- [ ] Turn server offline, configure a slow server (>15s), HTML 404, JSON failure, and redirect: errors do not freeze the UI or reveal credentials.
- [ ] HTTPS server works; HTTP usage is only for trusted development.
- [ ] Verify automatic copy can be disabled.

## Shortening workflows

- [ ] Compose toolbar button opens correctly even though it has a declarative popup.
- [ ] Main three-pane toolbar button and message-display popup open correctly.
- [ ] Select a plain URL within the composer: popup pre-fills the field when selection is still available.
- [ ] Right-click selected URL in composer: **Shorten and copy**, **Shorten and insert**.
- [ ] Right-click an HTML link in compose, main three-pane and standalone message views.
- [ ] Clipboard has the exact short link, no other text.
- [ ] Compose insertion replaces selected text if active, otherwise inserts without damaging surrounding HTML formatting or a signature.
- [ ] Two compose windows: actions operate on the *correct* window and don't interfere.
- [ ] Plain-text and HTML composition both behave correctly.
- [ ] Custom keywords preserve case and reject spaces, slashes and control characters.
- [ ] Existing long URL correctly reuses existing short URL on both HTTP 200 and HTTP 400 response conventions.
- [ ] Unavailable network while shortening results in an actionable error.
- [ ] Command shortcuts work, and do not conflict with Thunderbird's own Quick Filter shortcut (particularly Ctrl+Shift+K).

## Dashboard and WordPress parity

- [ ] Total links, clicks and average reflect YOURLS db-stats.
- [ ] Version and kURL Helper status are accurate.
- [ ] Recent and top links load, and Refresh reloads them.
- [ ] Load More advances the result set without duplicates on the server.
- [ ] Filter searches currently loaded recent rows only.
- [ ] Malicious values (<script> tags, quotes, javascript: URLs) appear as inert text or are rejected.
- [ ] Manual form creates a link and copy works.
- [ ] The WordPress plugin and Thunderbird show the same instance-wide counts.
- [ ] Without kURL Helper, deletion is unavailable; with outdated helper, it is blocked; with Helper 1.1.5, a deliberately unused test link can be deleted after confirmation.
- [ ] Confirm that a WordPress-referenced link must never be deleted casually from Thunderbird.

## QR and media

- [ ] Show QR renders for a valid short link.
- [ ] Save QR yields a readable PNG and a working scanned URL.
- [ ] Attach QR attaches a valid PNG in the originating compose window.
- [ ] QR controls are absent or disabled outside composing.

## Release hygiene

- [ ] All JavaScript syntax checks and automated tests pass.
- [ ] All ten locales parse; new strings have fallback.
- [ ] Visual check on light/dark themes at normal and high DPI.
- [ ] Check layout at default zoom and with larger Thunderbird font preferences.
- [ ] Package includes no test fixtures, confidential tokens, development assets or stale release files.
- [ ] Validate with Thunderbird's Add-on Manager and Developer Toolbox; inspect browser console.
- [ ] Check add-on review requirements before submission to Thunderbird Add-ons.
