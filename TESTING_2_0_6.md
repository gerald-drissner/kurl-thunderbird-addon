# kURL 2.0.6 test notes

This release changes version metadata, locale messages, and VENDOR.md only; runtime JavaScript and bundled QR library are identical to 2.0.5.

Validation checklist:
- Automated Node smoke tests and JavaScript syntax checks
- Chromium HTML compose test and QR decoding test (when test environment supports these)
- XPI structure, localization and SHA-256 checks
- Real Thunderbird 153 ESR and 157 editor, clipboard, menus, QR attachment, keyboard shortcuts: **not run here**

The seven incompletely translated locales and remaining hard-coded English strings are not addressed in this release.
