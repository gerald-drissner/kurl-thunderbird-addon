# kURL 2.0.5 verification

This patch updates only version numbers, translations, vendor documentation, README and regression tests. Browser editor and QR code logic is unchanged from 2.0.4.

## Automated checks

- `npm test` runs existing mock network, DOM insertion, QR and translation assertions, plus 2.0.5-specific checks.
- `node --check` verifies JavaScript syntax.
- `tests/browser-compose-check.py` exercises four editor cases in Chromium.
- `tests/browser-qr-check.py` renders and decodes three internationalized QR URLs at 512 px.
- `python scripts/build-xpi.py PATH` verifies the packaged runtime assets.

## Manual Thunderbird checks still required

- Open dashboard and verify that help text describes **Create**, **Edit / Check YOURLS**, **Update existing link**.
- Re-test HTML and plaintext compose insertion, selection in a quoted reply, and right-click on linked URL.
- Verify QR download/attachment scans and shortcut configuration.
- Check English, German and Arabic UI for layout and wording.

The XPI includes neither test notes nor reviewer documents.
