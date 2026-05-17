#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = require(path.join(root, 'package.json')).version || '1.0.0';
const filename = `locatorlens-companion-v${version}.zip`;
const distDir = path.join(root, 'dist');
const stagingDir = path.join(os.tmpdir(), `locatorlens-companion-${Date.now()}`);
const stagingRoot = path.join(stagingDir, `locatorlens-companion-v${version}`);
const outputPath = path.join(distDir, filename);
const packagedOutputPath = path.join(root, 'extension', 'installers', filename);
const metadataPath = path.join(root, 'extension', 'installers', 'companion-release.json');

function copyFile(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function copyDir(src, dest, ignored = () => false) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (ignored(srcPath, entry)) continue;
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath, ignored);
        } else if (entry.isFile()) {
            copyFile(srcPath, destPath);
        }
    }
}

function sha256(filePath) {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

function zipDirectory(sourceDir, zipPath) {
    fs.rmSync(zipPath, { force: true });

    if (process.platform === 'win32') {
        execFileSync('powershell', [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            `Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force`
        ], { stdio: 'inherit' });
        return;
    }

    execFileSync('zip', ['-qr', zipPath, '.'], {
        cwd: sourceDir,
        stdio: 'inherit'
    });
}

fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingRoot, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });

copyDir(path.join(root, 'backend'), path.join(stagingRoot, 'backend'), (srcPath, entry) => {
    return entry.name === 'node_modules' ||
        entry.name === '.DS_Store' ||
        entry.name.endsWith('.log') ||
        entry.name.startsWith('temp_');
});
copyDir(path.join(root, 'native-host'), path.join(stagingRoot, 'native-host'), (srcPath, entry) => {
    return entry.name === '.DS_Store' || entry.name.endsWith('.log');
});
copyFile(path.join(root, 'README.md'), path.join(stagingRoot, 'README.md'));
copyFile(path.join(root, 'PRIVACY_POLICY.md'), path.join(stagingRoot, 'PRIVACY_POLICY.md'));
copyFile(path.join(root, 'LICENSE'), path.join(stagingRoot, 'LICENSE'));
copyFile(path.join(root, 'NOTICE.md'), path.join(stagingRoot, 'NOTICE.md'));

zipDirectory(stagingRoot, outputPath);
const digest = sha256(outputPath);
copyFile(outputPath, packagedOutputPath);
const metadata = fs.existsSync(metadataPath)
    ? JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
    : {};
metadata.version = version;
metadata.filename = filename;
metadata.url = process.env.LOCATORLENS_COMPANION_URL || '';
metadata.extensionPath = `installers/${filename}`;
metadata.sha256 = digest;
fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 4)}\n`);

fs.rmSync(stagingDir, { recursive: true, force: true });

console.log(`Created ${path.relative(root, outputPath)}`);
console.log(`Copied ${path.relative(root, packagedOutputPath)}`);
console.log(`SHA-256 ${digest}`);
console.log(`Updated ${path.relative(root, metadataPath)}`);
