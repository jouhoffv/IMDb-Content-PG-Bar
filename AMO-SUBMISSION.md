# AMO Submission Checklist

- Confirm `manifest.json` version matches the release tag.
- Run `.\package.ps1` from the repo root.
- Upload the ZIP from `dist/` to AMO.
- Use the repo source as the source package only if AMO asks for one. No separate build output exists.
- In the AMO listing, disclose that the extension:
  - runs on IMDb title pages
  - fetches the current title's IMDb Parents Guide page
  - shows a color-coded warning bar

# Manual Test Notes

- Fresh install on Firefox 140 or later.
- Open an IMDb title page in English and one localized IMDb title page.
- Verify the popup loads current settings and page state.
- Verify the options page saves settings.
- Verify the top bar color changes based on selected Parents Guide categories.
- Verify non-title IMDb pages do not show the bar.

# Data / Privacy Notes

- Uses `browser.storage.local` for settings and a local rating cache.
- Fetches the current title's IMDb Parents Guide page from `imdb.com`.
- Does not include analytics, telemetry, ads, or third-party tracking.
