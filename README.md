# kURL for Thunderbird

A Thunderbird Manifest V3 extension for shortening links with a self-hosted [YOURLS](https://yourls.org/) server.

**Status: version 2.0.0 development branch — not yet a verified release.** The code uses Thunderbird's current MailExtension APIs. Minimum declared version remains Thunderbird 128, the first official Thunderbird MV3 release. Test in the current release (157.0.1 as of 9 October 2026) and current ESR before publishing.

## Features

- **Shorten in a click:** Right-click a selected HTTP(S) URL or a link and choose **kURL: Shorten and copy**.
- **Compose:** Right-click a selected link and choose **kURL: Shorten and insert**, or use the compose toolbar popup's **Shorten & Insert** action. Replaces an active compose selection or appends to the message if no editor selection remains.
- **Main window, message view and composer:** Main-toolbar, message-display and compose-toolbar popups all provide an editable manual URL field. Compose popups additionally expose insertion and QR attachment controls.
- **Custom keywords and titles**, with validation.
- **Dashboard:** Server status, YOURLS version, kURL Helper state, instance-wide link/click counts, manual shortener, top links, newest links, filtering of loaded rows, individual stats, copy and guarded deletion.
- **QR codes:** Show, save or (in a compose window) attach as PNG.
- **Optional automatic copying** after shortening via the popup.
- **Ten existing locale bundles.** New dashboard/shortcut strings are available in English and German; the other locales currently use the default English fallback for those additions.

## Setup

1. Install or update your own [YOURLS](https://yourls.org/).
2. In YOURLS Admin → Tools, copy the passwordless API signature.
3. Open kURL Settings in Thunderbird, enter your YOURLS base URL and signature, then click **Test Connection** or **Save**. Grant the host permission for that server.
4. Prefer an HTTPS YOURLS endpoint. HTTP would transmit the API signature without transport encryption; only use it on explicitly trusted development networks.
5. Use the toolbar popup or right-click actions to shorten a URL.

The add-on sends the URL, optional title/keyword and signature **only** to the YOURLS server you configure. Requests use POST, avoid cookies and redirects, and have a 15-second timeout. The token is kept in extension local storage, not a website page or query string.

If you change the server URL, re-enter a signature for the new server; kURL will not silently send the previous server's token to the new endpoint.

## Integration with the WordPress kURL plugin

[WordPress kURL](https://github.com/gerald-drissner/kurl-wordpress) uses the same YOURLS installation. Dashboard statistics and links therefore reflect the whole YOURLS database, not just links made in Thunderbird.

**Remote deletion** requires the optional **kURL Helper 1.1.5** installed on YOURLS. This version check occurs before every deletion. Deleting a remote URL can break links used by WordPress posts or already-sent emails. Unlike the WordPress plugin, the Thunderbird extension cannot inspect WordPress post references. Only delete links you know are not in use.

WordPress-only operations (editor post metadata, post bulk generation, WordPress migration, reconciliation, server-side logs) are not present in Thunderbird because the extension has no access to the WordPress database.

## Build and development

- JavaScript and static syntax: \`npm run check\`
- Unit tests for validation, API responses and destructive-operation gating: \`npm test\`
- GitHub Actions runs these checks on each push and pull request and packages a test \`.xpi\`.
- Manual testing is required before releasing. See [TESTING.md](TESTING.md).

The ZIP/XPI must have \`manifest.json\` at its root along with \`JS/\`, \`_locales/\`, \`images/\` and the three HTML files/CSS. Do not package repository screenshots, test code or a checkout's \`.git/\` directory.

## Privacy, permissions and security

The add-on needs **compose** to insert text/attach a QR image, **scripting**, **tabs** and **messagesRead** to retrieve text selected in mail views, **menus** for context actions, **notifications** for status, **clipboardWrite** for copying, and **storage** for settings. Network access is optional host permission for the configured YOURLS origin.

In the dashboard, received titles and URLs are rendered as text, never assembled into HTML strings. Only HTTP(S) links may be opened. API response sizes are capped at 1 MiB. Server response bodies are not included verbatim in user-facing errors, reducing inadvertent secret disclosure.

## Legacy and distribution

- Source: https://github.com/gerald-drissner/kurl-thunderbird-addon
- Published add-on: https://addons.thunderbird.net/thunderbird/addon/kurl-yourls-shortener/
- License: [MIT](LICENSE)
