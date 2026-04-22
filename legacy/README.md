# BookmarkThat (Firefox)

BookmarkThat is a Firefox extension with three core features:

1. **Quick-save links** to a selected bookmark folder via `Ctrl + Alt + click`.
2. **Per-container tab lifecycle automation** (unload timer, never-unload, periodic reload, cache/cookie cleanup).
3. **Scheduled page visit rules** that open configured URLs on interval timers (stored in extension settings, independent of browser history).

It also tracks basic site engagement timestamps and can automatically remove old site data (cookies, cache, local storage, indexedDB, service workers) for sites not engaged within 30 or 90 days.

## Load the extension

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `manifest.json`.
4. Open the add-on **Preferences** page to configure rules.
