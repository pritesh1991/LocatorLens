// State
let logs = [];
let currentFilter = 'all';

// DOM Elements
const logsContent = document.getElementById('logs-content');
const emptyState = document.getElementById('empty-state');
const clearLogsBtn = document.getElementById('clear-logs-btn');
const filterBtns = document.querySelectorAll('.filter-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadInitialLogs();
});

function setupEventListeners() {
    // Clear logs button
    clearLogsBtn.addEventListener('click', clearLogs);

    // Filter buttons
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            setFilter(filter);
        });
    });

    // Listen for log messages from background script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'server-log') {
            addLogEntry(message.message, message.level, message.timestamp);
        } else if (message.type === 'initial-logs') {
            // Load existing logs when tab opens
            message.logs.forEach(log => {
                addLogEntry(log.message, log.level, log.timestamp, false);
            });
        }
    });
}

function loadInitialLogs() {
    // Request existing logs from background script
    chrome.runtime.sendMessage({ type: 'request-logs' });
}

function addLogEntry(message, level = 'info', timestamp = null, autoScroll = true) {
    // Hide empty state
    if (emptyState && !emptyState.classList.contains('hidden')) {
        emptyState.classList.add('hidden');
    }

    // Create timestamp
    const time = timestamp ? new Date(timestamp) : new Date();
    const timeStr = time.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // Create log entry
    const entry = document.createElement('div');
    entry.className = `log-entry log-${level}`;
    entry.innerHTML = `
    <span class="log-timestamp">${timeStr}</span>
    <span class="log-message">${escapeHtml(message)}</span>
  `;

    // Store in memory
    logs.push({ message, level, timestamp: time, element: entry });

    // Apply current filter
    if (currentFilter !== 'all' && level !== currentFilter) {
        entry.classList.add('hidden');
    }

    // Add to DOM
    logsContent.appendChild(entry);

    // Auto-scroll to bottom
    if (autoScroll) {
        logsContent.scrollTop = logsContent.scrollHeight;
    }

    // Keep only last 1000 entries
    if (logs.length > 1000) {
        const removed = logs.shift();
        if (removed.element && removed.element.parentNode) {
            removed.element.parentNode.removeChild(removed.element);
        }
    }
}

function clearLogs() {
    logs = [];
    logsContent.innerHTML = '';

    // Show empty state again
    const emptyStateEl = document.createElement('div');
    emptyStateEl.className = 'empty-state';
    emptyStateEl.id = 'empty-state';
    emptyStateEl.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <p>No logs yet</p>
    <span>Logs will appear here when servers are running</span>
  `;
    logsContent.appendChild(emptyStateEl);
}

function setFilter(filter) {
    currentFilter = filter;

    // Update active button
    filterBtns.forEach(btn => {
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Apply filter to logs
    logs.forEach(log => {
        if (filter === 'all' || log.level === filter) {
            log.element.classList.remove('hidden');
        } else {
            log.element.classList.add('hidden');
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
