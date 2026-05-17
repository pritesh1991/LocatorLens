let BACKEND_URL = 'http://localhost:8765';

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
const openLogsBtn = document.getElementById('open-logs-btn');

// Error Modal Elements
const errorModal = document.getElementById('error-modal');
const errorModalTitle = document.getElementById('error-modal-title');
const errorModalBody = document.getElementById('error-modal-body');
const errorModalClose = document.getElementById('error-modal-close');
const errorHelpBtn = document.getElementById('error-help-btn');

// State
let devices = [];
let selectedPlatform = null;
let selectedDevice = null;
let serverStatus = { backend: false, appium: false };

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    LocatorLensAnalytics.trackPageView('popup', 'LocatorLens Popup');

    chrome.storage.sync.get({ backendPort: 8765 }, (s) => {
        BACKEND_URL = `http://localhost:${s.backendPort}`;

        setupEventListeners();

        // Load existing log history
        chrome.runtime.sendMessage({ type: 'request-logs' }, (response) => {
            if (chrome.runtime.lastError || !response?.logs) return;
            response.logs.forEach(entry => addLogEntry(entry.message, entry.level));
        });

        // Poll for status
        updateServerStatus();
        setInterval(updateServerStatus, 2000);
    });
});

function setupEventListeners() {
    platformSelect.addEventListener('change', handlePlatformChange);
    deviceSelect.addEventListener('change', handleDeviceChange);
    connectBtn.addEventListener('click', handleConnect);
    serverBtn.addEventListener('click', handleServerToggle);
    settingsLink.addEventListener('click', handleSettings);

    const feedbackLink = document.getElementById('feedback-link');
    if (feedbackLink) {
        feedbackLink.addEventListener('click', handleFeedback);
    }

    logsToggle.addEventListener('click', toggleLogs);

    // Open logs in new tab
    if (openLogsBtn) {
        openLogsBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent toggle from firing
            openLogsInNewTab();
        });
    }

    // Error modal listeners
    if (errorModalClose) {
        errorModalClose.addEventListener('click', hideErrorModal);
    }
    if (errorHelpBtn) {
        errorHelpBtn.addEventListener('click', (e) => {
            LocatorLensAnalytics.trackEvent('startup_error_help_clicked', { surface: 'popup' });
            handleSettings(e);
        });
    }
    // Close modal when clicking outside
    if (errorModal) {
        errorModal.addEventListener('click', (e) => {
            if (e.target === errorModal) {
                hideErrorModal();
            }
        });
    }

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'server-log') {
            addLogEntry(message.message, message.level);
        } else if (message.type === 'server-start-error') {
            handleServerStartError(message.errors);
        } else if (message.type === 'device-connection-result') {
            if (message.success) {
                showError('');
            } else {
                showError(`Connection failed: ${message.error}`);
                resetConnectButton();
            }
        } else if (message.type === 'server-status') {
            serverStatus = message.status || { backend: false, appium: false };
            renderServerStatus();
        }
    });
}

function toggleLogs() {
    logsContent.classList.toggle('visible');
    logsToggle.classList.toggle('expanded');
    LocatorLensAnalytics.trackEvent('logs_panel_toggled', {
        surface: 'popup',
        expanded: logsContent.classList.contains('visible')
    });
}

function addLogEntry(message, level = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${level}`;
    entry.textContent = message;
    // Check scroll position BEFORE appending (allow 20px threshold)
    const threshold = 20;
    const wasAtBottom = logsContent.scrollHeight - logsContent.scrollTop <= logsContent.clientHeight + threshold;

    logsContent.appendChild(entry);

    // Auto-scroll only if user was already at the bottom
    if (wasAtBottom) {
        logsContent.scrollTop = logsContent.scrollHeight;
    }

    // Keep only last 100 entries
    while (logsContent.children.length > 100) {
        logsContent.removeChild(logsContent.firstChild);
    }
}

function handleSettings(e) {
    e.preventDefault();
    LocatorLensAnalytics.trackEvent('settings_opened', { surface: 'popup' });
    // For now, just show an alert or open a placeholder options page
    // Since we don't have an options page yet, let's just show a message
    // or we could create a simple options.html
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('options.html'));
    }
}

function handleFeedback(e) {
    e.preventDefault();
    LocatorLensAnalytics.trackEvent('feedback_opened', { surface: 'popup' });
    chrome.tabs.create({ url: chrome.runtime.getURL('feedback.html') });
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
    const action = isRunning ? 'stop' : 'start';

    LocatorLensAnalytics.trackEvent(`server_${action}_clicked`, { surface: 'popup' });

    console.log('[Popup] Server button clicked, current status:', serverStatus);
    console.log('[Popup] Sending command:', command);

    serverBtn.disabled = true;
    serverBtn.textContent = isRunning ? 'Stopping...' : 'Starting...';

    chrome.runtime.sendMessage({ type: command }, (response) => {
        console.log('[Popup] Received response:', response);
        console.log('[Popup] Chrome runtime error:', chrome.runtime.lastError);

        serverBtn.disabled = false;
        if (response && response.success) {
            LocatorLensAnalytics.trackEvent(`server_${action}_succeeded`, { surface: 'popup' });
            // Status update will happen via polling/message
            setTimeout(updateServerStatus, 1000);
        } else {
            const errorMsg = response?.error || chrome.runtime.lastError?.message || 'Unknown error';
            console.error('[Popup] Server toggle failed:', errorMsg);
            LocatorLensAnalytics.trackEvent(`server_${action}_failed`, {
                surface: 'popup',
                error_code: chrome.runtime.lastError ? 'runtime_error' : 'server_command_failed'
            });
            if (isSetupRequiredError({ error: errorMsg, code: response?.code })) {
                showErrorModal([{ error: errorMsg, code: response?.code }]);
                return;
            }
            showError(`Failed to ${isRunning ? 'stop' : 'start'} server: ${errorMsg}`);
        }
    });
}

let healthCheckRetries = 0;
const MAX_HEALTH_RETRIES = 5;

async function checkBackendStatus() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        const data = await response.json();

        healthCheckRetries = 0; // Reset on success

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
        healthCheckRetries++;
        if (healthCheckRetries <= MAX_HEALTH_RETRIES) {
            // Backend might be starting up, retry silently
            console.log(`Backend health check failed (attempt ${healthCheckRetries}/${MAX_HEALTH_RETRIES})`);
        } else {
            showError('Backend server is not responding. It may still be starting up.');
        }
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

    LocatorLensAnalytics.trackEvent('platform_selected', {
        surface: 'popup',
        platform: selectedPlatform
    });

    deviceSelect.disabled = true;
    deviceSelect.innerHTML = '<option value="">Loading devices...</option>';
    connectBtn.disabled = true;

    try {
        const response = await fetch(`${BACKEND_URL}/api/devices/${selectedPlatform}`);
        const data = await response.json();

        if (data.success) {
            devices = data.devices;
            populateDeviceDropdown(devices);
            LocatorLensAnalytics.trackEvent('devices_loaded', {
                surface: 'popup',
                platform: selectedPlatform,
                result: 'success',
                device_count: devices.length
            });
        } else {
            showError(`Failed to fetch devices: ${data.error}`);
            deviceSelect.innerHTML = '<option value="">No devices found</option>';
            LocatorLensAnalytics.trackEvent('devices_loaded', {
                surface: 'popup',
                platform: selectedPlatform,
                result: 'failed',
                error_code: 'backend_error'
            });
        }
    } catch (error) {
        showError(`Error fetching devices: ${error.message}`);
        deviceSelect.innerHTML = '<option value="">Error loading devices</option>';
        LocatorLensAnalytics.trackEvent('devices_loaded', {
            surface: 'popup',
            platform: selectedPlatform,
            result: 'failed',
            error_code: 'network_error'
        });
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
        LocatorLensAnalytics.trackEvent('device_selected', {
            surface: 'popup',
            platform: selectedDevice.platform || selectedPlatform
        });
    }
}

async function handleConnect() {
    if (!selectedDevice) return;

    LocatorLensAnalytics.trackEvent('device_connect_clicked', {
        surface: 'popup',
        platform: selectedDevice.platform || selectedPlatform
    });

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
            LocatorLensAnalytics.trackEvent('device_connect_failed', {
                surface: 'popup',
                platform: selectedDevice.platform || selectedPlatform,
                error_code: 'request_failed'
            });
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

function openLogsInNewTab() {
    // Request background script to open/focus logs tab
    LocatorLensAnalytics.trackEvent('logs_tab_opened', { surface: 'popup' });
    chrome.runtime.sendMessage({ type: 'open-logs-tab' });
}

// Error Modal Functions
function isSetupRequiredError(error) {
    return error?.code === 'COMPANION_SETUP_REQUIRED' ||
        error?.code === 'NATIVE_HOST_ERROR' ||
        error?.error?.includes('auto setup installer') ||
        error?.error?.includes('native host');
}

function showErrorModal(errors) {
    if (!errorModal || !errorModalBody) return;

    // Clear previous errors
    errorModalBody.innerHTML = '';
    const isSetupRequired = errors.some(isSetupRequiredError);

    if (errorModalTitle) {
        errorModalTitle.textContent = isSetupRequired ? 'One-Time Setup Needed' : 'Setup Information';
    }
    if (errorHelpBtn) {
        errorHelpBtn.textContent = isSetupRequired ? 'Set Up Companion' : 'Open Settings';
    }

    if (isSetupRequired) {
        const setupMessage = document.createElement('div');
        setupMessage.className = 'error-item';
        setupMessage.innerHTML = `
            <div class="error-server">LocatorLens is ready.</div>
            <div class="error-text">Install the local companion once to start servers and connect your devices.</div>
        `;
        errorModalBody.appendChild(setupMessage);
        errorModal.classList.remove('hidden');
        return;
    }

    // Add each error
    errors.forEach(error => {
        const errorItem = document.createElement('div');
        errorItem.className = 'error-item';

        const serverName = document.createElement('div');
        serverName.className = 'error-server';
        serverName.textContent = error.server ? `${error.server} needs attention:` : 'Needs attention:';

        const errorText = document.createElement('div');
        errorText.className = 'error-text';
        errorText.textContent = error.error;

        errorItem.appendChild(serverName);
        errorItem.appendChild(errorText);
        errorModalBody.appendChild(errorItem);
    });

    // Show modal
    errorModal.classList.remove('hidden');
}

function hideErrorModal() {
    if (errorModal) {
        errorModal.classList.add('hidden');
        LocatorLensAnalytics.trackEvent('startup_error_closed', { surface: 'popup' });
    }
}

function handleServerStartError(errors) {
    LocatorLensAnalytics.trackEvent('startup_error_viewed', {
        surface: 'popup',
        error_count: errors.length
    });

    // Auto-expand logs section to show error details
    if (!logsContent.classList.contains('visible')) {
        logsContent.classList.add('visible');
        logsToggle.classList.add('expanded');
    }

    // Show error modal
    showErrorModal(errors);
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
