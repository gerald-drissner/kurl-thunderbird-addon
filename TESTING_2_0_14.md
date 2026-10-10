# kURL 2.0.14 — QA and release notes

- The bundled YOURLS Helper is **1.1.7** (distinct PHP changes from secure 1.1.6). The Thunderbird add-on still accepts any Helper **>= 1.1.6** advertising the required capabilities. This does not silently upgrade a server installation.
- The Helper README describes default HTTPS 443 ↔ HTTP 80 proxy mappings and equal explicitly configured custom ports, with no HTTPS downgrade.
- The ten-character API-token warning appears only after a failed authentication test, never on opening Settings; valid older YOURLS installations are not warned needlessly. The add-on never stores a newly rejected token.
- All ten locale files supply right-click menu text and a generic safe insertion error; Arabic plain-text instructions match the actual context-menu label.
- The dashboard's GitHub Helper source link is pinned to the immutable 1.1.7 source commit.

## Checks

- 55/55 Node regression tests; JS syntax and helper PHP syntax valid.
- 12/12 isolated PHP reverse-proxy address checks, including matching custom ports and refused downgrade.
- Chromium: 4/4 composer and 4/4 macOS Control-click cases, 6/6 RTL toggle positions, dashboard copy and helper source preview/copy/download, legacy-token flow, API auth recovery, QR decoding.
- XPI archive contains 32 runtime files, including the bundled Helper; integrity verified.
- GitHub Actions Linux / Windows / macOS green on the development branch. These are code/package checks, **not** a live Thunderbird test.

## Before public ATN release

- Complete actual Thunderbird smoke tests on Windows and macOS.
- Enter reviewed privacy policy text in ATN's listing field.
- Update WordPress kURL's strict Helper version comparison before installing Helper 1.1.7 on a shared private YOURLS server.
- Do not merge the draft PR until approved.