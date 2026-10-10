# Habitly

A client-side habit tracker. No build step, no server code, no dependencies to install.

## Structure

    index.html              Page markup
    css/styles.css          Custom styles (Tailwind utilities come from the CDN)
    js/theme-init.js        Applies saved theme before first paint
    js/tailwind-config.js   Tailwind CDN config (class-based dark mode)
    js/app.js               All app logic: state, storage, rendering, events, import/export
    js/pwa.js               Registers the service worker
    sw.js                   Service worker (offline support)
    manifest.webmanifest    Install-as-app metadata
    icons/                  App icons

## Run

Open the folder in VS Code, install the "Live Server" extension, right-click
index.html and choose "Open with Live Server". Or run `npx serve .` in the folder.

Opening index.html directly also works, but install-as-app and offline mode need
http://localhost or https://.

## Notes

- The first load needs internet (Tailwind loads from a CDN). After one online visit
  the service worker caches it for offline use.
- Data lives in the browser's localStorage, per browser and per address. Use the
  Backup button to export or import JSON.
