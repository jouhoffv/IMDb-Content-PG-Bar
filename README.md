# IMDb Content Warning Bar

Firefox extension for IMDb that shows a thin red bar at the top of a movie or TV show page when the title matches selected parental-guide categories.

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
- see whether the current IMDb title triggered the warning bar

## Notes

- The extension relies on IMDb's parental guide page content and wording.
- If IMDb changes the page structure or category wording, matching rules may need adjustment.
