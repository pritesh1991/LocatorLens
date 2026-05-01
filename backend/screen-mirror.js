const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { normalizeScreenFps } = require('./fps');

const CAPTURE_TIMEOUT = 10000; // 10 second timeout per screenshot
const MAX_CONSECUTIVE_ERRORS = 10; // Stop streaming after this many consecutive failures

class ScreenMirror {
    constructor() {
        // Map of deviceId -> { interval, isCapturing, platform, errorCount }
        this.streams = new Map();
        this.cleanupOrphanedTempFiles();
    }

    /**
     * Clean up any orphaned temp screenshot files from previous runs
     */
    cleanupOrphanedTempFiles() {
        try {
            const files = fs.readdirSync(__dirname);
            const tempFiles = files.filter(f => f.startsWith('temp_') && f.endsWith('.png'));
            for (const file of tempFiles) {
                try {
                    fs.unlinkSync(path.join(__dirname, file));
                    console.log(`Cleaned up orphaned temp file: ${file}`);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        } catch (e) {
            // Ignore if directory read fails
        }
    }

    /**
     * Capture Android device screen using exec-out (streaming)
     * @param {string} deviceId 
     * @returns {Promise<Buffer>}
     */
    async captureAndroidScreen(deviceId) {
        return new Promise((resolve, reject) => {
            const adb = spawn('adb', ['-s', deviceId, 'exec-out', 'screencap', '-p']);
            let settled = false;

            const timeout = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    adb.kill('SIGKILL');
                    reject(new Error('ADB screenshot timed out'));
                }
            }, CAPTURE_TIMEOUT);

            const chunks = [];

            adb.stdout.on('data', (chunk) => {
                chunks.push(chunk);
            });

            adb.stderr.on('data', (data) => {
                console.error(`ADB Error: ${data}`);
            });

            adb.on('close', (code) => {
                clearTimeout(timeout);
                if (settled) return;
                settled = true;
                if (code === 0 && chunks.length > 0) {
                    resolve(Buffer.concat(chunks));
                } else {
                    reject(new Error(`ADB process exited with code ${code}`));
                }
            });

            adb.on('error', (err) => {
                clearTimeout(timeout);
                if (settled) return;
                settled = true;
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

            const child = exec(`xcrun simctl io ${udid} screenshot ${localPath}`, { timeout: CAPTURE_TIMEOUT }, (error, stdout, stderr) => {
                if (error) {
                    // Clean up temp file on error
                    fs.unlink(localPath, () => {});
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
                    fs.unlink(localPath, () => {});
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
        const streamFps = normalizeScreenFps(fps);

        const state = {
            isCapturing: false,
            platform,
            interval: null,
            errorCount: 0,
            fps: streamFps
        };

        const interval = Math.max(1, Math.round(1000 / streamFps));

        state.interval = setInterval(async () => {
            if (state.isCapturing) return; // Skip frame if previous one is still processing

            state.isCapturing = true;
            try {
                const screenshot = await this.getScreenshotBase64(platform, deviceId);
                // Check if stream is still active
                if (this.streams.has(deviceId)) {
                    callback({ type: 'screenshot', data: screenshot });
                    state.errorCount = 0; // Reset on success
                }
            } catch (error) {
                state.errorCount++;
                if (state.errorCount <= 3 || state.errorCount % 10 === 0) {
                    console.error(`Streaming error for ${deviceId} (${state.errorCount}/${MAX_CONSECUTIVE_ERRORS}):`, error.message);
                }
                // Auto-stop after too many consecutive failures
                if (state.errorCount >= MAX_CONSECUTIVE_ERRORS) {
                    console.error(`Stopping stream for ${deviceId} after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
                    callback({ type: 'error', message: `Screen capture failed repeatedly. Device may be disconnected.` });
                    this.stopStreamingForDevice(deviceId);
                }
            } finally {
                state.isCapturing = false;
            }
        }, interval);

        this.streams.set(deviceId, state);
        console.log(`Started screen streaming for ${deviceId} at ${streamFps} FPS (Total active: ${this.streams.size})`);
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
