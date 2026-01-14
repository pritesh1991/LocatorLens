const BACKEND_URL = 'http://localhost:8765';

// DOM Elements
const platformSelect = document.getElementById('platform-select');
const deviceSelect = document.getElementById('device-select');
const connectBtn = document.getElementById('connect-btn');
const errorMessage = document.getElementById('error-message');
const serverBtn = document.getElementById('server-btn');
const backendDot = document.getElementById('backend-dot');
const appiumDot = document.getElementById('appium-dot');

const settingsLink = document.getElementById('settings-link');
const logsToggle = document.getElementById('logs-toggle');
const logsContent = document.getElementById('logs-content');

// State
let devices = [];
let selectedPlatform = null;
let selectedDevice = null;
let serverStatus = { backend: false, appium: false };

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();

    // Poll for status
    updateServerStatus();
    setInterval(updateServerStatus, 2000);
});

function setupEventListeners() {
    platformSelect.addEventListener('change', handlePlatformChange);
    deviceSelect.addEventListener('change', handleDeviceChange);
    connectBtn.addEventListener('click', handleConnect);
    serverBtn.addEventListener('click', handleServerToggle);
    settingsLink.addEventListener('click', handleSettings);

    const helpLink = document.getElementById('help-link');
    if (helpLink) {
        helpLink.addEventListener('click', handleSettings); // Same as settings, opens options.html
    }

    logsToggle.addEventListener('click', toggleLogs);

    // Listen for log messages from background
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'server-log') {
            addLogEntry(message.message, message.level);
        }
    });
}

function toggleLogs() {
    logsContent.classList.toggle('visible');
    logsToggle.classList.toggle('expanded');
}

function addLogEntry(message, level = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${level}`;
    entry.textContent = message;
    logsContent.appendChild(entry);

    // Auto-scroll to bottom
    logsContent.scrollTop = logsContent.scrollHeight;

    // Keep only last 100 entries
    while (logsContent.children.length > 100) {
        logsContent.removeChild(logsContent.firstChild);
    }
}

function handleSettings(e) {
    e.preventDefault();
    // For now, just show an alert or open a placeholder options page
    // Since we don't have an options page yet, let's just show a message
    // or we could create a simple options.html
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('options.html'));
    }
}

function updateServerStatus() {
    chrome.runtime.sendMessage({ type: 'get-status' }, (response) => {
        if (chrome.runtime.lastError) return;

        serverStatus = response || { backend: false, appium: false };
        renderServerStatus();

        // If backend is running, try to connect/refresh device list
        if (serverStatus.backend) {
            checkBackendStatus();
        } else {
            disableAllInputs();
            showError('Please start the servers first.');
        }
    });
}

function renderServerStatus() {
    // Update dots
    backendDot.className = `status-dot ${serverStatus.backend ? 'connected' : 'disconnected'}`;
    appiumDot.className = `status-dot ${serverStatus.appium ? 'connected' : 'disconnected'}`;

    // Update button
    if (serverStatus.backend || serverStatus.appium) {
        serverBtn.textContent = 'Stop Servers';
        serverBtn.classList.add('btn-danger');
    } else {
        serverBtn.textContent = 'Start Servers';
        serverBtn.classList.remove('btn-danger');
    }
}

async function handleServerToggle() {
    const isRunning = serverStatus.backend || serverStatus.appium;
    const command = isRunning ? 'stop-server' : 'start-server';

    serverBtn.disabled = true;
    serverBtn.textContent = isRunning ? 'Stopping...' : 'Starting...';

    chrome.runtime.sendMessage({ type: command }, (response) => {
        serverBtn.disabled = false;
        if (response && response.success) {
            // Status update will happen via polling/message
            setTimeout(updateServerStatus, 1000);
        } else {
            showError(`Failed to ${isRunning ? 'stop' : 'start'} server: ${response?.error || 'Unknown error'}`);
        }
    });
}

async function checkBackendStatus() {
    try {
        const response = await fetch(`${BACKEND_URL}/health`);
        const data = await response.json();

        if (data.status === 'ok') {
            showError('');

            // Show warnings if tools are not available
            if (!data.adbAvailable && !data.iosToolsAvailable) {
                showError('⚠️ Neither ADB nor iOS tools are available. Please install Android SDK or Xcode.');
            } else if (!data.adbAvailable) {
                showError('⚠️ ADB not available. Android device detection will not work.');
            } else if (!data.iosToolsAvailable) {
                showError('⚠️ iOS tools not available. iOS simulator detection will not work.');
            }

            // Enable inputs if they were disabled
            if (platformSelect.disabled) {
                platformSelect.disabled = false;
            }
        }
    } catch (error) {
        // Backend might be starting up
    }
}

function showError(message) {
    if (message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    } else {
        errorMessage.classList.add('hidden');
    }
}

function disableAllInputs() {
    platformSelect.disabled = true;
    deviceSelect.disabled = true;
    connectBtn.disabled = true;
}

async function handlePlatformChange(e) {
    selectedPlatform = e.target.value;

    if (!selectedPlatform) {
        deviceSelect.innerHTML = '<option value="">Select a platform first</option>';
        deviceSelect.disabled = true;
        connectBtn.disabled = true;
        return;
    }

    deviceSelect.disabled = true;
    deviceSelect.innerHTML = '<option value="">Loading devices...</option>';
    connectBtn.disabled = true;

    try {
        const response = await fetch(`${BACKEND_URL}/api/devices/${selectedPlatform}`);
        const data = await response.json();

        if (data.success) {
            devices = data.devices;
            populateDeviceDropdown(devices);
        } else {
            showError(`Failed to fetch devices: ${data.error}`);
            deviceSelect.innerHTML = '<option value="">No devices found</option>';
        }
    } catch (error) {
        showError(`Error fetching devices: ${error.message}`);
        deviceSelect.innerHTML = '<option value="">Error loading devices</option>';
    }
}

function populateDeviceDropdown(devices) {
    if (devices.length === 0) {
        deviceSelect.innerHTML = '<option value="">No devices found</option>';
        deviceSelect.disabled = true;
        return;
    }

    deviceSelect.innerHTML = '<option value="">Select a device</option>';
    devices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${device.name} (${device.version})`;
        deviceSelect.appendChild(option);
    });

    deviceSelect.disabled = false;
}

function handleDeviceChange(e) {
    const deviceIndex = e.target.value;

    if (deviceIndex === '') {
        selectedDevice = null;
        connectBtn.disabled = true;
    } else {
        selectedDevice = devices[parseInt(deviceIndex)];
        connectBtn.disabled = false;
    }
}

async function handleConnect() {
    if (!selectedDevice) return;

    connectBtn.disabled = true;
    connectBtn.innerHTML = `
    <svg class="btn-icon spinning" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" opacity="0.3"/>
      <path d="M14 8C14 4.68629 11.3137 2 8 2" stroke="currentColor" stroke-width="2"/>
    </svg>
    Connecting...
  `;

    // Send to background script for persistent processing
    // This way, even if popup closes, the connection will complete
    chrome.runtime.sendMessage({
        type: 'connect-device',
        deviceInfo: selectedDevice
    }, (response) => {
        if (response && response.started) {
            // Show status - user can close popup whenever they want
            // Inspector will open when ready, regardless of popup state
            connectBtn.innerHTML = `
            <svg class="btn-icon spinning" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" opacity="0.3"/>
              <path d="M14 8C14 4.68629 11.3137 2 8 2" stroke="currentColor" stroke-width="2"/>
            </svg>
            Creating session... (tab will open when ready)
          `;
        } else {
            showError(`Connection error: ${response?.error || 'Unknown error'}`);
            resetConnectButton();
        }
    });
}

function resetConnectButton() {
    connectBtn.disabled = false;
    connectBtn.innerHTML = `
    <svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2"/>
      <path d="M8 5V11M5 8H11" stroke="currentColor" stroke-width="2"/>
    </svg>
    Connect to Device
  `;
}

// Add spinning animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spinning {
    animation: spin 1s linear infinite;
  }
`;
document.head.appendChild(style);
