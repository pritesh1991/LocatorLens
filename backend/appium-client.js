const { remote } = require('webdriverio');
const { APPIUM_URL } = require('./config');

const SESSION_CREATE_TIMEOUT = 120000; // 2 minutes for session creation (WDA build can be slow)
const COMMAND_TIMEOUT = 30000; // 30 seconds for individual commands

class AppiumClient {
    constructor() {
        // Map of deviceId -> { driver, sessionActive, deviceInfo }
        this.sessions = new Map();
    }

    /**
     * Create Appium session for the selected device
     * @param {Object} deviceInfo
     */
    async createSession(deviceInfo) {
        try {
            if (!deviceInfo || !deviceInfo.id || !deviceInfo.platform) {
                return { success: false, error: 'Invalid device info: id and platform are required' };
            }

            // Close existing session for this device if any
            if (this.sessions.has(deviceInfo.id)) {
                await this.closeSession(deviceInfo.id);
            }

            const capabilities = this.buildCapabilities(deviceInfo);

            const driver = await remote({
                hostname: 'localhost',
                port: 4723,
                path: '/',
                capabilities,
                connectionRetryTimeout: SESSION_CREATE_TIMEOUT,
                connectionRetryCount: 3
            });

            this.sessions.set(deviceInfo.id, {
                driver,
                sessionActive: true,
                deviceInfo
            });

            console.log(`Appium session created for ${deviceInfo.platform} device: ${deviceInfo.name} (Total sessions: ${this.sessions.size})`);

            return { success: true, sessionId: driver.sessionId, deviceId: deviceInfo.id };
        } catch (error) {
            console.error('Error creating Appium session:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Build Appium capabilities based on device platform
     * @param {Object} deviceInfo 
     */
    buildCapabilities(deviceInfo) {
        const baseCapabilities = {
            platformName: deviceInfo.platform === 'android' ? 'Android' : 'iOS',
            'appium:deviceName': deviceInfo.name,
            'appium:udid': deviceInfo.id,
            'appium:automationName': deviceInfo.platform === 'android' ? 'UiAutomator2' : 'XCUITest',
            'appium:noReset': true,
            'appium:autoGrantPermissions': true
        };

        if (deviceInfo.platform === 'android') {
            // For Android, connect to current app if no package specified
            if (deviceInfo.appPackage) {
                baseCapabilities['appium:appPackage'] = deviceInfo.appPackage;
                baseCapabilities['appium:appActivity'] = deviceInfo.appActivity || '';
            }
        } else {
            // For iOS, connect to whatever is currently running
            // Appium will automatically build and install WebDriverAgent
            baseCapabilities['appium:autoLaunch'] = false;

            // Enable automatic code signing
            // Users need to provide their Apple Developer Team ID (from developer.apple.com/account)
            // This can be found in environment variables or config file
            const teamId = process.env.APPLE_TEAM_ID || deviceInfo.teamId;
            if (teamId) {
                baseCapabilities['appium:xcodeOrgId'] = teamId;
                baseCapabilities['appium:xcodeSigningId'] = 'Apple Development';
                baseCapabilities['appium:updatedWDABundleId'] = `com.${teamId}.WebDriverAgentRunner`;
                console.log(`✅ Using Apple Team ID: ${teamId} for automatic signing`);
            } else {
                console.warn('⚠️  No Apple Team ID provided. WebDriverAgent signing may fail.');
                console.warn('   Set APPLE_TEAM_ID environment variable or add teamId to device info');
            }

            // Show detailed Xcode logs for debugging
            baseCapabilities['appium:showXcodeLog'] = true;

            // Fix for macOS Tahoe 26.2: Don't let Appium use macOS version for iOS deployment target
            // Use a stable iOS version that's available in Xcode
            // Use the detected version from device-manager
            if (deviceInfo.version) {
                baseCapabilities['appium:platformVersion'] = deviceInfo.version;
            } else if (!deviceInfo.platformVersion) {
                // Fallback only if no version info available
                baseCapabilities['appium:platformVersion'] = '17.5';
                console.log('📱 Setting fallback platformVersion to 17.5');
            }

            // Only set bundleId if provided
            if (deviceInfo.bundleId) {
                baseCapabilities['appium:bundleId'] = deviceInfo.bundleId;
                baseCapabilities['appium:autoLaunch'] = true;
            }
        }

        return baseCapabilities;
    }

    /**
     * Get session for a device
     * @param {string} deviceId
     * @returns {Object|null}
     */
    getSession(deviceId) {
        return this.sessions.get(deviceId);
    }

    /**
     * Get driver for a device, with session validation
     * @param {string} deviceId
     * @returns {Object}
     */
    getDriver(deviceId) {
        const session = this.sessions.get(deviceId);
        if (!session || !session.driver) {
            throw new Error(`No active Appium session for device: ${deviceId}`);
        }
        if (!session.sessionActive) {
            throw new Error(`Appium session for device ${deviceId} is no longer active`);
        }
        return session.driver;
    }

    /**
     * Get page source XML
     * @param {string} deviceId
     * @returns {Promise<string>}
     */
    async getPageSource(deviceId) {
        const driver = this.getDriver(deviceId);

        try {
            const source = await driver.getPageSource();
            return source;
        } catch (error) {
            console.error(`Error getting page source for ${deviceId}:`, error.message);
            this.handleSessionError(deviceId, error);
            throw error;
        }
    }

    /**
     * Capture screenshot
     * @param {string} deviceId
     * @returns {Promise<string>} Base64 encoded screenshot
     */
    async getScreenshot(deviceId) {
        const driver = this.getDriver(deviceId);

        try {
            const screenshot = await driver.takeScreenshot();
            return screenshot;
        } catch (error) {
            console.error(`Error taking screenshot for ${deviceId}:`, error.message);
            this.handleSessionError(deviceId, error);
            throw error;
        }
    }

    /**
     * Handle session errors - mark session as inactive if it's a session-level failure
     * @param {string} deviceId
     * @param {Error} error
     */
    handleSessionError(deviceId, error) {
        const msg = error.message || '';
        // Detect dead sessions
        if (msg.includes('invalid session id') ||
            msg.includes('session not created') ||
            msg.includes('Session not found') ||
            msg.includes('ECONNREFUSED') ||
            msg.includes('ECONNRESET')) {
            console.warn(`Session for ${deviceId} appears dead, marking inactive`);
            const session = this.sessions.get(deviceId);
            if (session) {
                session.sessionActive = false;
            }
        }
    }

    /**
     * Tap at coordinates
     * @param {string} deviceId
     * @param {number} x 
     * @param {number} y 
     */
    async tap(deviceId, x, y) {
        const driver = this.getDriver(deviceId);

        try {
            // Use W3C Actions API for reliable touch simulation
            await driver.performActions([{
                type: 'pointer',
                id: 'finger1',
                parameters: { pointerType: 'touch' },
                actions: [
                    { type: 'pointerMove', duration: 0, x: x, y: y },
                    { type: 'pointerDown', button: 0 },
                    { type: 'pause', duration: 100 },
                    { type: 'pointerUp', button: 0 }
                ]
            }]);

            // Release actions
            await driver.releaseActions();

            console.log(`Tapped at (${x}, ${y}) on device ${deviceId}`);
        } catch (error) {
            console.error(`Error performing tap on ${deviceId}:`, error.message);
            this.handleSessionError(deviceId, error);
            throw error;
        }
    }

    /**
     * Find element at specific coordinates
     * @param {string} deviceId
     * @param {number} x 
     * @param {number} y 
     */
    async findElementAtCoordinates(deviceId, x, y) {
        const driver = this.getDriver(deviceId);

        try {
            // Get page source and parse to find element at coordinates
            const source = await this.getPageSource(deviceId);
            // This is a simplified version - you'd need to parse XML and match bounds
            return { source, coordinates: { x, y } };
        } catch (error) {
            console.error(`Error finding element on ${deviceId}:`, error.message);
            throw error;
        }
    }

    /**
     * Highlight element on device
     * @param {string} deviceId
     * @param {string} elementSelector 
     */
    async highlightElement(deviceId, elementSelector) {
        const driver = this.getDriver(deviceId);

        try {
            const element = await driver.$(elementSelector);
            const rect = await element.getRect();

            return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
            };
        } catch (error) {
            console.error(`Error highlighting element on ${deviceId}:`, error.message);
            throw error;
        }
    }

    /**
     * Close Appium session for a specific device
     * @param {string} deviceId
     */
    async closeSession(deviceId) {
        const session = this.sessions.get(deviceId);
        if (session && session.driver) {
            try {
                await session.driver.deleteSession();
                this.sessions.delete(deviceId);
                console.log(`Appium session closed for ${deviceId} (Remaining sessions: ${this.sessions.size})`);
            } catch (error) {
                console.error(`Error closing session for ${deviceId}:`, error.message);
                this.sessions.delete(deviceId); // Clean up map even on error
            }
        }
    }

    /**
     * Close all sessions (legacy compatibility & cleanup)
     */
    async closeAllSessions() {
        for (const [deviceId, session] of this.sessions.entries()) {
            if (session.driver) {
                try {
                    await session.driver.deleteSession();
                } catch (error) {
                    console.error(`Error closing session for ${deviceId}:`, error.message);
                }
            }
        }
        this.sessions.clear();
        console.log('All Appium sessions closed');
    }

    /**
     * Check if session is active for a device
     * @param {string} deviceId
     */
    isSessionActive(deviceId) {
        const session = this.sessions.get(deviceId);
        return session && session.sessionActive;
    }

    /**
     * Get current app bundle/package
     * @param {string} deviceId
     */
    async getCurrentApp(deviceId) {
        try {
            const driver = this.getDriver(deviceId);
            const capabilities = await driver.getSession();
            return capabilities;
        } catch (error) {
            return null;
        }
    }
}

module.exports = new AppiumClient();

