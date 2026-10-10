# kURL 2.0.17 — regression checklist

- `npm test` and `npm run check`
- `python3 tests/browser-lookup-check.py`
- `python3 tests/browser-compose-check.py` and `python3 tests/browser-control-click-check.py`
- `python3 tests/browser-qr-check.py`
- `php -l helper/kurl-helper/plugin.php`
- `python3 scripts/build-xpi.py`

Subfolder regression: connect to `https://example.com/go`, search for `https://example.com/blog/post`; this **must** use the destination lookup. Searching `http://example.com/go/abc/?utm=1` must continue to use short-link lookup. The root-level server `https://example.com` must not treat `/blog/post` as a normal destination. Scheme-less `example.com/blog/post` is intentionally not assumed to be a destination. No server mutation should occur during lookup.

Check Arabic popup keyword terminology and French « Voir plus » spacing. Live Windows and macOS Thunderbird testing remains outstanding.
