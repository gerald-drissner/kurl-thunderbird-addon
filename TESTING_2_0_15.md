# kURL 2.0.15 — dashboard two-way lookup

## Changes

- Added a clear, separate **Find an existing link** card above manual creation.
- Input recognizes (a) a short link on the configured YOURLS domain (with or without the `https://` prefix), (b) a keyword on its own, or (c) a full destination URL.
- Short URL / keyword: uses the standard YOURLS `expand` action for its destination/title, plus `url-stats` for click counts. The Helper is **not** needed for this direction.
- Full destination URL: queries `kurl_find_by_url` from the optional Helper; then obtains click stats. If none exists, the user can prefill the Create card without silently modifying an existing link. This is a server-wide lookup, not a recent-list filter. When the Helper is missing, explain the requirement rather than disabling all lookup.
- Search results use read-only DOM text; actions support copying a found short URL and populating Edit where appropriate. If stats are unavailable, the resolved destination remains visible with an unavailable clicks indicator.
- When Helper is available, the large onboarding card collapses into a quiet **Helper installed (version) · Installation and source** row. Installation guidance remains accessible. When absent or outdated, the visible installer opens automatically, and helper-only features are disabled.
- Renamed the recent-list filter and added an explicit scope note: it searches **only displayed recent links**; Load more to include older links.
- Added 20 new or clarified strings in each of the 10 bundled language files, without claiming the rest of the UI is fully localized.

## Automated verification

- `npm test`: 58/58 Node regression tests.
- `python3 tests/browser-lookup-check.py`: real Chromium workflow verifying the healthy Helper is unobtrusive; short URL -> target/title/clicks, copied clipboard and Edit; destination -> existing link; missing destination -> prefilled Create; recent-link filter remains client-side.
- Existing browser tests for Helper preview, copying and saving PHP; dashboard copy confirmations; compose editor; macOS Control-click; QR scan; RTL switches; API auth recovery; legacy token behavior.
- JS syntax, `php -l` for bundled Helper, XPI archive integrity and version checks.

## QA still needed

- In live Thunderbird, verify the new search with a known short URL, a keyword, a known long URL and a nonexistent long URL. Compare click counts with YOURLS directly; do not confuse a *local list filter* with *server-wide lookup*.
- Repeat on a YOURLS server without the optional Helper: short lookup should work, destination lookup should explain the missing dependency.
- Real Thunderbird GUI tests on Windows and macOS remain needed for public distribution.
