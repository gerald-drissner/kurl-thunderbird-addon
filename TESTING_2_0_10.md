# kURL 2.0.10 — validation and compatibility

- `npm run check`: JavaScript syntax passed.
- `npm test`: 39/39 mock-regression tests passed, including right-click feedback opt-out with clipboard preserved, failure feedback with the preference off, and preference persistence.
- `python tests/browser-copy-feedback-check.py`: 5 browser checks passed: dashboard row copy, preference opt-out, auto-dismiss/re-enable, manual result copy, and Settings preference persistence without API-token writes.
- `python tests/browser-compose-check.py`: 4/4 Chromium editor tests passed.
- `python tests/browser-qr-check.py`: 3/3 QR images decoded.
- `python tests/browser-helper-check.py`: Helper status, source preview, clipboard, and downloaded source matched the included file.
- `php -l helper/kurl-helper/plugin.php`: no syntax errors.
- `python scripts/build-xpi.py`: XPI archive / manifest / resource integrity passed.
- GitHub Actions validates Node code and builds on Ubuntu, Windows and macOS runners. This demonstrates build/test portability but **does not mean Thunderbird was opened on all three platforms**.

Live Thunderbird platform checks are listed in `PLATFORM_TESTING.md`. The user has tested 2.0.9 on Linux; 2.0.10 should be tested on Linux and ideally Windows/macOS before publication. OS notification settings can suppress system toasts independently of this extension preference.
- The first Windows matrix run exposed checkout CRLF conversion of `JS/qrcode.js` and `helper/kurl-helper/plugin.php`. `.gitattributes` now explicitly preserves LF line endings for vendored and source files; the original content checksum assertion remains enforced.