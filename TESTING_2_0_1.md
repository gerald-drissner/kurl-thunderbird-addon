# kURL for Thunderbird 2.0.1 — local test build

This XPI is based on the 2.0.0 development artifact from PR #1 (commit e5a26ee2766cf0a70d80ab98568880e0d74e3fc9) and is a **local 2.0.1 test build**. It does not update the GitHub PR or the WordPress plugin.

## Changes

- Requires HTTPS for YOURLS API host; requests use temporary SHA-256 signatures rather than the long-lived token in HTTP bodies. A legacy HTTP configuration is suggested as HTTPS in Settings, but must be tested and saved by the user.
- Preserves original HTTP(S) long URL text to avoid creating duplicates from normalized URLs.
- Strips trailing punctuation from selected URLs; distinguishes `error:url` from keyword collisions.
- Forwards YOURLS failure messages and gives explicit errors for connection redirects and TLS failures.
- Supports helper versions >= 1.1.5 with all advertised capabilities; caches helper-status checks for 5 minutes.
- On-install menu registration rather than recreating menus at every MV3 background wake.
- Changed shortcut defaults; live shortcut is shown in Settings with a shortcut-manager link when supported.
- Replaces/links selected URL using the compose editor command API; targets one unique editor frame to avoid duplicate insertions. Must be verified in Thunderbird HTML and plain-text modes.
- Warns and switches to New URL creation when dashboard target changes, rather than silently modifying an existing redirect.
- QR PNG attachments/downloads include white margins (quiet zones).
- Bulk batch size now controls parallelism (5, 10 or 25); invalid lines are reported and skipped; one summary operation logged per bulk run.
- Removed `tabs` permission; added disclosure notice, accessible switch label, RTL page direction, contrast tweaks, 16/32px icons.
- Filled in missing locale keys using English fallback; reviewed selected German terminology.
- Included vendor provenance and ATN reviewer notes.

## Important unresolved for ATN submission

- `JS/qrcode.js` is still the unmodified older QR library, pinned to its upstream commit (see VENDOR.md). A published tagged library should replace it before review; this package is **not ATN-ready**.
- Newer English UI strings have not all been professionally translated into the other eight locale bundles; English fallback is used there.
- Only Node-based API mocks and structural validation ran. Live Thunderbird test of editor selection, hyperlink replacement, QR attachment, clipboard from context menu, and keyboard shortcuts remains essential.

## Test checklist

1. Back up/test with an isolated Thunderbird profile; installing with the same extension ID may replace 2.0.0.
2. Settings: enter `https://` YOURLS host and signature; Test, Save, then Dashboard.
3. Shorten a URL exactly as typed (including case and path) and compare with the WordPress plugin's existing YOURLS entry.
4. Try an already-shortened long URL and duplicate keyword; both must report appropriately.
5. Test selection in a draft email, plain text and HTML, and select a hyperlink with existing custom link text. Check Ctrl+Z.
6. Test right-clicking a URL in compose and reader panes, copy, and insert.
7. Create a QR code, save PNG, attach QR to draft, and scan both images.
8. Test manual Check YOURLS / Update / Regenerate with Helper 1.1.5 or newer. Avoid changing links currently used by WordPress posts or sent emails.
9. Bulk paste URLs with a malformed row; preview/start/stop and compare 5/10/25 batches.
10. Verify activities log does not include target URLs, tokens or email contents.
