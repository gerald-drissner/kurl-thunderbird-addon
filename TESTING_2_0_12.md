# kURL 2.0.12 QA

- 10 locale placeholders declared with `status: $1` and passed as a Thunderbird i18n substitution.
- macOS Control-click: the insert action is given `fromLink`, selects a uniquely matching anchor by URL, refuses ambiguous duplicates and never silently changes unrelated text.
- Tab-scoped badge timers prevent interleaved notifications from clearing or leaving badges stuck.
- No injection of toast elements into the composer.
- `onInstalled` and `onStartup` register menus; background resumes do not rebuild them.
- Verify HTML composer, plain-text composer, right-click on macOS, clipboard and notification settings in actual Thunderbird on Windows/macOS/Linux before publishing.
- Verify Helper 1.1.6 authentication on a private YOURLS instance and a separately isolated, publicly exposed test instance. Never test destructive calls on production URLs.
- Static i18n checks confirm ten `apiInvalidResponse` placeholders, localized right-click confirmation strings and count labels, and the translated connection-test button.
- GitHub CI checks the build under Linux, Windows and macOS runners; this does not simulate macOS's native Control-click or Thunderbird's compose engine.
- The repository includes a **draft** `PRIVACY_POLICY.md` for the mandatory ATN fields; it is excluded from the XPI.
