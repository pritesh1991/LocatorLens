const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class ScreenMirror {
    constructor() {
        // Map of deviceId -> { interval, isCapturing, platform }
        this.streams = new Map();
    }

    /**
     * Capture Android device screen using exec-out (streaming)
     * @param {string} deviceId 
     * @returns {Promise<Buffer>}
     */
    async captureAndroidScreen(deviceId) {
        return new Promise((resolve, reject) => {
            // Use exec-out to stream directly to stdout, avoiding file I/O on device and local
            const adb = spawn('adb', ['-s', deviceId, 'exec-out', 'screencap', '-p']);

            const chunks = [];

            adb.stdout.on('data', (chunk) => {
                chunks.push(chunk);
            });

            adb.stderr.on('data', (data) => {
                console.error(`ADB Error: ${data}`);
            });

            adb.on('close', (code) => {
                if (code === 0) {
                    resolve(Buffer.concat(chunks));
                } else {
                    reject(new Error(`ADB process exited with code ${code}`));
                }
            });

            adb.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Capture iOS simulator screen
     * @param {string} udid 
     * @returns {Promise<Buffer>}
     */
    async captureIOSScreen(udid) {
        return new Promise((resolve, reject) => {
            const timestamp = Date.now();
            const localPath = path.join(__dirname, `temp_${udid}_${timestamp}.png`);

            // iOS simctl doesn't support stdout streaming easily, so we still use file
            // but we use exec (async) instead of execSync
            exec(`xcrun simctl io ${udid} screenshot ${localPath}`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                try {
                    const imageBuffer = fs.readFileSync(localPath);
                    fs.unlink(localPath, (err) => {
                        if (err) console.error('Failed to cleanup temp file:', err);
                    });
                    resolve(imageBuffer);
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    /**
     * Get screenshot as base64
     * @param {string} platform 
     * @param {string} deviceId 
     */
    async getScreenshotBase64(platform, deviceId) {
        try {
            let imageBuffer;

            if (platform === 'android') {
                imageBuffer = await this.captureAndroidScreen(deviceId);
            } else if (platform === 'ios') {
                imageBuffer = await this.captureIOSScreen(deviceId);
            } else {
                throw new Error('Unsupported platform');
            }

            return imageBuffer.toString('base64');
        } catch (error) {
            console.error('Error getting screenshot:', error.message);
            throw error;
        }
    }

    /**
     * Start streaming screenshots for a specific device
     * @param {string} platform 
     * @param {string} deviceId 
     * @param {Function} callback 
     * @param {number} fps 
     */
    startStreaming(platform, deviceId, callback, fps = 3) {
        // Stop any existing stream for THIS device only
        this.stopStreamingForDevice(deviceId);

        const state = {
            isCapturing: false,
            platform,
            interval: null
        };

        const interval = 1000 / fps;

        state.interval = setInterval(async () => {
            if (state.isCapturing) return; // Skip frame if previous one is still processing

            state.isCapturing = true;
            try {
                const screenshot = await this.getScreenshotBase64(platform, deviceId);
                // Check if stream is still active
                if (this.streams.has(deviceId)) {
                    callback({ type: 'screenshot', data: screenshot });
                }
            } catch (error) {
                console.error(`Streaming error for ${deviceId}:`, error.message);
                // Don't send error to frontend for every frame drop, just log it
            } finally {
                state.isCapturing = false;
            }
        }, interval);

        this.streams.set(deviceId, state);
        console.log(`Started screen streaming for ${deviceId} at ${fps} FPS (Total active: ${this.streams.size})`);
    }

    /**
     * Stop streaming for a specific device
     * @param {string} deviceId
     */
    stopStreamingForDevice(deviceId) {
        const state = this.streams.get(deviceId);
        if (state && state.interval) {
            clearInterval(state.interval);
            this.streams.delete(deviceId);
            console.log(`Stopped screen streaming for ${deviceId} (Remaining active: ${this.streams.size})`);
        }
    }

    /**
     * Stop all streams (legacy compatibility & cleanup)
     */
    stopStreaming() {
        for (const [deviceId, state] of this.streams.entries()) {
            if (state.interval) {
                clearInterval(state.interval);
            }
        }
        this.streams.clear();
        console.log('Stopped all screen streaming');
    }

    /**
     * Check if a device is currently streaming
     * @param {string} deviceId
     */
    isStreamingDevice(deviceId) {
        return this.streams.has(deviceId);
    }
}

module.exports = new ScreenMirror();

