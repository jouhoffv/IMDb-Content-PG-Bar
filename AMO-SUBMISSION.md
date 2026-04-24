# AMO Submission Checklist

- Confirm `manifest.json` version matches the release tag.
- Run `.\package.ps1` from the repo root.
- Upload the ZIP from `dist/` to AMO.
- Use the repo source as the source package only if AMO asks for one. No separate build output exists.
- In the AMO listing, disclose that the extension:
  - runs on IMDb title pages
  - fetches the current title's IMDb Parents Guide page
  - shows a color-coded PG bar
  - adds a matching outer glow around the native IMDb logo area while the bar is visible

# Manual Test Notes

- Fresh install on Firefox 140 or later.
- Open an IMDb title page in English and one localized IMDb title page.
- Verify the popup loads current settings and page state.
- Verify the options page saves settings.
- Verify the top bar color changes based on selected Parents Guide categories.
- Verify the native IMDb logo stays unchanged and only the outer glow appears around its container.
- Verify non-title IMDb pages do not show the bar.

# Data / Privacy Notes

- Uses `browser.storage.local` for settings and a local rating cache.
- Fetches the current title's IMDb Parents Guide page from `imdb.com`.
- Applies an on-page visual glow effect around the existing IMDb logo area while the PG bar is shown.
- Does not include analytics, telemetry, ads, or third-party tracking.
