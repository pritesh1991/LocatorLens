document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    document.getElementById('save-btn').addEventListener('click', saveSettings);
});

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
