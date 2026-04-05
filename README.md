# LocatorLens

**Real-time Element Inspector & Locator Builder for Appium (Android & iOS)**

Inspect mobile app elements, generate locators, and see a live screen mirror — all from your browser. Works with **any app on any device**, no code changes or app modifications required.

---

## LocatorLens vs Appium Inspector

The [Appium Inspector](https://github.com/appium/appium-inspector) is the official desktop tool. LocatorLens is a browser extension that takes a fundamentally different approach.

| Feature | LocatorLens | Appium Inspector |
|---------|------------|-----------------|
| **Distribution** | Chrome Extension — no install, auto-updates | Desktop app (Electron) — manual download & updates |
| **Startup** | One click — servers start automatically | Manual: start Appium, configure capabilities, create session |
| **Session setup** | Zero configuration — inspects whatever is on screen | Requires capabilities JSON per app (package, activity, bundleId…) |
| **Live screen mirror** | Yes — continuous streaming up to 30 FPS | Static snapshot — manual refresh |
| **Auto-refresh on change** | Yes — detects screen changes, auto-refreshes XML | No — click Refresh manually |
| **Multi-strategy output** | All 7+ strategies generated simultaneously with uniqueness badges | One strategy at a time, no uniqueness check |
| **Uniqueness validation** | Green/orange badge shows how many elements match each locator | Not available |
| **Click to inspect** | Click directly on the live screen mirror | Click on the screenshot (static) |
| **Hover to highlight** | Hover over element tree → highlights on screen overlay | Limited |
| **Interact mode** | Tap elements on device from within the browser | Separate action panel |
| **Appium methods preview** | Shows `getText()`, `getAttribute()`, `getRect()`, `isEnabled()` live | Attribute panel only |
| **App switching** | Inspect any app without reconfiguring | Must create a new session for each app |
| **Log viewer** | Built-in full-page log viewer with filtering | Separate terminal window |
| **Theme** | Dark / light mode | Fixed |
| **Platform** | Browser — works on any OS Chrome runs on | macOS, Windows, Linux (separate installers) |

**When to use Appium Inspector:** Deep session configuration, remote Appium grids, advanced capability tweaking.

**When to use LocatorLens:** Day-to-day locator building, exploratory testing, fast iteration.

---

## Why LocatorLens?

Writing Appium tests is slow when you have to guess element locators, run the test, see it fail, and repeat. LocatorLens eliminates that loop entirely.

**Connect once. Inspect anything. Copy and go.**

| Without LocatorLens | With LocatorLens |
|---------------------|-----------------|
| Write test → run → fail → inspect logs → guess locator → repeat | Click element → copy locator → done |
| Need to know app internals or read source XML manually | Visual, point-and-click inspection |
| One locator strategy at a time | All strategies generated simultaneously |
| Risk of non-unique locators breaking tests | Match count shows uniqueness instantly |
| Restart session to inspect a different app | Switch apps freely — no reconfiguration |

---

## Works With Any App — No Configuration Needed

LocatorLens connects to your **running Appium session** and inspects whatever is currently on screen. You don't need to:

- Specify a bundle ID or package name
- Modify the app or add test hooks
- Configure anything per-app

Just connect to your device and start inspecting — switch between apps freely during the same session. Open Settings, open a game, open a banking app — LocatorLens sees it all.

---

## Features

**Inspector**
- **Works with any app** — inspect any foreground app without reconfiguration
- **Live Screen Mirror** — see your device screen in real time at up to 30 FPS
- **Click to Inspect** — click anywhere on the mirrored screen to select that element
- **Hover to Highlight** — hover over elements in the tree to highlight them on screen
- **Visual Element Tree** — full XML hierarchy browser with expand/collapse
- **Search Elements** — filter the element tree by attribute name or value
- **Auto-refresh** — detects screen changes and refreshes page source automatically

**Locator Generation**
- **All strategies at once** — XPath, Resource ID, Content Description, UIAutomator2, Accessibility ID, iOS Class Chain, NSPredicate String
- **Ranked by reliability** — best locators shown first (ID > Accessibility > XPath)
- **Uniqueness badge** — green checkmark if unique, orange warning if multiple elements match
- **One-click copy** — copy any locator directly to your clipboard

**Developer Experience**
- **Appium Methods Preview** — see what `getText()`, `getAttribute()`, `getRect()`, `isEnabled()` etc. would return for the selected element, before writing a single line of test code
- **Interact Mode** — tap elements directly from the browser to navigate the app
- **Dark / Light theme** — persists across sessions
- **Auto-reconnect** — WebSocket reconnects automatically if the backend restarts
- **Built-in log viewer** — filterable, full-page log view with Info / Warning / Error levels

---

## Installation

### From Chrome Web Store (Recommended)

1. Install **LocatorLens** from the [Chrome Web Store](#) *(coming soon)*
2. Click the extension icon → **Settings**
3. Follow the **Setup Guide** on the settings page

### For Developers (Load Unpacked)

```bash
git clone https://github.com/YOUR_USERNAME/locatorlens.git
cd locatorlens

# Install backend dependencies
cd backend && npm install && cd ..

# Load extension in Chrome:
# 1. Go to chrome://extensions
# 2. Enable Developer Mode
# 3. Click "Load Unpacked" → select the /extension folder

# Install native messaging host (run the installer from Settings page,
# or manually):
bash install_host.sh          # macOS / Linux
install_host.bat              # Windows (Command Prompt)
```

---

## Quick Start

1. Start your Android device (USB debugging on) or boot an iOS simulator
2. Click the LocatorLens extension icon → **Start Servers**
3. Select your platform and device → **Connect**
4. The Inspector opens automatically
5. Click any element on the screen mirror to see all its locators

That's it. Open any app on your device and keep inspecting — no reconnection needed.

---

## Prerequisites

| Requirement | Purpose | Install |
|-------------|---------|---------|
| **Node.js** v18+ | Runs the backend server | [nodejs.org](https://nodejs.org) |
| **Appium** v2+ | Mobile automation server | `npm install -g appium` |
| **UIAutomator2 driver** | Android support | `appium driver install uiautomator2` |
| **XCUITest driver** | iOS support (macOS only) | `appium driver install xcuitest` |
| **ADB** | Android device communication | [Android Platform Tools](https://developer.android.com/studio/releases/platform-tools) |
| **Xcode** | iOS simulator support (macOS only) | Mac App Store |

---

## Platform Support

| Platform | Android | iOS Simulator | Notes |
|----------|---------|--------------|-------|
| macOS | ✓ | ✓ | Full support |
| Windows | ✓ | ✗ | iOS requires macOS |
| Linux | ✓ | ✗ | iOS requires macOS |

---

## Settings

Open the extension **Settings** page to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Backend Port | `8765` | Port the Node.js backend listens on |
| Appium URL | `http://localhost:4723` | Appium server address and port |
| Screen Mirror FPS | `3` | Frames per second for live screen streaming (1–30) |

Settings take effect on the next **Start Servers**.

---

## How It Works

```
[Chrome Extension]
       |  native messaging
       v
[Native Host (Node.js)]  ──starts──►  [Backend Server :8765]
                                               │
                              WebSocket / REST │
                                               ▼
                                      [Appium Server :4723]
                                               │
                                               ▼
                                    [Android / iOS Device]
                                    (any app, any screen)
```

1. Extension sends a `start` command to a native host via Chrome's native messaging API
2. Native host starts the Node.js backend and Appium server with the configured ports
3. Extension connects to backend over WebSocket for live screen streaming
4. Backend uses Appium to capture screenshots and page source XML for whatever app is in the foreground
5. Extension renders the screen mirror and generates locators from the XML

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| "Native messaging host not found" | Re-run the installer from Settings and reload the extension |
| "Access forbidden" error | Re-download and re-run the installer (extension ID changed), then reload |
| Servers won't start | Check the log viewer in the popup. Ensure Node.js ≥ 18 is installed. |
| Appium not found | `npm install -g appium` (use Command Prompt on Windows, not PowerShell) |
| UiAutomator2 driver missing | `appium driver install uiautomator2` |
| No Android devices listed | Enable USB debugging. Run `adb devices` in terminal. |
| No iOS simulators listed | Boot a simulator in Xcode first (macOS only). |
| Screen capture fails | Check logs. Try disconnecting and reconnecting. |
| Backend dependencies missing | Re-run the installer — it runs `npm install` automatically. |

**Log file location:**
- macOS / Linux: `~/.locatorlens/native-host.log`
- Windows: `%USERPROFILE%\.locatorlens\native-host.log`

---

## Project Structure

```
locatorlens/
├── backend/            # Node.js REST + WebSocket server
│   ├── server.js
│   ├── appium-client.js
│   ├── device-manager.js
│   ├── screen-mirror.js
│   └── config.js
├── extension/          # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── background.js
│   ├── popup/
│   ├── inspector/
│   ├── options.html / options.js
│   ├── logs.html / logs.js
│   └── installers/     # install_host.sh + install_host.bat + launcher.js
├── native-host/        # Native messaging host
│   └── launcher.js
├── install_host.sh     # Quick installer (macOS/Linux)
└── install_host.bat    # Quick installer (Windows)
```

---

## License

MIT
