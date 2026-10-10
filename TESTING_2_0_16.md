# kURL 2.0.16 — dashboard search normalization and proxy statistics

1. Connect to an HTTPS YOURLS installation and verify the placeholder uses its own hostname.
2. Search `keyword`, `https://example-short.test/keyword`, `http://example-short.test/keyword`, `https://example-short.test/keyword/`, and the same with `?utm=1`: each should call EXPAND_URL with the canonical HTTPS short URL.
3. Search any non-short path on the same YOURLS host, such as `/admin/tools.php`: show an error and **never** a Create button.
4. Search a destination on another server; use LOOKUP_URL and preserve the ability to create only after an explicit not-found.
5. Behind an HTTPS reverse proxy with `YOURLS_SITE=http://...`, both dashboard clicks and popup statistics should work because `url-stats.shorturl` sends the keyword.
6. In all ten languages the filter hint should quote the actual View More button. Verify Arabic grammar and both directions of lookup.
7. Regression suite, all browser tests, PHP syntax, XPI verification, and cross-platform CI must pass.
