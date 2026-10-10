# Standalone kURL Helper for YOURLS

This folder is maintained with the **Thunderbird kURL add-on**. The Helper runs on your YOURLS server, not inside Thunderbird.

1. Get `kurl-helper/plugin.php` from this folder or use **Save plugin.php** in the Thunderbird dashboard.
2. On the YOURLS server create `user/plugins/kurl-helper/`.
3. Copy the file to `user/plugins/kurl-helper/plugin.php`. Preserve the `<?php` header.
4. Open **YOURLS → Manage Plugins** and activate **kURL Helper**.
5. Refresh the Thunderbird dashboard; it will detect the Helper and enable safe lookup, edit, regenerate and remote delete.

Version **1.1.7** maintains the existing YOURLS API (`kurl_ping`, `kurl_find_by_url`, `kurl_regenerate`, `kurl_delete`), so a single installation is usable by both Thunderbird and other kURL clients. **Do not activate duplicate copies:** they register the same API hooks.

Deleting or changing short URLs can break links on websites and in already sent messages. Update YOURLS securely over HTTPS.

**Security for public YOURLS installs:** Versions through 1.1.5 of this Helper
could allow unauthenticated link changes if the YOURLS API was configured as
public. **Install at least 1.1.6 before using remote edit/delete actions.** Versions 1.1.6 and 1.1.7
checks API authentication itself for lookup, edit/regeneration and deletion;
no Thunderbird login form is added. After replacing `plugin.php`, refresh the
Thunderbird dashboard and verify the version shown is 1.1.6 or newer. The bundled version is **1.1.7**; 1.1.6 remains compatible. An HTTPS reverse-proxy URL is accepted when the YOURLS installation is configured internally as HTTP, the host and path match, and ports are either the usual defaults (443/80) or explicitly equal custom ports. HTTP downgrades are never permitted.
