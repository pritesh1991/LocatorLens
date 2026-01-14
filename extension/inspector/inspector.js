const BACKEND_URL = 'http://localhost:8765';
const WS_URL = 'ws://localhost:8765';

// State
let ws = null;
let sessionInfo = null;
let currentPageSource = null;
let currentXmlDoc = null; // Cache parsed XML
let selectedElement = null;
let isElementLocked = false; // Lock selection after click
let isLoadingPageSource = false; // Prevent simultaneous loads
let isInteractMode = false; // Toggle between inspect and interact modes
let fpsCounter = 0;
let lastFpsUpdate = Date.now();
let coordinateScale = 1.0; // Scale factor between Screenshot Pixels and XML Points (e.g. 3.0 for iPhone Pro)

// DOM Elements
const deviceNameEl = document.getElementById('device-name');
const modeToggleBtn = document.getElementById('mode-toggle-btn');
const refreshBtn = document.getElementById('refresh-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const screenImage = document.getElementById('screen-image');
const screenLoading = document.getElementById('screen-loading');
const fpsIndicator = document.getElementById('fps-indicator');
const sourceTree = document.getElementById('source-tree');
const sourceLoading = document.getElementById('source-loading');
const elementDetails = document.getElementById('element-details');
const connectionDot = document.getElementById('connection-dot');
const connectionStatus = document.getElementById('connection-status');
const elementCount = document.getElementById('element-count');
const searchInput = document.getElementById('search-input');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const moonIcon = document.getElementById('moon-icon');
const sunIcon = document.getElementById('sun-icon');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadTheme();
    await loadSession();
    setupEventListeners();
    connectWebSocket();
});

async function loadTheme() {
    const storage = await chrome.storage.local.get('theme');
    const theme = storage.theme || 'dark';

    if (theme === 'light') {
        document.body.classList.add('light-theme');
        moonIcon.style.display = 'none';
        sunIcon.style.display = 'block';
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');

    if (isLight) {
        moonIcon.style.display = 'none';
        sunIcon.style.display = 'block';
        chrome.storage.local.set({ theme: 'light' });
    } else {
        moonIcon.style.display = 'block';
        sunIcon.style.display = 'none';
        chrome.storage.local.set({ theme: 'dark' });
    }
}

async function loadSession() {
    const storage = await chrome.storage.local.get('activeSession');

    if (!storage.activeSession) {
        alert('No active session found. Please connect from the extension popup.');
        window.close();
        return;
    }

    sessionInfo = storage.activeSession;
    deviceNameEl.textContent = `${sessionInfo.device.name} (${sessionInfo.device.platform})`;
}

function setupEventListeners() {
    modeToggleBtn.addEventListener('click', toggleMode);
    themeToggleBtn.addEventListener('click', toggleTheme);
    refreshBtn.addEventListener('click', () => {
        // Add spinning animation to button
        refreshBtn.classList.add('spinning');
        refreshPageSource();
        // Fallback: stop spinning after 5s if no response
        setTimeout(() => refreshBtn.classList.remove('spinning'), 5000);
    });
    disconnectBtn.addEventListener('click', disconnect);
    searchInput.addEventListener('input', handleSearch);

    // Add click-to-inspect on screen mirror
    screenImage.addEventListener('click', handleScreenClick);
    screenImage.addEventListener('mousemove', handleScreenHover);
    screenImage.addEventListener('mouseleave', () => {
        // Keep the lock when leaving - don't change anything
        // This preserves the selected element for copying
    });

    screenImage.addEventListener('mouseenter', () => {
        // Unlock when re-entering screen to enable hovering
        if (isElementLocked) {
            isElementLocked = false;
            console.log('Selection unlocked on mouse re-enter');
        }
    });

    // Fix for race condition: Recalculate scale when image FIRST loads
    let imageInitialized = false;
    screenImage.onload = () => {
        if (!imageInitialized && currentXmlDoc) {
            imageInitialized = true;
            console.log('Image loaded first time, recalculating scale...');
            updatePageSource(currentPageSource); // Re-run logic with cached source
        }
    };

    screenImage.style.cursor = 'crosshair';

    // ESC key to unlock selection
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isElementLocked) {
            isElementLocked = false;
            clearElementHighlight();
            console.log('Selection unlocked');
        }
    });
}

function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
        startStreaming();
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        updateConnectionStatus(false);
    };
}

function handleWebSocketMessage(message) {
    // Filter messages for other devices (if multi-streaming)
    if (message.deviceId && sessionInfo && message.deviceId !== sessionInfo.device.id) {
        // console.log(`Ignoring message for device ${message.deviceId} (current: ${sessionInfo.device.id})`);
        return;
    }

    switch (message.type) {
        case 'connected':
            console.log('Backend connected:', message.message);
            break;

        case 'screenshot':
            updateScreenshot(message.data);
            break;

        case 'page-source':
            updatePageSource(message.data);
            break;

        case 'streaming-started':
            console.log(`Streaming started at ${message.fps} FPS`);
            break;

        case 'error':
            console.error('Backend error:', message.message);
            showNotification('Error: ' + message.message, 'error');
            break;
    }
}

function startStreaming() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
        type: 'start-streaming',
        platform: sessionInfo.device.platform,
        deviceId: sessionInfo.device.id,
        fps: 3
    }));

    // Also get initial page source
    refreshPageSource();
}

function updateScreenshot(base64Data) {
    const previousScreenshot = screenImage.src;
    screenImage.src = `data:image/png;base64,${base64Data}`;
    screenImage.classList.add('loaded');
    screenLoading.classList.add('hidden');

    // Update FPS counter
    fpsCounter++;
    const now = Date.now();
    if (now - lastFpsUpdate >= 1000) {
        fpsIndicator.textContent = `${fpsCounter} FPS`;
        fpsCounter = 0;
        lastFpsUpdate = now;
    }

    // Detect significant screen changes and show badge (don't auto-refresh)
    detectScreenChange();
}

// Offscreen canvas for comparing against last page source refresh
let pageSourceSnapshot = null;
let pageSourceSnapshotContext = null;

function detectScreenChange() {
    if (!screenImage.classList.contains('loaded')) return;
    if (!pageSourceSnapshot) return; // No snapshot yet = nothing to compare
    if (!screenImage.complete) return; // Wait for image to fully load

    try {
        const width = screenImage.naturalWidth;
        const height = screenImage.naturalHeight;

        if (!width || !height) return;

        // If dimensions changed, re-capture snapshot and force refresh
        if (pageSourceSnapshot.width !== width || pageSourceSnapshot.height !== height) {
            console.log('Screen dimensions changed, forcing page source refresh...');
            refreshPageSource(true);
            return;
        }

        // Compare current frame with snapshot from last page source refresh
        const currentCanvas = document.createElement('canvas');
        currentCanvas.width = width;
        currentCanvas.height = height;
        const currentCtx = currentCanvas.getContext('2d', { willReadFrequently: true });
        currentCtx.drawImage(screenImage, 0, 0);

        const currentData = currentCtx.getImageData(0, 0, width, height).data;
        const snapshotData = pageSourceSnapshotContext.getImageData(0, 0, width, height).data;

        let diffPixels = 0;
        const sampledPixels = Math.floor(width * height / 10); // We sample every 10th pixel
        const threshold = 30; // Pixel color difference threshold

        // Check every 10th pixel for performance
        for (let i = 0; i < currentData.length; i += 40) {
            const rDiff = Math.abs(currentData[i] - snapshotData[i]);
            const gDiff = Math.abs(currentData[i + 1] - snapshotData[i + 1]);
            const bDiff = Math.abs(currentData[i + 2] - snapshotData[i + 2]);

            if (rDiff + gDiff + bDiff > threshold) {
                diffPixels++;
            }
        }

        // If > 5% of sampled pixels changed since last page source, auto-refresh
        if (diffPixels > sampledPixels * 0.05) {
            console.log(`Significant screen change detected (${diffPixels}/${sampledPixels} pixels), auto-refreshing...`);
            refreshPageSource(true); // Silent refresh (won't show loading spinner)
        }

    } catch (e) {
        console.warn('Screen diff error:', e);
    }
}

// Take a snapshot when page source is refreshed
function capturePageSourceSnapshot() {
    if (!screenImage.classList.contains('loaded')) return;
    if (!screenImage.complete) return;

    const width = screenImage.naturalWidth;
    const height = screenImage.naturalHeight;

    if (!width || !height) return;

    pageSourceSnapshot = document.createElement('canvas');
    pageSourceSnapshot.width = width;
    pageSourceSnapshot.height = height;
    pageSourceSnapshotContext = pageSourceSnapshot.getContext('2d', { willReadFrequently: true });
    pageSourceSnapshotContext.drawImage(screenImage, 0, 0);

    console.log('Captured page source snapshot for change detection');
}

function showStaleIndicator() {
    // Add a badge/glow to refresh button to indicate stale data
    refreshBtn.classList.add('stale');
    refreshBtn.title = '⚠️ Screen changed - Click to refresh page source';
}

function hideStaleIndicator() {
    refreshBtn.classList.remove('stale');
    refreshBtn.title = 'Refresh Page Source';
}

async function sendTap(x, y) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!sessionInfo || !sessionInfo.device) return;

    console.log(`Sending tap: (${x}, ${y}) to device ${sessionInfo.device.id}`);

    try {
        // Send tap command via backend API
        await fetch(`${BACKEND_URL}/api/tap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: sessionInfo.device.id,
                x,
                y
            })
        });

        // Force a refresh after tap
        setTimeout(() => refreshPageSource(true), 1000); // Wait 1s for animation

    } catch (error) {
        console.error('Tap failed:', error);
        showNotification('Tap failed: ' + error.message, 'error');
    }
}

function toggleMode() {
    isInteractMode = !isInteractMode;

    const inspectIcon = document.getElementById('inspect-icon');
    const interactIcon = document.getElementById('interact-icon');
    const modeLabel = document.getElementById('mode-label');

    if (isInteractMode) {
        // Switch to interact mode
        modeToggleBtn.classList.add('active');
        inspectIcon.style.display = 'none';
        interactIcon.style.display = 'block';
        modeLabel.textContent = 'Interact';
        screenImage.style.cursor = 'pointer';
        clearElementHighlight();
        isElementLocked = false;
        showNotification('Interact Mode: Click to tap, Drag to scroll', 'info');
    } else {
        // Switch to inspect mode
        modeToggleBtn.classList.remove('active');
        inspectIcon.style.display = 'block';
        interactIcon.style.display = 'none';
        modeLabel.textContent = 'Inspect';
        screenImage.style.cursor = 'crosshair';
        showNotification('Inspect Mode: Click to select elements', 'info');
    }
}

async function handleScreenClick(event) {
    console.log('Screen clicked!', { mode: isInteractMode ? 'interact' : 'inspect', currentPageSource: !!currentPageSource, currentXmlDoc: !!currentXmlDoc });

    // Get click coordinates relative to image
    const rect = screenImage.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Calculate actual pixel coordinates on the screenshot image
    const scaleX = screenImage.naturalWidth / rect.width;
    const scaleY = screenImage.naturalHeight / rect.height;

    const imageX = Math.round(clickX * scaleX);
    const imageY = Math.round(clickY * scaleY);

    console.log(`Click at display: (${clickX}, ${clickY}) → image: (${imageX}, ${imageY})`);

    // For XML search, we need coordinates in "points" (which might differ from pixels on Retina)
    const deviceX = imageX / coordinateScale;
    const deviceY = imageY / coordinateScale;

    console.log(`Device Search Coords: (${deviceX}, ${deviceY}) (Scale: ${coordinateScale})`);

    if (isInteractMode) {
        // Interact mode: Send tap to device (WDA expects points usually, or pixels?)
        // WDA usually handles scaling automatically, or expects points.
        // Let's send points (deviceX/Y)
        await sendTap(deviceX, deviceY);
        return;
    }

    // Inspect mode: Select element
    if (!currentPageSource || !currentXmlDoc) {
        console.log('Page source not available, fetching...');
        showNotification('Fetching page source...', 'info');
        await refreshPageSource();

        // Wait a bit for the page source to arrive
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!currentPageSource || !currentXmlDoc) {
            showNotification('Please wait for page source to load, then try again', 'warning');
            return;
        }
    }

    // Lock the element selection on click
    isElementLocked = true;

    // Find element at these coordinates in page source
    findElementAtCoordinates(deviceX, deviceY, true); // true = isClick
}

function handleScreenHover(event) {
    // Don't change selection if locked
    if (isElementLocked) return;

    if (!currentPageSource || !currentXmlDoc) return;

    // Get coordinates (same logic as click)
    const rect = screenImage.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const scaleX = screenImage.naturalWidth / rect.width;
    const scaleY = screenImage.naturalHeight / rect.height;

    const imageX = Math.round(clickX * scaleX);
    const imageY = Math.round(clickY * scaleY);

    const deviceX = imageX / coordinateScale;
    const deviceY = imageY / coordinateScale;

    // Find element without selecting it permanently
    findElementAtCoordinates(deviceX, deviceY, false);
}

function findElementAtCoordinates(x, y, isClick = false) {
    console.log(`findElementAtCoordinates called: (${x}, ${y}), isClick: ${isClick}`);

    if (!currentXmlDoc) {
        console.error('currentXmlDoc is null!');
        showNotification('Page source not loaded', 'error');
        return;
    }

    const xmlDoc = currentXmlDoc;
    // console.log('XML Doc root:', xmlDoc.documentElement.tagName);

    let foundElement = null;
    let smallestArea = Infinity;
    let elementsChecked = 0;

    // Find the smallest element that contains the click point
    function traverseElement(element) {
        elementsChecked++;
        const bounds = element.getAttribute('bounds');
        let x1, y1, x2, y2;

        if (bounds) {
            // Android format: [x1,y1][x2,y2]
            const match = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
            if (match) {
                [_, x1, y1, x2, y2] = match.map(Number);
            }
        } else if (element.getAttribute('x') && element.getAttribute('width')) {
            // iOS format: x, y, width, height
            x1 = parseFloat(element.getAttribute('x'));
            y1 = parseFloat(element.getAttribute('y'));
            const w = parseFloat(element.getAttribute('width'));
            const h = parseFloat(element.getAttribute('height'));
            x2 = x1 + w;
            y2 = y1 + h;
        }

        if (x1 !== undefined) {
            // Check if point is inside bounds
            if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
                const area = (x2 - x1) * (y2 - y1);

                // Heuristic: Prefer smallest area.
                // If areas are equal, prefer elements that are 'visible' or 'enabled' or have a name/label
                let isBetter = false;

                if (foundElement === null) {
                    isBetter = true;
                } else if (area < smallestArea) {
                    isBetter = true;
                } else if (area === smallestArea) {
                    // Tie-breaker
                    const currentHasName = !!(element.getAttribute('name') || element.getAttribute('label'));
                    const foundHasName = !!(foundElement.getAttribute('name') || foundElement.getAttribute('label'));

                    if (currentHasName && !foundHasName) isBetter = true;
                }

                if (isBetter) {
                    smallestArea = area;
                    foundElement = element;
                    // console.log(`Found better candidate: ${element.tagName}, area: ${area}`);
                }
            }
        }

        // Check children
        if (element.childNodes) {
            for (let i = 0; i < element.childNodes.length; i++) {
                const child = element.childNodes[i];
                if (child.nodeType === 1) {
                    traverseElement(child);
                }
            }
        }
    }

    traverseElement(xmlDoc.documentElement);
    // console.log(`Checked ${elementsChecked} elements, found: ${!!foundElement}`);

    if (foundElement) {
        console.log('Selected element:', foundElement.tagName);

        // Draw highlight on screen
        drawElementHighlight(foundElement, isClick);

        // Highlight this element in the tree
        highlightElementInTree(foundElement);

        // Extract and display details
        const attributes = LocatorGenerator.extractAttributes(foundElement);
        const xpath = LocatorGenerator.generateXPath(foundElement);

        selectedElement = {
            tagName: foundElement.tagName,
            attributes,
            xpath
        };

        displayElementDetails(selectedElement);

        // Only show notification on click to avoid spamming
        if (isClick) {
            showNotification(`Element found: ${foundElement.tagName}`, 'success');
        }
    } else {
        // console.warn('No element found at coordinates');
        // Clear highlight if no element found
        clearElementHighlight();

        if (isClick) {
            showNotification('No element found at this location', 'error');
        }
    }
}

function drawElementHighlight(xmlElement, isClick = false) {
    let x1, y1, x2, y2;
    let needsScaling = false; // Android bounds are in pixels, iOS are in points

    // Get coords in POINTS (iOS) or PIXELS (Android)
    const bounds = xmlElement.getAttribute('bounds');
    if (bounds) {
        // Android - bounds are already in pixels, no scaling needed
        const match = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
        if (match) {
            [_, x1, y1, x2, y2] = match.map(Number);
            needsScaling = false;
        }
    } else if (xmlElement.getAttribute('x')) {
        // iOS - coordinates are in points, need to scale to pixels
        x1 = parseFloat(xmlElement.getAttribute('x'));
        y1 = parseFloat(xmlElement.getAttribute('y'));
        const w = parseFloat(xmlElement.getAttribute('width'));
        const h = parseFloat(xmlElement.getAttribute('height'));
        x2 = x1 + w;
        y2 = y1 + h;
        needsScaling = true;
    }

    if (x1 === undefined) return;

    // Convert Points -> Pixels (only for iOS)
    if (needsScaling) {
        x1 *= coordinateScale;
        y1 *= coordinateScale;
        x2 *= coordinateScale;
        y2 *= coordinateScale;
    }

    // Get the screen image dimensions
    const rect = screenImage.getBoundingClientRect();
    const scaleX = rect.width / screenImage.naturalWidth;
    const scaleY = rect.height / screenImage.naturalHeight;

    // Scale coordinates to display size
    const displayX = x1 * scaleX;
    const displayY = y1 * scaleY;
    const displayWidth = (x2 - x1) * scaleX;
    const displayHeight = (y2 - y1) * scaleY;

    // Clear previous highlight
    clearElementHighlight();

    // Create highlight box
    const highlight = document.createElement('div');
    highlight.className = `element-highlight ${isClick ? '' : 'hover'}`;
    highlight.style.left = `${displayX}px`;
    highlight.style.top = `${displayY}px`;
    highlight.style.width = `${displayWidth}px`;
    highlight.style.height = `${displayHeight}px`;

    // Get screen overlay
    const screenOverlay = document.getElementById('screen-overlay');
    const container = document.getElementById('screen-container');
    const imageRect = screenImage.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    screenOverlay.style.position = 'absolute';
    screenOverlay.style.left = `${imageRect.left - containerRect.left}px`;
    screenOverlay.style.top = `${imageRect.top - containerRect.top}px`;
    screenOverlay.style.width = `${imageRect.width}px`;
    screenOverlay.style.height = `${imageRect.height}px`;

    screenOverlay.appendChild(highlight);
}

function clearElementHighlight() {
    const screenOverlay = document.getElementById('screen-overlay');
    if (screenOverlay) screenOverlay.innerHTML = '';
}

function highlightElementInTree(xmlElement) {
    // This is a simplified version - in production you'd need better element matching
    const resourceId = xmlElement.getAttribute('resource-id');
    const text = xmlElement.getAttribute('text');
    const contentDesc = xmlElement.getAttribute('content-desc');
    const name = xmlElement.getAttribute('name');
    const label = xmlElement.getAttribute('label');

    // Find matching node in tree
    let found = false;
    document.querySelectorAll('.tree-node-header').forEach(header => {
        if (found) return; // Optimization

        const headerText = header.textContent;

        const matches =
            (resourceId && headerText.includes(resourceId)) ||
            (text && headerText.includes(text)) ||
            (contentDesc && headerText.includes(contentDesc)) ||
            (name && headerText.includes(name)) ||
            (label && headerText.includes(label));

        if (matches) {
            // Clear previous selections
            document.querySelectorAll('.tree-node-header.selected').forEach(el => {
                el.classList.remove('selected');
            });

            // Select this one
            header.classList.add('selected');
            header.scrollIntoView({ behavior: 'smooth', block: 'center' });
            found = true;
        }
    });
}


async function refreshPageSource(silent = false) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Prevent multiple simultaneous requests
    if (isLoadingPageSource) {
        console.log('Page source already loading, skipping...');
        return;
    }

    isLoadingPageSource = true;
    if (!silent) {
        sourceLoading.classList.remove('hidden');
    }

    ws.send(JSON.stringify({
        type: 'get-page-source'
    }));
}

function updatePageSource(xmlString) {
    currentPageSource = xmlString;
    isLoadingPageSource = false; // Reset loading flag
    sourceLoading.classList.add('hidden'); // Always hide on complete
    refreshBtn.classList.remove('spinning'); // Stop button animation
    hideStaleIndicator(); // Clear stale indicator since we just refreshed
    capturePageSourceSnapshot(); // Save screen snapshot for change detection

    // Parse XML once
    const parser = new DOMParser();
    currentXmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const xmlDoc = currentXmlDoc;

    console.log('Page source updated, root element:', xmlDoc.documentElement.tagName);

    // Calculate Coordinate Scale (Retina Detection)
    // ---------------------------------------------
    // Image Pixel Width vs XML Point Width
    if (screenImage && screenImage.naturalWidth > 0) {
        const screenWidth = screenImage.naturalWidth;
        let xmlMaxWidth = 0;

        // Scan for XCUIElementTypeApplication specifically first
        let appWidth = 0;
        const appEl = xmlDoc.querySelector('XCUIElementTypeApplication');
        if (appEl) {
            if (appEl.getAttribute('bounds')) {
                const match = appEl.getAttribute('bounds').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
                if (match) {
                    const [_, x1, y1, x2, y2] = match.map(Number);
                    appWidth = x2 - x1;
                }
            } else if (appEl.getAttribute('width')) {
                appWidth = parseFloat(appEl.getAttribute('width'));
            }
        }

        let xmlReferenceWidth = appWidth;

        // If no app element (rare), fallback to max width scanning but ignore potentially huge overlays
        // unless they are the only thing there.
        if (xmlReferenceWidth === 0) {
            console.log('No Application element found, scanning all elements...');
            const allElements = xmlDoc.getElementsByTagName('*');
            let maxW = 0;
            for (let i = 0; i < allElements.length; i++) {
                const el = allElements[i];
                // Skip StatusBars or other system overlays which might be in native pixels
                if (el.tagName.includes('StatusBar')) continue;

                let w = 0;
                if (el.getAttribute('width')) {
                    w = parseFloat(el.getAttribute('width'));
                }
                if (w > maxW) maxW = w;
            }
            xmlReferenceWidth = maxW;
        }

        console.log(`Scaling Check: ImageWidth=${screenWidth}, XMLRefWidth=${xmlReferenceWidth}`);

        if (xmlReferenceWidth > 0) {
            // If XML width is significantly smaller than image width, it's likely Points vs Pixels
            // e.g. Image 1206, XML 402 -> Scale 3.0
            const ratio = screenWidth / xmlReferenceWidth;

            if (Math.abs(ratio - 1.0) < 0.1) {
                coordinateScale = 1.0;
            } else if (ratio > 1.5) {
                // It's likely a retina scale (2.0, 3.0 etc)
                coordinateScale = Math.round(ratio * 10) / 10; // Round to 1 decimal
            } else {
                coordinateScale = 1.0;
            }
            console.log(`Scale: ${coordinateScale} (Calculated from ratio ${ratio})`);
        } else {
            coordinateScale = 1.0;
        }
    }

    // Count elements
    const allElements = xmlDoc.getElementsByTagName('*');
    elementCount.textContent = `${allElements.length} elements`;

    // Render tree
    sourceTree.innerHTML = '';
    renderTree(xmlDoc.documentElement, sourceTree);
}

function renderTree(xmlNode, container, level = 0) {
    // container.innerHTML = ''; // removed to avoid clearing siblings in recursion

    if (!xmlNode || !xmlNode.tagName) return;

    const treeDiv = document.createElement('div');
    treeDiv.className = 'tree-node';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'tree-node-header';
    headerDiv.dataset.level = level;

    const hasChildren = xmlNode.children && xmlNode.children.length > 0;

    // Toggle icon
    if (hasChildren) {
        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        toggle.innerHTML = '▶';
        headerDiv.appendChild(toggle);
    } else {
        const spacer = document.createElement('span');
        spacer.style.width = '14px';
        headerDiv.appendChild(spacer);
    }

    // Tag name
    const tagSpan = document.createElement('span');
    tagSpan.className = 'tree-tag';
    tagSpan.textContent = `<${xmlNode.tagName}`;
    headerDiv.appendChild(tagSpan);

    // Key attributes
    const keyAttrs = getKeyAttributes(xmlNode);
    if (keyAttrs.length > 0) {
        const attrSpan = document.createElement('span');
        attrSpan.innerHTML = ' ' + keyAttrs.map(attr =>
            `<span class="tree-attr-name">${attr.name}</span>=<span class="tree-attr-value">"${attr.value}"</span>`
        ).join(' ');
        headerDiv.appendChild(attrSpan);
    }

    const closingTag = document.createElement('span');
    closingTag.className = 'tree-tag';
    closingTag.textContent = hasChildren ? '>' : '/>';
    headerDiv.appendChild(closingTag);

    let childrenDiv = null;

    // Click handler
    headerDiv.addEventListener('click', (e) => {
        e.stopPropagation();

        if (hasChildren && e.target.classList.contains('tree-toggle')) {
            if (childrenDiv) {
                toggleNode(headerDiv, childrenDiv);
            }
        } else {
            selectElement(xmlNode, headerDiv);
        }
    });

    // Hover handler - highlight on screen when hovering tree node
    headerDiv.addEventListener('mouseenter', () => {
        if (!isElementLocked) {
            drawElementHighlight(xmlNode, false);
        }
    });

    treeDiv.appendChild(headerDiv);

    // Children
    if (hasChildren) {
        childrenDiv = document.createElement('div');
        childrenDiv.className = 'tree-children';

        Array.from(xmlNode.children).forEach(child => {
            if (child.nodeType === 1) { // Only render Element nodes
                renderTree(child, childrenDiv, level + 1);
            }
        });

        treeDiv.appendChild(childrenDiv);
    }

    container.appendChild(treeDiv);
}

// Helper to get valid element children
function getElementChildren(node) {
    if (!node.children) return [];
    return Array.from(node.children).filter(child => child.nodeType === 1); // 1 = ELEMENT_NODE
}

function getKeyAttributes(xmlNode) {
    const keyAttrNames = [
        'resource-id', 'content-desc', 'text', 'name', 'label', 'value',
        'class', 'id', 'type', 'enabled', 'clickable'
    ];

    const attrs = [];
    if (xmlNode.attributes) {
        for (let i = 0; i < xmlNode.attributes.length; i++) {
            const attr = xmlNode.attributes[i];
            if (keyAttrNames.includes(attr.name) && attr.value) {
                attrs.push({ name: attr.name, value: attr.value });
            }
        }
    }

    return attrs.slice(0, 3); // Limit to 3 key attributes
}

function toggleNode(headerDiv, childrenDiv) {
    const toggle = headerDiv.querySelector('.tree-toggle');

    if (childrenDiv.classList.contains('expanded')) {
        childrenDiv.classList.remove('expanded');
        toggle.classList.remove('expanded');
    } else {
        childrenDiv.classList.add('expanded');
        toggle.classList.add('expanded');
    }
}

function selectElement(xmlNode, headerDiv) {
    // Remove previous selection
    document.querySelectorAll('.tree-node-header.selected').forEach(el => {
        el.classList.remove('selected');
    });

    // Add new selection
    headerDiv.classList.add('selected');

    // Extract attributes
    const attributes = LocatorGenerator.extractAttributes(xmlNode);
    const xpath = LocatorGenerator.generateXPath(xmlNode);

    selectedElement = {
        tagName: xmlNode.tagName,
        attributes,
        xpath
    };

    // Generate and display locators
    displayElementDetails(selectedElement);
}

function displayElementDetails(element) {
    console.log('displayElementDetails called with:', element);

    try {
        if (!sessionInfo || !sessionInfo.device) {
            console.error('Session info missing');
            elementDetails.innerHTML = '<div class="error-state">Session info missing</div>';
            return;
        }

        console.log('Generating locators for platform:', sessionInfo.device.platform);
        const locators = LocatorGenerator.generateLocators(element, sessionInfo.device.platform);
        console.log('Generated locators:', locators);

        let html = '';

        // Attributes section
        html += '<div class="detail-section">';
        html += '<h3>Attributes</h3>';

        if (Object.keys(element.attributes).length === 0) {
            html += '<p>No attributes available</p>';
        } else {
            for (const [key, value] of Object.entries(element.attributes)) {
                if (value) {
                    html += `
                <div class="detail-row">
                  <div class="detail-label">${key}</div>
                  <div class="detail-value">${escapeHtml(value)}</div>
                </div>
              `;
                }
            }
        }
        html += '</div>';

        // Locators section
        html += '<div class="detail-section">';
        html += '<h3>Locator Strategies</h3>';

        if (locators.length === 0) {
            html += '<p class="empty-state">No locators generated for this element.</p>';
        } else {
            locators.forEach((locator, index) => {
                html += `
              <div class="locator-item">
                <div class="locator-header">
                  <span class="locator-type">${locator.type}</span>
                  <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(locator.code)}', this)">
                    Copy
                  </button>
                </div>
                <div class="locator-value">${escapeHtml(locator.code)}</div>
              </div>
            `;
            });
        }
        html += '</div>';

        // Appium Methods Preview Section
        const methods = LocatorGenerator.generateAppiumMethods(element, sessionInfo.device.platform);
        if (methods && methods.length > 0) {
            html += '<div class="detail-section">';
            html += '<h3>Appium Methods Preview</h3>';

            html += `
            <div class="method-preview-container">
                <div class="method-control">
                    <label for="appium-method-select">Method:</label>
                    <select id="appium-method-select" class="method-select">
                        ${methods.map((m, i) => `<option value="${i}">${m.name}</option>`).join('')}
                    </select>
                </div>
                <div class="method-result">
                    <div class="result-label">Return Value:</div>
                    <div class="result-value-box">
                        <code id="method-result-value">${methods[0].value}</code>
                        <button class="copy-icon-btn" title="Copy Value" onclick="copyToClipboard(document.getElementById('method-result-value').textContent, this)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>`;
            html += '</div>';
        }

        elementDetails.innerHTML = html;

        // Add event listener for dropdown change
        const selectEl = document.getElementById('appium-method-select');
        if (selectEl) {
            selectEl.addEventListener('change', (e) => {
                const index = e.target.value;
                const selectedMethod = methods[index];
                document.getElementById('method-result-value').textContent = selectedMethod.value;
            });
        }

        console.log('Element details updated successfully');
    } catch (error) {
        console.error('Error displaying details:', error);
        elementDetails.innerHTML = `<div class="error-state">Error generating locators: ${error.message}</div>`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.copyToClipboard = async (text, button) => {
    try {
        // Unescape HTML entities first
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        const plainText = textarea.value;

        // Try modern clipboard API first
        let copied = false;
        try {
            await navigator.clipboard.writeText(plainText);
            copied = true;
        } catch (clipboardError) {
            console.log('Clipboard API failed, using fallback:', clipboardError);

            // Fallback: use execCommand (works in extensions)
            const textArea = document.createElement('textarea');
            textArea.value = plainText;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                copied = document.execCommand('copy');
            } catch (err) {
                console.error('execCommand failed:', err);
            }

            document.body.removeChild(textArea);
        }

        if (copied) {
            // Visual feedback
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.style.background = '#10b981';
            button.style.borderColor = '#10b981';
            button.style.color = 'white';

            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
                button.style.borderColor = '';
                button.style.color = '';
            }, 2000);
        } else {
            showNotification('Failed to copy to clipboard', 'error');
        }
    } catch (error) {
        console.error('Failed to copy:', error);
        showNotification('Copy failed: ' + error.message, 'error');
    }
};

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();

    if (!searchTerm) {
        // Reset: Show all, but don't change expansion state
        document.querySelectorAll('.tree-node-header').forEach(el => {
            el.style.display = '';
        });
        return;
    }

    // 1. Hide everything first
    document.querySelectorAll('.tree-node-header').forEach(el => el.style.display = 'none');

    // 2. Find matches
    document.querySelectorAll('.tree-node-header').forEach(el => {
        const text = el.textContent.toLowerCase();

        if (text.includes(searchTerm)) {
            // Show match
            el.style.display = '';

            // 3. Walk up to reveal and expand ancestors
            let parent = el.parentElement; // .tree-node
            while (parent) {
                // If it's a children container, expand it
                if (parent.classList.contains('tree-children')) {
                    parent.classList.add('expanded');
                }

                // If it's a node wrapper (ancestor node)
                if (parent.classList.contains('tree-node')) {
                    const header = parent.querySelector('.tree-node-header');
                    if (header) {
                        header.style.display = ''; // Show ancestor

                        // Expand ancestor's toggle arrow
                        const toggle = header.querySelector('.tree-toggle');
                        if (toggle) toggle.classList.add('expanded');
                    }
                }

                parent = parent.parentElement;
            }
        }
    });
}

function updateConnectionStatus(connected) {
    if (connected) {
        connectionDot.classList.add('connected');
        connectionStatus.textContent = 'Connected';
    } else {
        connectionDot.classList.remove('connected');
        connectionStatus.textContent = 'Disconnected';
    }
}

async function disconnect() {
    try {
        const deviceId = sessionInfo?.device?.id;

        // Stop streaming
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stop-streaming' }));
            ws.close();
        }

        // Close Appium session for THIS device only
        await fetch(`${BACKEND_URL}/api/session/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId })
        });

        // Clear storage
        await chrome.storage.local.remove('activeSession');

        // Close window
        window.close();
    } catch (error) {
        console.error('Error disconnecting:', error);
    }
}

function showNotification(message, type = 'info') {
    // Simple notification - you can enhance this
    console.log(`[${type.toUpperCase()}] ${message}`);
}
