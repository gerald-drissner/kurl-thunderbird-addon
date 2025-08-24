# kurl - YOURLS Shortener for Thunderbird

[![Version](https://img.shields.io/badge/version-1.1-blue.svg)](https://github.com/gerald-drissner/kurl-thunderbird-addon/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A Thunderbird add-on to shorten URLs with your self-hosted YOURLS instance and insert them directly into the email compose window.

![Screenshot of the kurl popup](images/kurl-icon-96.png)
*(Suggestion: Replace the icon above with a full screenshot of your add-on in action!)*

## Features

* **Quickly shorten links:** Create short URLs directly from the Thunderbird compose window.
* **Custom Keywords:** Assign optional custom keywords to your short links for easy memorization.
* **View Stats:** Check the click count and target URL for any existing short link.
* **Delete Links:** Manage your links by deleting short URLs directly from the add-on.
* **Auto-Copy:** Automatically copy the newly created short URL to your clipboard.
* **Multiple Workflows:** Use the toolbar button, right-click context menu, or a keyboard shortcut.
* **Multi-language Support:** Available in English, German, French, Spanish, and many more languages.

## Installation

1.  Go to the [**Releases Page**](https://github.com/gerald-drissner/kurl-thunderbird-addon/releases).
2.  Download the `.zip` file from the latest release (e.g., `kurl-thunderbird-addon-v1.1.zip`).
3.  In Thunderbird, go to `Tools > Add-ons and Themes`.
4.  Click the gear icon (⚙️) and select "Install Add-on From File...".
5.  Select the downloaded `.zip` file.

## Usage

Before first use, you must configure the add-on by going to `Add-ons and Themes`, finding "kurl", and opening its preferences. You will need to enter your YOURLS instance URL and your API signature token.

There are three ways to use the shortener:

1.  **Toolbar Button:** Click the "kurl" icon in the compose window's toolbar to open the popup.
2.  **Context Menu:** Select a long URL in the editor, right-click, and choose "kurl: Shorten selection…".
3.  **Keyboard Shortcut:** Select a URL and press the keyboard shortcut to open the popup with the URL pre-filled.
    * The default shortcut is **`Ctrl+Shift+K`**.
    * You can change this shortcut in Thunderbird by going to `Tools > Add-ons and Themes`, clicking the gear icon (⚙️) next to "kurl", and selecting "Manage Extension Shortcuts".

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
