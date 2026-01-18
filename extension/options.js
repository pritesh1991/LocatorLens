document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    document.getElementById('save-btn').addEventListener('click', saveSettings);

    // Download button handlers
    document.getElementById('download-mac')?.addEventListener('click', () => downloadInstaller('install_host.sh'));
    document.getElementById('download-windows')?.addEventListener('click', () => downloadInstaller('install_host.bat'));
});

function downloadInstaller(filename) {
    const url = chrome.runtime.getURL(`installers/${filename}`);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Show success message
    const status = document.getElementById('download-status');
    if (status) {
        status.textContent = `✓ Downloaded ${filename}! Check your Downloads folder.`;
        setTimeout(() => {
            status.textContent = '';
        }, 5000);
    }
}

function loadSettings() {
    chrome.storage.sync.get({
        backendPort: 8765,
        appiumUrl: 'http://localhost:4723',
        fpsLimit: 3
    }, (items) => {
        document.getElementById('backend-port').value = items.backendPort;
        document.getElementById('appium-url').value = items.appiumUrl;
        document.getElementById('fps-limit').value = items.fpsLimit;
    });
}

function saveSettings() {
    const backendPort = document.getElementById('backend-port').value;
    const appiumUrl = document.getElementById('appium-url').value;
    const fpsLimit = document.getElementById('fps-limit').value;

    chrome.storage.sync.set({
        backendPort,
        appiumUrl,
        fpsLimit
    }, () => {
        const btn = document.getElementById('save-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Saved!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1500);
    });
}
