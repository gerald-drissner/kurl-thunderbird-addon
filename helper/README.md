# kURL Helper — optional plugin for YOURLS

This folder contains the **standalone kURL Helper for YOURLS**, maintained alongside the kURL Thunderbird add-on. It does **not** run inside Thunderbird. You only need it for advanced actions such as finding existing short URLs by destination, editing links, safely regenerating keywords, and deleting links remotely.

## Installation

1. Download [plugin.php](./kurl-helper/plugin.php), or open the helper section in the Thunderbird kURL dashboard and use **Copy PHP code** / **Save plugin.php**.
2. In your YOURLS installation, create `user/plugins/kurl-helper/`.
3. Save the file as **`user/plugins/kurl-helper/plugin.php`** — do not call it `plugin.php.txt`. Keep the opening `<?php` and the plugin header intact.
4. In your YOURLS **Manage Plugins** page, activate **kURL Helper**.
5. Refresh the Thunderbird kURL dashboard. It will show the detected helper version and enable the additional actions.

**Compatibility:** kURL Helper 1.1.5 has the same action names and response fields as the 1.1.5 helper originally bundled with the WordPress kURL plugin. You do **not** need two helper installations. A single copy in YOURLS works with both clients. Never activate duplicate copies of the same API actions.

**Privacy and security:** kURL Helper is a YOURLS plugin, not a Thunderbird extension and not a third-party service. It handles requests authenticated by YOURLS. Keep the YOURLS installation updated and accessible over HTTPS. Remote deletion and keyword changes may invalidate links already shared in email or on websites.

The helper header and description are client-neutral, but its API functions are preserved for compatibility. The code is licensed GPL-2.0-or-later (see its source header).
