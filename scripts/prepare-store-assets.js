#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function loadSharp() {
    try {
        return require('sharp');
    } catch (rootError) {
        try {
            return require(path.join(__dirname, '..', 'backend', 'node_modules', 'sharp'));
        } catch (backendError) {
            throw new Error('sharp is required. Run "npm run install:backend" first.');
        }
    }
}

const sharp = loadSharp();
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'store-assets');
const screenshotsDir = path.join(root, 'docs', 'screenshots');
const iconPath = path.join(root, 'extension', 'icons', 'icon128.png');

const colors = {
    bg: '#10101d',
    panel: '#181827',
    panel2: '#1f2034',
    border: '#30314a',
    text: '#f4f5fb',
    muted: '#a8a9b8',
    purple: '#7c6df2',
    blue: '#4f7df7',
    green: '#08d19a',
    pink: '#ff77c8'
};

function esc(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function svgBuffer(svg) {
    return Buffer.from(svg);
}

function backgroundSvg(width, height, title, subtitle = '') {
    return svgBuffer(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${colors.bg}"/>
  <rect x="-180" y="-120" width="520" height="380" rx="160" fill="${colors.blue}" opacity="0.18"/>
  <rect x="${width - 420}" y="${height - 320}" width="520" height="360" rx="160" fill="${colors.purple}" opacity="0.16"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="${colors.border}" stroke-width="2"/>
  <text x="48" y="72" fill="${colors.text}" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800">${esc(title)}</text>
  ${subtitle ? `<text x="50" y="110" fill="${colors.muted}" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="500">${esc(subtitle)}</text>` : ''}
</svg>`);
}

async function pngBuffer(input, resizeOptions) {
    return sharp(input)
        .resize(resizeOptions)
        .flatten({ background: colors.bg })
        .ensureAlpha()
        .png()
        .toBuffer();
}

async function screenshotAsset({ input, output, title, subtitle, width = 1280, height = 800, imageBox }) {
    const canvas = sharp(backgroundSvg(width, height, title, subtitle));
    const box = imageBox || { left: 44, top: 132, width: width - 88, height: height - 176 };
    const image = await sharp(input)
        .resize(box.width, box.height, {
            fit: 'contain',
            position: 'center',
            background: colors.panel
        })
        .flatten({ background: colors.panel })
        .extend({
            top: 2,
            bottom: 2,
            left: 2,
            right: 2,
            background: colors.border
        })
        .png()
        .toBuffer();

    await canvas
        .composite([{ input: image, left: box.left, top: box.top }])
        .flatten({ background: colors.bg })
        .removeAlpha()
        .png({ compressionLevel: 9 })
        .toFile(output);
}

function logsSvg(width, height) {
    const lines = [
        ['[INFO]', '14:08:02', 'Native host launcher started'],
        ['[INFO]', '14:08:06', 'Received message: status'],
        ['[INFO]', '14:08:08', 'Received message: start'],
        ['[INFO]', '14:08:08', 'Starting Backend Server on port 8765'],
        ['[INFO]', '14:08:08', 'Backend started with PID 50754'],
        ['[INFO]', '14:08:08', 'Starting local Appium server on port 4723'],
        ['[INFO]', '14:08:08', 'Local Appium server started with PID 50758'],
        ['[INFO]', '14:08:09', 'Appium endpoint is ready'],
        ['[INFO]', '14:08:09', 'Android driver loaded successfully'],
        ['[INFO]', '14:08:10', 'iOS driver loaded successfully'],
        ['[INFO]', '14:08:10', 'Backend health check passed'],
        ['[INFO]', '14:08:10', 'Ready for device inspection']
    ];

    const rows = lines.map((line, index) => {
        const y = 158 + index * 42;
        return `
  <text x="54" y="${y}" fill="${colors.green}" font-family="SFMono-Regular, Menlo, Consolas, monospace" font-size="17" font-weight="800">${esc(line[0])}</text>
  <text x="132" y="${y}" fill="${colors.muted}" font-family="SFMono-Regular, Menlo, Consolas, monospace" font-size="17">${esc(line[1])}</text>
  <text x="224" y="${y}" fill="${colors.text}" font-family="SFMono-Regular, Menlo, Consolas, monospace" font-size="17">${esc(line[2])}</text>`;
    }).join('');

    return svgBuffer(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${colors.bg}"/>
  <rect x="0" y="0" width="${width}" height="92" fill="#19192b"/>
  <text x="70" y="55" fill="${colors.purple}" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800">LocatorLens Server Logs</text>
  <rect x="${width - 300}" y="22" width="56" height="44" rx="10" fill="${colors.purple}"/>
  <text x="${width - 280}" y="50" fill="#fff" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="800">All</text>
  <text x="${width - 218}" y="50" fill="${colors.muted}" font-family="Inter, Arial, sans-serif" font-size="16">Info</text>
  <text x="${width - 156}" y="50" fill="${colors.muted}" font-family="Inter, Arial, sans-serif" font-size="16">Warning</text>
  <text x="${width - 70}" y="50" fill="${colors.muted}" font-family="Inter, Arial, sans-serif" font-size="16">Error</text>
  <rect x="32" y="116" width="${width - 64}" height="${height - 150}" rx="18" fill="#050507" stroke="${colors.border}"/>
  ${rows}
  <rect x="32" y="${height - 38}" width="${width - 64}" height="6" rx="3" fill="${colors.green}"/>
</svg>`);
}

async function logsAsset(output) {
    await sharp(logsSvg(1280, 800))
        .flatten({ background: colors.bg })
        .removeAlpha()
        .png({ compressionLevel: 9 })
        .toFile(output);
}

async function smallPromo(output) {
    const icon = await sharp(iconPath).resize(48, 48).png().toBuffer();
    const popup = await sharp(path.join(screenshotsDir, 'extension-home.png'))
        .resize(92, 136, { fit: 'contain', background: colors.panel })
        .flatten({ background: colors.panel })
        .png()
        .toBuffer();

    const base = sharp(svgBuffer(`
<svg width="440" height="280" viewBox="0 0 440 280" xmlns="http://www.w3.org/2000/svg">
  <rect width="440" height="280" fill="${colors.bg}"/>
  <rect x="-80" y="-54" width="230" height="180" rx="82" fill="${colors.blue}" opacity="0.20"/>
  <rect x="262" y="130" width="230" height="190" rx="90" fill="${colors.purple}" opacity="0.24"/>
  <text x="92" y="58" fill="${colors.text}" font-family="Inter, Arial, sans-serif" font-size="27" font-weight="850">LocatorLens</text>
  <text x="30" y="104" fill="${colors.muted}" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="650">Chrome extension for</text>
  <text x="30" y="124" fill="${colors.muted}" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="650">Appium locator workflows</text>
  <rect x="30" y="164" width="128" height="38" rx="10" fill="${colors.purple}"/>
  <text x="52" y="189" fill="#fff" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="800">Live mirror</text>
  <rect x="30" y="214" width="154" height="38" rx="10" fill="${colors.panel2}" stroke="${colors.border}"/>
  <text x="51" y="239" fill="${colors.text}" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="800">Copy locators</text>
  <rect x="288" y="38" width="118" height="160" rx="18" fill="${colors.panel2}" stroke="${colors.border}" stroke-width="2"/>
  <rect x="301" y="50" width="92" height="136" rx="11" fill="${colors.panel}"/>
  <path d="M224 158 C248 158 252 92 286 92" fill="none" stroke="${colors.green}" stroke-width="3" stroke-linecap="round"/>
  <path d="M210 212 C244 212 252 176 286 176" fill="none" stroke="${colors.pink}" stroke-width="3" stroke-linecap="round"/>
</svg>`));

    await base
        .composite([
            { input: icon, left: 30, top: 24 },
            { input: popup, left: 301, top: 50 }
        ])
        .flatten({ background: colors.bg })
        .removeAlpha()
        .png({ compressionLevel: 9 })
        .toFile(output);
}

async function marqueePromo(output) {
    const icon = await sharp(iconPath).resize(60, 60).png().toBuffer();
    const inspector = await sharp(path.join(screenshotsDir, 'inspector-gmail.png'))
        .resize(650, 372, { fit: 'cover', position: 'left top' })
        .flatten({ background: colors.panel })
        .png()
        .toBuffer();
    const popup = await sharp(path.join(screenshotsDir, 'extension-home.png'))
        .resize(210, 308, { fit: 'contain', background: colors.panel })
        .flatten({ background: colors.panel })
        .png()
        .toBuffer();

    const base = sharp(svgBuffer(`
<svg width="1400" height="560" viewBox="0 0 1400 560" xmlns="http://www.w3.org/2000/svg">
  <rect width="1400" height="560" fill="${colors.bg}"/>
  <rect x="-140" y="-100" width="560" height="390" rx="180" fill="${colors.blue}" opacity="0.18"/>
  <rect x="910" y="230" width="650" height="430" rx="190" fill="${colors.purple}" opacity="0.20"/>
  <text x="196" y="168" fill="${colors.text}" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="850">LocatorLens</text>
  <text x="122" y="222" fill="${colors.muted}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600">Built for Appium locator workflows</text>
  <rect x="122" y="270" width="200" height="54" rx="13" fill="${colors.purple}"/>
  <text x="152" y="305" fill="#fff" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="850">Live mirror</text>
  <rect x="346" y="270" width="236" height="54" rx="13" fill="${colors.panel2}" stroke="${colors.border}"/>
  <text x="374" y="305" fill="${colors.text}" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800">Locator generator</text>
  <rect x="656" y="72" width="672" height="394" rx="24" fill="${colors.panel2}" stroke="${colors.border}" stroke-width="2"/>
  <rect x="1036" y="180" width="232" height="330" rx="24" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>
</svg>`));

    await base
        .composite([
            { input: icon, left: 122, top: 106 },
            { input: inspector, left: 668, top: 84 },
            { input: popup, left: 1048, top: 192 }
        ])
        .flatten({ background: colors.bg })
        .removeAlpha()
        .png({ compressionLevel: 9 })
        .toFile(output);
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });

    const tasks = [
        screenshotAsset({
            input: path.join(screenshotsDir, 'inspector-gmail.png'),
            output: path.join(outDir, 'screenshot-inspector-gmail-1280x800.png'),
            title: 'Inspect Any Mobile App',
            subtitle: 'Live screen mirror, XML tree, element details, and locators in one view'
        }),
        screenshotAsset({
            input: path.join(screenshotsDir, 'inspector-safari.png'),
            output: path.join(outDir, 'screenshot-inspector-safari-1280x800.png'),
            title: 'Generate Reliable Locators',
            subtitle: 'XPath, Resource ID, Accessibility ID, UIAutomator2, iOS Class Chain, and more'
        }),
        screenshotAsset({
            input: path.join(screenshotsDir, 'extension-home.png'),
            output: path.join(outDir, 'screenshot-extension-home-1280x800.png'),
            title: 'Start Servers From Chrome',
            subtitle: 'One setup flow for the local companion, backend, Appium, devices, and logs',
            imageBox: { left: 418, top: 126, width: 444, height: 636 }
        }),
        logsAsset(path.join(outDir, 'screenshot-server-logs-1280x800.png')),
        smallPromo(path.join(outDir, 'small-promo-440x280.png')),
        marqueePromo(path.join(outDir, 'marquee-promo-1400x560.png'))
    ];

    for (const task of tasks) {
        await task;
    }

    for (const file of fs.readdirSync(outDir).sort()) {
        const fullPath = path.join(outDir, file);
        const metadata = await sharp(fullPath).metadata();
        console.log(`${path.relative(root, fullPath)} ${metadata.width}x${metadata.height} alpha=${metadata.hasAlpha ? 'yes' : 'no'}`);
    }
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
