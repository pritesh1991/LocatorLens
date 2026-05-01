document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupTabs();
    document.getElementById('save-btn').addEventListener('click', saveSettings);
    document.getElementById('download-mac')?.addEventListener('click', () => downloadInstaller('install_host.sh', 'install_locatorlens.sh'));
    document.getElementById('download-windows')?.addEventListener('click', () => downloadInstaller('install_host.bat', 'install_locatorlens.bat'));
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

async function loadCompanionRelease() {
    const response = await fetch(chrome.runtime.getURL('installers/companion-release.json'));
    if (!response.ok) {
        throw new Error('Companion release metadata missing');
    }
    return response.json();
}

function applyInstallerTemplate(content, extensionId, release, companionEmbedded) {
    return content
        .replace(/set "EXTENSION_ID=[^"]*"/, `set "EXTENSION_ID=${extensionId}"`)
        .replace(/^EXTENSION_ID="[^"]*"/m, `EXTENSION_ID="${extensionId}"`)
        .replace(/set "COMPANION_EMBEDDED=[^"]*"/, `set "COMPANION_EMBEDDED=${companionEmbedded ? '1' : '0'}"`)
        .replace(/^COMPANION_EMBEDDED="[^"]*"/m, `COMPANION_EMBEDDED="${companionEmbedded ? '1' : '0'}"`)
        .replaceAll('__EXTENSION_ID__', extensionId)
        .replaceAll('__COMPANION_VERSION__', release.version)
        .replaceAll('__COMPANION_URL__', release.url)
        .replaceAll('__COMPANION_SHA256__', release.sha256);
}

function splitBase64(value, width = 76) {
    return value.match(new RegExp(`.{1,${width}}`, 'g')) || [];
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

async function loadCompanionArchive(release) {
    const archivePath = release.extensionPath || `installers/${release.filename}`;
    const response = await fetch(chrome.runtime.getURL(archivePath));
    if (!response.ok) {
        throw new Error(`Bundled companion archive missing: ${archivePath}`);
    }
    return arrayBufferToBase64(await response.arrayBuffer());
}

function embedCompanionForShell(content, companionB64) {
    const lines = splitBase64(companionB64);
    let embed = `write_embedded_companion() {\n`;
    embed += `    local DEST="$1"\n`;
    embed += `    local B64_PATH="$DEST.b64"\n`;
    embed += `    cat > "$B64_PATH" << 'COMPANION_ZIP_B64_EOF'\n`;
    embed += `${lines.join('\n')}\n`;
    embed += `COMPANION_ZIP_B64_EOF\n`;
    embed += `    if base64 --decode < "$B64_PATH" > "$DEST" 2>/dev/null; then\n`;
    embed += `        rm -f "$B64_PATH"\n`;
    embed += `        return 0\n`;
    embed += `    fi\n`;
    embed += `    if base64 -D < "$B64_PATH" > "$DEST" 2>/dev/null; then\n`;
    embed += `        rm -f "$B64_PATH"\n`;
    embed += `        return 0\n`;
    embed += `    fi\n`;
    embed += `    rm -f "$B64_PATH"\n`;
    embed += `    echo "  ERROR: Could not decode bundled companion archive."\n`;
    embed += `    exit 1\n`;
    embed += `}`;
    return content.replace(/write_embedded_companion\(\) \{[\s\S]*?\n\}\n\n# __EMBEDDED_COMPANION_ZIP__/, `${embed}\n`);
}

function embedCompanionForBatch(content, companionB64) {
    return content.replace(
        ':: __EMBEDDED_COMPANION_ZIP__',
        splitBase64(companionB64).map(line => `echo.${line}`).join('\r\n')
    );
}

async function downloadInstaller(filename, downloadName = filename) {
    const status = document.getElementById('download-status');
    const extensionId = chrome.runtime.id;

    try {
        const [installerResp, launcherResp, release] = await Promise.all([
            fetch(chrome.runtime.getURL(`installers/${filename}`)),
            fetch(chrome.runtime.getURL('installers/launcher.js')),
            loadCompanionRelease()
        ]);
        const companionB64 = await loadCompanionArchive(release);
        let content = await installerResp.text();
        const launcherJS = await launcherResp.text();

        content = applyInstallerTemplate(content, extensionId, release, true);

        // Embed launcher.js into the installer (base64, decoded by Node.js at install time).
        if (filename.endsWith('.bat')) {
            const lines = splitBase64(btoa(launcherJS));
            let embed = `> "%TEMP%\\ll_launcher_b64.txt" (\r\n`;
            for (const line of lines) embed += `echo.${line}\r\n`;
            embed += `)\r\n`;
            embed += `node -e "var fs=require('fs');var b=fs.readFileSync(process.env.TEMP+'/ll_launcher_b64.txt','utf8').replace(/\\s/g,'');fs.writeFileSync(process.argv[1],Buffer.from(b,'base64'))" "%NATIVE_HOST_DIR%\\launcher.js"\r\n`;
            embed += `del "%TEMP%\\ll_launcher_b64.txt" >nul 2>&1\r\n`;
            embed += `echo   OK Embedded launcher.js`;
            content = content.replace(':: __EMBEDDED_LAUNCHER_JS__', embed);
            content = embedCompanionForBatch(content, companionB64);
            content = content.replace(/\r?\n/g, '\r\n');
        } else if (filename.endsWith('.sh')) {
            // Keep launcher.js embedded as a fallback for local/dev installs.
            let embed = `cat > "$NATIVE_HOST_DIR/launcher.js" << 'LAUNCHER_EMBEDDED_EOF'\n`;
            embed += launcherJS;
            if (!launcherJS.endsWith('\n')) embed += '\n';
            embed += `LAUNCHER_EMBEDDED_EOF\n`;
            embed += `chmod +x "$NATIVE_HOST_DIR/launcher.js"\n`;
            embed += `echo "  OK Embedded launcher.js"`;
            content = content.replace('# __EMBEDDED_LAUNCHER_JS__', embed);
            content = embedCompanionForShell(content, companionB64);
        }

        // Download single self-contained installer
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

        if (status) {
            status.textContent = `Downloaded ${downloadName} — run it to complete setup.`;
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

    const setup = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'check-setup' }, (response) => {
            if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
                resolve(response || { success: false, error: 'No setup response' });
            }
        });
    });

    if (setup.success && setup.diagnostics) {
        const diag = setup.diagnostics;
        checks.push({ label: 'Native host', ok: setup.nativeHost });
        checks.push({ label: 'Backend installed', ok: diag.backendInstalled });
        checks.push({ label: 'Dependencies installed', ok: diag.dependenciesInstalled });
        checks.push({ label: 'Extension ID allowed', ok: diag.extensionAllowed });
    } else {
        checks.push({
            label: 'Native host',
            ok: false,
            msg: setup.error || 'Run the auto setup installer, then reload the extension'
        });
    }

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
