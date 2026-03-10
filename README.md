# LocatorLens

**Real-time Element Inspector & Locator Builder for Appium (Android & iOS)**

Inspect mobile app elements, generate locators, and see a live screen mirror — all from your browser. Works with **any app on any device**, no code changes or app modifications required.

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

**Locator Generation**
- **All strategies at once** — XPath, Resource ID, Content Description, UIAutomator2, Accessibility ID, iOS Class Chain, NSPredicate String
- **Ranked by reliability** — best locators shown first (ID > Accessibility > XPath)
- **Match count badge** — green checkmark if unique, orange warning if multiple elements match
- **One-click copy** — copy any locator directly to your clipboard

**Developer Experience**
- **Appium Methods Preview** — see what `getText()`, `getAttribute()`, `getRect()`, `isEnabled()` etc. would return for the selected element, before writing a single line of test code
- **Interact Mode** — tap elements directly from the browser to navigate the app
- **Auto-refresh** — page source updates automatically when the screen changes
- **Dark / Light theme** — persists across sessions
- **Auto-reconnect** — WebSocket reconnects automatically if the backend restarts

---

## Installation

### From Chrome Web Store (Recommended)

1. Install **LocatorLens** from the [Chrome Web Store](#) *(link coming soon)*
2. Click the extension icon → **Open Settings**
3. Follow the **Setup Guide** in the settings page

### For Developers (Load Unpacked)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/locatorlens.git
cd locatorlens

# Set up backend
cd backend && npm install && cd ..

# Install native messaging host
bash install_host.sh

# Load extension in Chrome:
# 1. Go to chrome://extensions
# 2. Enable Developer Mode
# 3. Click "Load Unpacked" -> select the /extension folder
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
| **Appium** | Mobile automation server | `npm install -g appium` |
| **UIAutomator2 driver** | Android support | `appium driver install uiautomator2` |
| **XCUITest driver** | iOS support (macOS only) | `appium driver install xcuitest` |
| **ADB** | Android device communication | [Android Platform Tools](https://developer.android.com/studio/releases/platform-tools) |
| **Xcode** | iOS simulator support (macOS only) | Mac App Store |

---

## Platform Support

| Platform | Android | iOS Simulator | Notes |
|----------|---------|--------------|-------|
| macOS | Yes | Yes | Full support |
| Linux | Yes | No | iOS requires macOS |
| Windows | Yes | No | iOS requires macOS |

---

## How It Works

```
[Chrome Extension]
       |  native messaging
       v
[Native Host (Node.js)]  --starts-->  [Backend Server :8765]
                                               |
                              WebSocket / REST |
                                               v
                                      [Appium Server :4723]
                                               |
                                               v
                                    [Android / iOS Device]
                                    (any app, any screen)
```

1. Extension sends commands to a native host via Chrome's native messaging API
2. Native host starts the Node.js backend and Appium
3. Extension connects to backend over WebSocket for live screen streaming
4. Backend uses Appium to capture screenshots and page source XML for whatever app is in the foreground

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| "Native messaging host not found" | Re-run `install_host.sh` and reload the extension |
| Servers won't start | Check logs in the popup. Ensure Node.js >= 18 is installed. |
| Appium not found | `npm install -g appium` |
| No Android devices listed | Enable USB debugging. Check `adb devices` in terminal. |
| No iOS simulators listed | Boot a simulator in Xcode first (macOS only). |
| Screen capture fails | Check Appium session logs. Try disconnecting and reconnecting. |
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
│   ├── installers/     # install_host.sh + install_host.bat
│   └── icons/
├── native-host/        # Native messaging host scripts
│   └── launcher.js
├── install_host.sh     # Quick installer (runs from repo root)
└── install_host.bat    # Windows quick installer
```

---

## License

MIT
