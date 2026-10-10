# Standalone kURL Helper for YOURLS

This folder is maintained with the **Thunderbird kURL add-on**. The Helper runs on your YOURLS server, not inside Thunderbird.

1. Get `kurl-helper/plugin.php` from this folder or use **Save plugin.php** in the Thunderbird dashboard.
2. On the YOURLS server create `user/plugins/kurl-helper/`.
3. Copy the file to `user/plugins/kurl-helper/plugin.php`. Preserve the `<?php` header.
4. Open **YOURLS → Manage Plugins** and activate **kURL Helper**.
5. Refresh the Thunderbird dashboard; it will detect the Helper and enable safe lookup, edit, regenerate and remote delete.

Version **1.1.5** maintains the existing YOURLS API (`kurl_ping`, `kurl_find_by_url`, `kurl_regenerate`, `kurl_delete`), so a single installation is usable by both Thunderbird and other kURL clients. **Do not activate duplicate copies:** they register the same API hooks.

Deleting or changing short URLs can break links on websites and in already sent messages. Update YOURLS securely over HTTPS.
