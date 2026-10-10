# Thunderbird 2.0.3 manual acceptance checklist

1. Install from `.xpi` on a separate Thunderbird 153 ESR / 157 profile; verify installation and manifest validity.
2. Open HTML compose; shorten and insert a selected URL. Confirm the link's **text AND href** both show the short URL; undo and check layout.
3. Select a quoted-reply paragraph with newlines/indentation in its HTML source and one URL. Only the URL should become a short hyperlink, without malformed URL fragments or missing adjacent words. The HTML editor may normalize whitespace; check visual formatting.
4. With the caret inside a different link, Insert must refuse the replacement. With a matching link containing custom text ("our article"), preserve that custom text.
5. Shorten URL A in the popup; edit the long-URL field to URL B and click Insert. It must refuse instead of pointing URL A's short link at an unrelated cursor link. Shorten URL B and verify insertion then works.
6. In the dashboard, create URL A with a custom keyword. Without pressing New link, change the URL field to B and click Create again. It must use a new server-assigned slug, not reuse A's custom keyword.
7. Use Edit on an existing dashboard row; change the target and explicitly click Update. Verify the original short URL is updated through the helper and is unchanged if the operation fails.
8. Check Arabic locale: no mixed tashkīl, consistent shortened-link terminology, *احذف* and matching Test Connection label/status, correct RTL row order.
9. Check German locale: "in das Verfassenfenster", consistent labels and shortcut wording.
10. Test bulk imports, QR generation/download/attachment, permissions, errors, and shortcuts on the actual Thunderbird profile.

Automated checks: Node mock/regression suite and Playwright/Chromium compose-editor test. **These do not replace live Thunderbird UI testing.**
