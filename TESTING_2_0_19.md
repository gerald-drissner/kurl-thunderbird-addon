# kURL 2.0.19 — test checklist

1. Start with no YOURLS settings; in the toolbar popup select **Go to Settings** and verify that `options.html` opens directly.
2. Under Arabic, French, Hebrew, Spanish, Japanese, Portuguese, Russian and Chinese UI languages, try deleting a throwaway link via the dashboard search; verify the irreversible-delete warning is localized and contains the URL. Cancel and confirm that nothing is deleted.
3. With the Helper active, start deleting a throwaway link and edit the search query before the server responds; the popular and recent links must refresh after deletion, while a newer lookup is not overwritten.
4. Repeat delete from the popular/recent links; its confirmation should match the language used in the search panel.
5. Verify standard compose, right-click, QR and RTL workflows. Do not perform deletion on shared live URLs for testing.

Local Node and Chromium tests are not a substitute for live Thunderbird checks on Windows and macOS.
