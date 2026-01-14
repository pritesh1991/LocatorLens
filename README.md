# LocatorLens

**Real-time Element Inspector & Locator Builder for Appium (Android & iOS)**

See app structure, inspect elements, and build robust locators instantly.

![LocatorLens Icon](extension/icons/icon128.png)

## Prerequisites

Install these before using LocatorLens:

| Requirement | Installation |
|-------------|--------------|
| **Node.js** (v18+) | [nodejs.org](https://nodejs.org) |
| **Appium** | `npm install -g appium` |
| **Appium Drivers** | `appium driver install uiautomator2` (Android)<br>`appium driver install xcuitest` (iOS) |
| **Android SDK** | [Platform Tools](https://developer.android.com/studio/releases/platform-tools) (includes `adb`) |
| **Xcode** | macOS only - for iOS simulator support |

## Quick Start

### 1. Install Backend
```bash
cd backend
npm install
```

### 2. Install Native Messaging Host
```bash
sh install_host.sh
```

### 3. Load Extension in Chrome
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder

## Usage

1. Click **LocatorLens** extension icon
2. Click **Start Servers**
3. Select your device (Android/iOS)
4. Click **Connect**
5. Inspector tab opens automatically

## Features

- 📱 **Screen Mirror** - Real-time device screen with tap interaction
- 🔍 **Element Inspector** - Click to inspect, hover to highlight
- 📝 **Locator Generator** - XPath, UIAutomator, ClassName locators
- 🌙 **Dark/Light Mode** - Toggle theme in inspector
- 🔄 **Auto-refresh** - Page source updates when screen changes

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Native messaging host not found" | Run `sh install_host.sh`, restart Chrome |
| "Device not found" | Check `adb devices` or Xcode simulators |
| Servers won't start | Check popup logs, ensure Appium is installed |

## Project Structure

```
locator-lens/
├── backend/           # Node.js server
├── extension/         # Chrome extension
├── native-host/       # Native messaging
├── install_host.sh    # Host installer
└── README.md
```

## License

MIT
