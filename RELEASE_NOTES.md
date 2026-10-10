# kURL for Thunderbird 2.0.20

Major update from the published kURL 1.9 series. Existing add-on installations can update in place: the Thunderbird extension ID remains `yourls@drissner.me`.

## Highlights

- **Shorten and insert** links in Thunderbird messages or **shorten and copy** using the toolbar or right-click menu.
- **Full YOURLS dashboard** with total links, clicks, top links, recent links, custom keywords and titles.
- **Search both ways:** enter a short link or keyword to see its destination and click count; enter an original URL to find an existing short link using the optional Helper.
- **Manage links:** copy, edit or regenerate links; delete them only after explicit confirmation and only if the compatible YOURLS Helper is available.
- **Bulk shortening, offline QR generation** and a small, local activity log with pagination and TXT export.
- **First-run setup:** the dashboard guides new users to configure their own HTTPS YOURLS server. The Settings page verifies credentials with a read-only API request and displays a connection indicator.
- **Optional notifications:** brief copy confirmations and native notifications may be turned off without hiding errors.
- **Privacy and security:** the API secret stays in Thunderbird; short-lived SHA-256 signatures are sent over HTTPS. No email content, telemetry or third-party QR service is sent to the developer. Link data is sent only to the YOURLS server chosen by the user.
- **Internationalization:** ten language folders, with fallback to English for strings not yet translated. RTL layout fixes for Arabic and Hebrew.

## Final 2.0.20 polish

The success message after deleting a link from the top/recent lists is translated, and the XPI builder now produces reproducible archives and checksums. There is **no change** to the server-side YOURLS Helper (still version 1.1.7).

## Requirements and upgrade guidance

- Thunderbird **140.0+** (desktop).
- A user-managed **HTTPS YOURLS** instance and API signature token from **YOURLS Admin → Tools**.
- For users upgrading YOURLS to 1.10.5 or later: the API token may have changed. If authentication fails, copy the current token from YOURLS Admin → Tools and choose **Test connection & save** in kURL Settings.
- Optional YOURLS Helper **1.1.6 or later** for advanced lookup/edit/delete. The 1.1.7 source is bundled only as a file the user may copy or download for installation on their own server. PHP is **never run inside Thunderbird**.

## Validation and scope

Automated Node and Chromium tests, QR decoding, PHP syntax checks and GitHub Actions CI cover the code on Linux, Windows and macOS. These do not replace live Thunderbird GUI testing on all systems. Source code and build instructions are provided in the repository. Check the XPI SHA-256 in `SHA256SUMS.txt` before submission.

## Release summary for Thunderbird Add-ons (English)

**What's new in 2.0.20:** Major 2.0 update: full YOURLS dashboard; two-way short-link search; safe create, copy, edit, regenerate and delete workflows; Thunderbird compose/context-menu integration; bulk shortening; QR codes; optional confirmations; connection checks and clearer errors. HTTPS and time-limited signatures protect API access. Fixed multilingual deletion feedback and improved cross-platform/RTL behavior. Requires Thunderbird 140+ and your own YOURLS server. Advanced editing/deletion needs the optional YOURLS Helper installed on that server.

## Versionshinweise für Thunderbird Add-ons (Deutsch)

**Neu in 2.0.20:** Umfangreiche Überarbeitung von kURL mit eigenem YOURLS-Dashboard, Suche nach Kurz-URL oder Zieladresse, Linkverwaltung mit Löschbestätigung, Kontextmenü und Einfügen in E-Mails, Stapelverarbeitung sowie lokal erzeugten QR-Codes. Die Verbindung wird über HTTPS und zeitlich begrenzte API-Signaturen abgesichert. Dazu kommen optionale Erfolgsmeldungen, verständliche Verbindungsfehler und Korrekturen bei Übersetzungen und RTL-Darstellung. Erfordert Thunderbird ab Version 140 und einen eigenen YOURLS-Server. Für erweiterte Verwaltungsfunktionen ist der optionale YOURLS Helper auf dem Server nötig.
