# Updating the EXISTING kURL listing on Thunderbird Add-ons (ATN)

This is an **update to the existing add-on**, not a new listing. The add-on ID must remain `yourls@drissner.me`. Do not create another ATN listing, change the Gecko extension ID, or upload a source ZIP instead of the XPI.

## 1. Confirm the release package

- Obtain **`kurl-thunderbird-2.0.20.xpi`** from the GitHub draft release or the tested local build.
- Confirm `manifest.json` contains `version: 2.0.20`, `strict_min_version: 140.0`, and `browser_specific_settings.gecko.id: yourls@drissner.me`.
- Verify SHA-256 against the accompanying `SHA256SUMS.txt` from the **same build**. The XPI is the compiled distributable; a `.zip` is for source review only.
- Perform live checks in native Thunderbird on Linux and, before broad release, Windows/macOS: setup, right-click copy/insert, HTML/plain-text composing, macOS Control-click, notifications, QR attachment, and irreversible delete on a disposable short link.

## 2. Open the existing Thunderbird add-on in Developer Hub

1. Open https://addons.thunderbird.net/ and sign in using the account that owns the **existing kURL** add-on.
2. Open the **Developer Hub** (for example https://addons.thunderbird.net/en-US/developers/ ) and select **Manage My Add-ons** / **Manage Your Add-ons**. The exact wording may vary by localization.
3. Open the **existing kURL – YOURLS** listing. You can find the public page at https://addons.thunderbird.net/thunderbird/addon/kurl-yourls-shortener/ (the public URL is NOT necessarily the edit URL).
4. In the add-on's **Manage Versions / Upload New Version** section, choose **Upload New Version**. Do **not** select “Submit a New Add-on.”
5. Upload `kurl-thunderbird-2.0.20.xpi` and complete the validator/review screens. The manifest version must be higher than the existing store version.
6. Enter the **English version notes** from `RELEASE_NOTES.md`, preferably also the German ones in their localized field where supported. If the form permits only one, use English as the default.
7. For a source-code or reviewer-notes field, reference the public GitHub repository and provide `REVIEWER_NOTES.md`. If ATN specifically requests an uploaded source archive, supply `kurl-thunderbird-2.0.20-source.zip` and the reproduction command `python3 scripts/build-xpi.py`.
8. Submit the version for review. Because kURL requests `messagesRead`, it may require human review; do not assume it is live immediately.

## 3. Edit the existing add-on's listing and privacy field

The **Privacy Policy** on ATN must contain the complete text of `PRIVACY_POLICY.md`, not merely a URL linking to GitHub. This policy applies specifically to the Thunderbird add-on. Check the contact route and accuracy before submitting.

**Short privacy disclosure for the listing description (English):**

> kURL sends URLs you choose to shorten or manage, and optional keywords/titles, only to your configured HTTPS YOURLS server. Its API signature token and short local activity log remain on your device. It does not send email messages or analytics to the add-on developer. QR codes are generated locally.

**Kurze Datenschutzinformation für die Beschreibung (Deutsch):**

> kURL überträgt ausgewählte Zieladressen sowie optional Kürzel und Titel ausschließlich an den vom Nutzer eingerichteten HTTPS-YOURLS-Server. API-Token und ein begrenztes Aktivitätsprotokoll bleiben lokal in Thunderbird. Das Add-on überträgt keine E-Mails oder Analysedaten an den Entwickler; QR-Codes werden lokal erstellt.

Update the screenshots to show the current dashboard, lookup, Settings status indicator and optional Helper details. State clearly that the Helper is a separately installed YOURLS server plugin, not a WordPress dependency. Do **not** claim all ten languages are fully translated.

## 4. What happens after submission

- The new version may enter manual review. Wait for approval and the version appearing on the existing listing.
- Existing users should receive the normal add-on update through Thunderbird once a newer compatible version is published; they do not need to uninstall/reinstall.
- Verify the public listing displays **2.0.20** and that clicking the install/update button returns the correct add-on.
- Keep the exact `.xpi`, checksum and GitHub commit/tag for repeatable future updates.

## Submission checklist

- [ ] Native Thunderbird Windows and macOS smoke tests completed
- [ ] Privacy policy pasted into dedicated ATN field
- [ ] Short privacy disclosure added to listing
- [ ] 2.0.20 XPI selected for the *existing* add-on
- [ ] Changelog/version notes entered, including German where supported
- [ ] Reviewer/build notes supplied
- [ ] Screenshots/requirements updated
- [ ] Submission completed and subsequent approval confirmed

Note: GitHub publication alone does not modify the Thunderbird Add-ons store. ATN account access is needed for these actions.
