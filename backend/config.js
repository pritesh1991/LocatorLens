const SERVER_PORT = process.env.PORT || 8765;
const APPIUM_HOST = process.env.APPIUM_HOST || 'localhost';
const APPIUM_PORT = process.env.APPIUM_PORT || 4723;
const APPIUM_URL = `http://${APPIUM_HOST}:${APPIUM_PORT}`;
const SCREEN_CAPTURE_FPS = parseInt(process.env.SCREEN_FPS) || 3;
const WS_HEARTBEAT_INTERVAL = 30000; // 30 seconds

module.exports = {
  SERVER_PORT,
  APPIUM_HOST,
  APPIUM_PORT,
  APPIUM_URL,
  SCREEN_CAPTURE_FPS,
  WS_HEARTBEAT_INTERVAL
};
