document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupTabs();
    document.getElementById('save-btn').addEventListener('click', saveSettings);
    document.getElementById('download-mac')?.addEventListener('click', () => downloadInstaller('install_host.sh'));
    document.getElementById('download-windows')?.addEventListener('click', () => downloadInstaller('install_host.bat'));
    document.getElementById('check-backend-btn')?.addEventListener('click', checkBackendStatus);
});

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${tab}`)?.classList.add('active');
        });
    });

    // Auto-detect platform to show relevant tab
    const isWindows = navigator.userAgentData?.platform === 'Windows' ||
        navigator.platform?.includes('Win');
    if (isWindows) {
        document.querySelector('[data-tab="windows"]')?.click();
    }
}

function downloadInstaller(filename) {
    const url = chrome.runtime.getURL(`installers/${filename}`);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const status = document.getElementById('download-status');
    if (status) {
        status.textContent = `Downloaded ${filename} — check your Downloads folder.`;
        setTimeout(() => { status.textContent = ''; }, 6000);
    }
}

async function checkBackendStatus() {
    const resultEl = document.getElementById('check-result');
    resultEl.innerHTML = '<span style="color:#64748b;">Checking...</span>';

    const checks = [];

    // Check backend server
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const resp = await fetch('http://localhost:8765/health', { signal: controller.signal });
        clearTimeout(timeout);
        const data = await resp.json();

        checks.push({ label: 'Backend server', ok: data.status === 'ok' });
        checks.push({ label: 'ADB (Android)', ok: data.adbAvailable, warn: !data.adbAvailable });
        checks.push({ label: 'iOS tools (Xcode)', ok: data.iosToolsAvailable, warn: !data.iosToolsAvailable });
    } catch (e) {
        checks.push({ label: 'Backend server', ok: false, msg: 'Not running — click "Start Servers" in the popup first' });
    }

    resultEl.innerHTML = checks.map(c => `
        <div class="status-item">
            <span class="dot ${c.ok ? 'ok' : c.warn ? 'warn' : 'err'}"></span>
            <span>${c.label}${c.msg ? ` — <span style="color:#64748b">${c.msg}</span>` : ''}</span>
        </div>
    `).join('');
}

function loadSettings() {
    chrome.storage.sync.get({ backendPort: 8765, appiumUrl: 'http://localhost:4723', fpsLimit: 3 }, (items) => {
        document.getElementById('backend-port').value = items.backendPort;
        document.getElementById('appium-url').value = items.appiumUrl;
        document.getElementById('fps-limit').value = items.fpsLimit;
    });
}

function saveSettings() {
    const backendPort = document.getElementById('backend-port').value;
    const appiumUrl = document.getElementById('appium-url').value;
    const fpsLimit = document.getElementById('fps-limit').value;

    chrome.storage.sync.set({ backendPort, appiumUrl, fpsLimit }, () => {
        const btn = document.getElementById('save-btn');
        const orig = btn.textContent;
        btn.textContent = 'Saved!';
        setTimeout(() => { btn.textContent = orig; }, 1500);
    });
}
