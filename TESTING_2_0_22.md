# kURL for Thunderbird 2.0.22 — validation

Validated on 2026-10-25. Based on the 2.0.21 branch at
`fc8625710f98b00fd2471179c1e9e3b85f4851fa`.

## Results

- `npm test`: 75 checks passed (74 smoke tests plus the footer test file).
- `npm run check`: all bundled JavaScript files passed Node syntax checking.
- `git diff --check`: passed.
- Four new regression tests cover unhandled/malformed messages returning
  `undefined` synchronously, all dispatch types returning Promises, structured
  error responses/logging, and received-message menu copying without script
  injection or mailbox APIs.
- `tests/footer.cjs` is now included in `npm test` and therefore in existing CI.
- `python3 scripts/build-xpi.py ../kurl-thunderbird-2.0.22.xpi`: 32 files,
  116850 bytes. A second build compared byte-for-byte equal.
- XPI SHA-256:
  `7e2e9e27e72a686d64d003540a73b1733614ff4706a00ae8a2a4e2a318c40494`.
- qrcode-generator 2.0.4 was downloaded from the exact jsDelivr URL declared in
  `VENDOR.md`. Its SHA-256 matches `JS/qrcode.js`:
  `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c`.
- `JS/qrcode.js` and the optional YOURLS Helper are unchanged from 2.0.21.

## Thunderbird linter

Used the official `thunderbird/webext-linter`, version 2.5.1, commit
`7802ee765fc3c86fb5baec5833a47092f6ef8d00`:

```sh
node verify.js ../kurl-thunderbird-2.0.22.xpi --report-format json
```

Exit status 0. The report marks the XPI reviewed against release MV3 schema
158.0.2, with 0 errors, 0 holds, 0 warnings, 0 informational findings and an empty
findings array. The run included `async-onmessage`, `unused-permission`,
`vendor-unparseable`, `vendor-modified` and `vendor-vulnerable`.
Automated findings do not replace ATN's manual review or native testing.

## Known limits

- No native Thunderbird GUI session was available. Before ATN submission, test
  right-click Shorten and copy for a link and a selected URL in a received
  message, HTML/plain-text compose insertion, popup shortening and QR attachment.
- Popup automatic selection lookup in a received message was not enabled by
  `messagesRead`. It attempts script injection, which needs `messagesModify` in
  that context. No such permission was added: paste a URL or use the menu there.
- The older `tests/extension.test.cjs` is outside `npm test` and CI. It has 3
  passes and 9 failures both on untouched 2.0.21 and on this update. Its existing
  failures were reproduced and are not presented as passing tests.
- PHP is unavailable locally, so no local PHP syntax result is claimed. The
  unchanged Helper is covered by the existing Linux GitHub Actions PHP check.
- GitHub upload does not submit or publish a version on Thunderbird Add-ons.
