# LocatorLens — Claude Instructions

## Project Summary
Chrome Extension (Manifest V3) + Node.js backend for real-time mobile element inspection and Appium locator generation. Connects to a running Appium session and inspects whatever app is on screen — no app configuration needed.

## Stack
- **Extension**: Chrome MV3, vanilla JS, background service worker, native messaging
- **Backend**: Node.js, Express, WebSocket (`ws`), WebDriverIO (`webdriverio`)
- **Mobile**: Appium 2.x, UIAutomator2 (Android), XCUITest (iOS)

## Project Structure
```
extension/          Chrome Extension source
  background.js     Service worker — native messaging, message routing
  popup/            Start servers, connect device
  inspector/        Main inspector UI (screen mirror + element tree + locators)
  options/          Setup guide + settings
  installers/       install_host.sh (macOS/Linux), install_host.bat (Windows)
backend/            Node.js REST + WebSocket server (port 8765)
  server.js
  appium-client.js  WebDriverIO session management
  device-manager.js ADB + xcrun simctl
  screen-mirror.js  Screenshot streaming
  config.js
native-host/
  launcher.js       Native messaging host — starts backend + Appium
```

## Critical Invariants — Do Not Break

### WebSocket page source timing
`get-page-source` must only be sent AFTER `streaming-started` is received from the server. The server sets `ws.deviceId` during `handleStartStreaming`. Requesting page source before that causes "No deviceId" errors. The call lives in the `streaming-started` case of `handleWebSocketMessage`, NOT in `startStreaming()`.

### Refresh button state
`refreshPageSource()` is guarded by `isLoadingPageSource`. The refresh button click handler checks this flag and returns early (with a toast) if already loading. The `spinning` CSS class is removed in three places: `updatePageSource()` (success), `error` WS handler, and the 15s safety timeout.

### Screen change detection
`detectScreenChange()` runs on every screenshot frame. It:
1. Shows `showStaleIndicator()` immediately on any detected change
2. Debounces actual refresh requests to once per 2s (`screenChangeDebounceTimer`)
3. Reuses `diffCanvas` — does NOT create a new canvas per frame
The debounce timer is cancelled in `updatePageSource()` when fresh data arrives.

### iOS coordinate scaling
iOS XML is in logical points; screenshots are in pixels (Retina = 2x/3x). `coordinateScale` is derived by comparing `screenImage.naturalWidth` vs the XML `XCUIElementTypeApplication` width. Android uses pixel bounds `[x1,y1][x2,y2]` with no scaling.

### Cross-platform launcher
`native-host/launcher.js` must work on macOS, Linux, and Windows. Use `lsof`/`kill` on macOS/Linux and `netstat`/`taskkill` on Windows. Do NOT use `sleep`, `pgrep -x`, or other macOS-only commands.

### Native host installer
Installers copy backend to `~/.locatorlens/backend/` and `launcher.js` to `~/.locatorlens/native-host/launcher.js`. They do NOT embed launcher.js inline. Supports `--extension-id` argument.

## Extension ID
CWS production ID: `ajcdeghbgfonhphbnkmbmocekkmdeoke`
Native host name: `com.locatorbuilder.host`

## Common Pitfalls
- Never call `refreshPageSource()` directly from `startStreaming()` — race condition
- `isLoadingPageSource` must be reset on ALL error paths, not just success
- `capturePageSourceSnapshot()` is called after every successful page source load to baseline the diff canvas
- The element-to-node `WeakMap` is rebuilt on every page source update — do not cache references across refreshes
- Android bounds regex: `/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/` — use `[, x1, y1, x2, y2]` destructuring (no `_`)
