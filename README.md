# IMDb Content PG Bar

Firefox extension for IMDb that shows a thin, color-coded bar at the top of a movie or TV show page based on selected Parents Guide categories.

## What it does

- Works on IMDb title pages for movies and TV shows.
- Lets you choose which categories matter:
  - nudity
  - violence
  - profanity
  - alcohol
  - frightening scenes
- Includes a popup for quick checking and configuration on the current IMDb page.
- Fetches the title's IMDb Parents Guide page and reads IMDb's own rating levels for the five categories.
- Shows a thin top bar whose color follows the highest selected rating:
  - green for `None` or `Mild`
  - yellow for `Moderate`
  - red for `Severe`
- Adds a matching outer glow around the native IMDb logo area while the PG bar is visible.

## Install in Firefox

1. Open Firefox.
2. Go to `about:debugging`.
3. Click `This Firefox`.
4. Click `Load Temporary Add-on...`.
5. Select the `manifest.json` file from this folder.

## Configure

1. Open the extension's preferences/options page.
2. Enable or disable the feature.
3. Select the content categories that should trigger the red bar.
4. Save settings.

You can also click the extension button in Firefox to:

- quickly enable or disable the feature
- change categories
- see whether the current IMDb title triggered the PG bar

## Notes

- The extension relies on IMDb's parental guide page content and wording.
- If IMDb changes the page structure or category wording, matching rules may need adjustment.

## Submission Notes

- Runtime code is plain HTML, CSS, and JavaScript. There is no bundler, transpiler, or minification step.
- The extension stores user settings and a small local cache of parsed title ratings in `browser.storage.local`.
- The extension fetches the current title's IMDb Parents Guide page from `imdb.com` to evaluate the selected categories.
- The extension adds a color-matched outer glow around the native IMDb logo area when the PG bar is visible.
- The extension does not send analytics, telemetry, or third-party tracking data.
- For AMO packaging, only the runtime files listed in `package.ps1` should be included.

## Build And Packaging

- No build step is required.
- To create a submission ZIP from the repo root, run:

```powershell
.\package.ps1
```

- The output ZIP is written to `dist/` with `manifest.json` at the archive root.
