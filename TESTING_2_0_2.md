# kURL Thunderbird 2.0.2 test checklist

1. Install the XPI via Thunderbird Add-ons and Themes; confirm no manifest errors.
2. Configure HTTPS YOURLS, validate and save; test both a valid and invalid API token.
3. In Add-on Manager, configure a permitted shortcut; confirm the options display it, and check a shortcut with none assigned.
4. Select an ordinary URL with trailing period, parentheses and brackets: `https://example.org/wiki/Berlin_(Begriffsklärung)` and `https://example.org/?q=[1]`.
5. In a rich-text compose window, shorten and replace `<a href="https://example.org/">https://example.org/</a>`; visible text and href should both become the short URL. Custom text `Read here` should remain unchanged.
6. Place the cursor inside an **unrelated** hyperlink; try to insert another shortened URL. It must refuse, leaving the old link intact.
7. Select an entire sentence containing one URL. Only the URL should be replaced; surrounding text must remain and Undo should restore the original.
8. Check the same operations in plain-text compose mode; confirm no accidental rich-text markup.
9. In dashboard: Create a link; select `Edit` for an existing entry, change its target and click **Update existing link**. Confirm only that entry is updated. Test a separate Create with the old selection present.
10. In Bulk, insert 25 URLs and one invalid line; no concurrent create requests should occur, invalid line should be reported without stopping valid rows. Test stop after current request and copy results.
11. Disable/uninstall kURL Helper; confirm gated operations unavailable; restore it and refresh the dashboard (no five-minute negative cache).
12. Test QR image scanning after export/attachment, copy from context menu, RTL Arabic/Hebrew interface, dark-theme error contrast and all locale fallbacks.

Only Node mock tests and file-level validation run automatically here. Real Thunderbird integration remains required. The XPI is not yet a reviewed ATN release.
