# Habitly

A minimalist habit tracker that runs entirely in your browser or as a Windows desktop app. No account, no server, no tracking. Your data stays on your device.

Built with HTML, Tailwind CSS (CDN) and vanilla JavaScript.

## Features

- **Habit management:** add, edit and delete habits with a name, category, target days (daily or specific weekdays) and a color accent.
- **Today's progress:** an animated bar and percentage showing how many of today's scheduled habits are done.
- **Per-habit progress:** week or month completion bar for every habit.
- **Streaks:** current streak for each habit. Days a habit isn't scheduled never break a streak.
- **Weekly grid:** Monday to Sunday checkmarks for each habit. Click a past day to fix a missed check-in.
- **Filters:** by category, and by status (All, Active, Completed today).
- **Dark and light mode:** follows your system by default, and your choice is remembered.
- **Backup and restore:** export or import all habits and history as JSON.
- **Sample data:** a few starter habits appear on first launch so the dashboard isn't empty.
- **Installable and offline-ready:** works as a PWA and can be packaged as a Windows `.exe`.
- **Responsive:** works on phones, tablets and desktops.

## Project structure

```
habitly/
├── index.html              Page markup
├── css/styles.css          Custom styles (Tailwind utilities come from the CDN)
├── js/
│   ├── app.js              App logic: state, storage, rendering, events, import/export
│   ├── theme-init.js       Applies the saved theme before first paint
│   ├── tailwind-config.js  Tailwind CDN config (class-based dark mode)
│   └── pwa.js              Registers the service worker
├── sw.js                   Service worker (offline support)
├── manifest.webmanifest    Install-as-app metadata
├── icons/                  App icons (192px and 512px)
├── main.js                 Electron entry point (desktop build)
└── package.json            Electron and electron-builder configuration
```

## Run it locally

No build step or install is needed for the web version.

**With VS Code:**

1. Open the project folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**.

**Or with Node.js:**

```bash
npx serve .
```

Then open the URL it prints, usually `http://localhost:3000`.

Opening `index.html` directly also works, but installing as an app and offline mode need `http://localhost` or `https://`.

> The first load needs an internet connection because Tailwind loads from a CDN. After one online visit, the service worker caches it for offline use.

## Install as an app (PWA)

Serve the project over `localhost` or `https://`, then:

- **Chrome or Edge (desktop):** open the browser menu, then **Install Habitly** (or **Apps**, then **Install this site as an app**).
- **Android (Chrome):** menu, then **Add to Home screen**.
- **iPhone or iPad (Safari):** Share, then **Add to Home Screen**.

## Build the Windows app (.exe)

The desktop build uses [Electron](https://www.electronjs.org/) and [electron-builder](https://www.electron.build/).

**Requirements:** Windows and Node.js LTS (v22 recommended).

1. Make the app work offline by downloading Tailwind locally:

   ```powershell
   Invoke-WebRequest "https://cdn.tailwindcss.com/3.4.17" -OutFile js\tailwind.js
   ```

   Then change the Tailwind `<script>` tag in `index.html` to `<script src="js/tailwind.js"></script>`.

2. Install and test:

   ```powershell
   npm install
   npm start
   ```

3. Build the installer:

   ```powershell
   npm run build
   ```

The installer is created at `dist\Habitly Setup 1.0.0.exe`. A runnable copy without installing is in `dist\win-unpacked\Habitly.exe`.

### Troubleshooting

| Problem | Fix |
| --- | --- |
| `Electron failed to install correctly` | Use Node LTS, delete `node_modules`, and run `npm install` again. |
| npm blocks Electron's install script | Run `npm approve-scripts electron`, then `npm rebuild electron`. |
| `Cannot create symbolic link` during build | Run PowerShell as Administrator, or turn on Windows Developer Mode, then clear `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign` and rebuild. |
| "Windows protected your PC" when installing | The app isn't code-signed. Click **More info**, then **Run anyway**. |

## Your data

Everything is stored in the browser's `localStorage` (or the app's own storage in the desktop version). Data is separate for each browser, each address and the desktop app, so use **Backup** to move it between them.

**Backup format:**

```json
{
  "app": "habitly",
  "version": 1,
  "exportedAt": "2026-10-10T00:00:00.000Z",
  "preferences": { "theme": "dark" },
  "habits": [
    {
      "id": "h1",
      "name": "Read 20 pages",
      "category": "Learning",
      "days": [0, 1, 2, 3, 4, 5, 6],
      "color": "#6366f1",
      "created": "2026-09-10"
    }
  ],
  "log": {
    "h1": { "2026-10-09": true, "2026-10-10": true }
  }
}
```

- `days` uses `0` for Monday through `6` for Sunday.
- `log` maps each habit id to the dates it was completed.
- Importing replaces your current data after a confirmation prompt.

To reset the web version, clear the `habitly.v1` key under DevTools, then Application, then Local Storage, and refresh. The sample habits come back.

## How the numbers work

- **Today's progress:** completed habits divided by habits scheduled today.
- **Streak:** consecutive scheduled days completed, counting back from today. If today is scheduled but not yet done, the streak holds until the day ends.
- **Week and month progress:** completed scheduled days divided by all scheduled days in the period. Days before a habit was created don't count against it.

## Contributing

Issues and pull requests are welcome. For larger changes, open an issue first to discuss what you'd like to change.

## License

Add a license file of your choice (for example MIT) before sharing the project publicly.