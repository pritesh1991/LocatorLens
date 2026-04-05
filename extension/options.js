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

async function downloadInstaller(filename) {
    const status = document.getElementById('download-status');
    const extensionId = chrome.runtime.id;

    try {
        // Fetch installer template and launcher.js in parallel
        const [installerResp, launcherResp] = await Promise.all([
            fetch(chrome.runtime.getURL(`installers/${filename}`)),
            fetch(chrome.runtime.getURL('installers/launcher.js'))
        ]);
        let content = await installerResp.text();
        const launcherJS = await launcherResp.text();
        const b64 = btoa(launcherJS);

        // Bake extension ID
        content = content
            .replace(/set "EXTENSION_ID=[^"]*"/, `set "EXTENSION_ID=${extensionId}"`)
            .replace(/^EXTENSION_ID="[^"]*"/m, `EXTENSION_ID="${extensionId}"`);

        // Embed launcher.js into the installer (base64, decoded by Node.js at install time)
        if (filename.endsWith('.bat')) {
            const lines = b64.match(/.{1,76}/g) || [];
            let embed = `> "%TEMP%\\ll_launcher_b64.txt" (\r\n`;
            for (const line of lines) embed += `echo.${line}\r\n`;
            embed += `)\r\n`;
            embed += `node -e "var fs=require('fs');var b=fs.readFileSync(process.env.TEMP+'/ll_launcher_b64.txt','utf8').replace(/\\s/g,'');fs.writeFileSync(process.argv[1],Buffer.from(b,'base64'))" "%NATIVE_HOST_DIR%\\launcher.js"\r\n`;
            embed += `del "%TEMP%\\ll_launcher_b64.txt" >nul 2>&1\r\n`;
            embed += `echo   OK Embedded launcher.js`;
            content = content.replace(':: __EMBEDDED_LAUNCHER_JS__', embed);
        } else {
            let embed = `cat > "$NATIVE_HOST_DIR/launcher.js" << 'LAUNCHER_EMBEDDED_EOF'\n`;
            embed += launcherJS;
            if (!launcherJS.endsWith('\n')) embed += '\n';
            embed += `LAUNCHER_EMBEDDED_EOF\n`;
            embed += `chmod +x "$NATIVE_HOST_DIR/launcher.js"\n`;
            embed += `echo "  OK Embedded launcher.js"`;
            content = content.replace('# __EMBEDDED_LAUNCHER_JS__', embed);
        }

        // Download single self-contained installer
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

        if (status) {
            status.textContent = `Downloaded ${filename} — run it to complete setup.`;
            setTimeout(() => { status.textContent = ''; }, 6000);
        }
    } catch (e) {
        if (status) status.textContent = 'Download failed. Try again.';
    }
}

async function checkBackendStatus() {
    const resultEl = document.getElementById('check-result');
    resultEl.innerHTML = '<span style="color:#64748b;">Checking...</span>';

    const port = document.getElementById('backend-port').value || 8765;
    const checks = [];

    // Check backend server
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const resp = await fetch(`http://localhost:${port}/health`, { signal: controller.signal });
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
