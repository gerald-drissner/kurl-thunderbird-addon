# kURL 2.0.18 manual QA

- Open the add-on settings with an empty Thunderbird profile: the Dashboard is first, shows setup guidance and makes no API requests.
- Follow the setup link; verify the Settings status light is neutral without credentials.
- Enter a test URL and token, test and save; green status indicates a successful API response.
- Enter an incorrect token on a private YOURLS install and test: red status plus the recovery hint; the prior saved token remains intact.
- With a saved configuration, opening Settings triggers a read-only probe and displays green on success or red on failure. Typing into URL or token changes the light to neutral (unverified). Saving without a test must not turn it green.
- Search for an existing short link. If Helper >= 1.1.6 is detected, Delete is shown with a confirmation dialog. Cancel does not call DELETE_SHORTURL. Confirm deletes then refreshes lists and clears the stale search result.
- Without a Helper or when no link is found, the search-result Delete button is hidden.
- Repeat on Thunderbird Windows, macOS and Linux.
