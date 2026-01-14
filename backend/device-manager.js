const { execSync, exec } = require('child_process');

class DeviceManager {
    /**
     * List all running Android devices/emulators
     * @returns {Promise<Array>} Array of device objects
     */
    async listAndroidDevices() {
        try {
            const output = execSync('adb devices -l', { encoding: 'utf-8' });
            const lines = output.split('\n').slice(1); // Skip header

            const devices = [];
            for (const line of lines) {
                if (line.trim() && !line.includes('List of devices')) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2 && parts[1] === 'device') {
                        const deviceId = parts[0];
                        const deviceInfo = await this.getAndroidDeviceInfo(deviceId);
                        devices.push({
                            id: deviceId,
                            platform: 'android',
                            name: deviceInfo.model || deviceId,
                            version: deviceInfo.version || 'Unknown',
                            status: 'connected'
                        });
                    }
                }
            }

            return devices;
        } catch (error) {
            console.error('Error listing Android devices:', error.message);
            return [];
        }
    }

    /**
     * Get detailed info about an Android device
     * @param {string} deviceId 
     * @returns {Promise<Object>}
     */
    async getAndroidDeviceInfo(deviceId) {
        try {
            const model = execSync(`adb -s ${deviceId} shell getprop ro.product.model`, { encoding: 'utf-8' }).trim();
            const version = execSync(`adb -s ${deviceId} shell getprop ro.build.version.release`, { encoding: 'utf-8' }).trim();

            return { model, version };
        } catch (error) {
            return { model: deviceId, version: 'Unknown' };
        }
    }

    /**
     * List all booted iOS simulators
     * @returns {Promise<Array>} Array of simulator objects
     */
    async listIOSSimulators() {
        try {
            const output = execSync('xcrun simctl list devices booted --json', { encoding: 'utf-8' });
            const data = JSON.parse(output);

            const simulators = [];
            for (const runtime in data.devices) {
                const devices = data.devices[runtime];
                for (const device of devices) {
                    if (device.state === 'Booted') {
                        simulators.push({
                            id: device.udid,
                            platform: 'ios',
                            name: device.name,
                            version: this.extractIOSVersion(runtime),
                            status: 'connected'
                        });
                    }
                }
            }

            return simulators;
        } catch (error) {
            console.error('Error listing iOS simulators:', error.message);
            return [];
        }
    }

    /**
     * Extract iOS version from runtime string
     * @param {string} runtime 
     */
    extractIOSVersion(runtime) {
        const match = runtime.match(/iOS[.\s-]*([\d.]+)/i);
        return match ? match[1] : 'Unknown';
    }

    /**
     * Get all available devices (Android + iOS)
     * @returns {Promise<Array>}
     */
    async getAllDevices() {
        const [androidDevices, iosSimulators] = await Promise.all([
            this.listAndroidDevices(),
            this.listIOSSimulators()
        ]);

        return [...androidDevices, ...iosSimulators];
    }

    /**
     * Check if ADB is available
     */
    isAdbAvailable() {
        try {
            execSync('adb version', { encoding: 'utf-8' });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if iOS tools are available
     */
    isIOSToolsAvailable() {
        try {
            execSync('xcrun simctl help', { encoding: 'utf-8' });
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new DeviceManager();
