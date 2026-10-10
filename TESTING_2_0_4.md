# kURL Thunderbird 2.0.4 testing

- Local tests: `npm test` and `python3 scripts/build-xpi.py /path/to/output.xpi`
- Run every JS through `node --check`, validate all locale JSON, confirm vendor SHA-256 and XPI ZIP integrity.
- Test QR generation, download and attachment with ASCII, accented and non-Latin links; decode actual PNGs and compare against source.
- In Thunderbird 153 ESR and 157: test toolbar, compose HTML/plain text, quote selection, link replacement, context menu, clipboard, QR attachment, RTL labels and keyboard-shortcut configuration.
- External review policy: verify the published npm 2.0.4 dist/qrcode.js file independently before ATN submission.
