(function () {
    const ANALYTICS_ENDPOINT = 'https://locatorlens.com/api/analytics';
    const SESSION_EXPIRATION_IN_MIN = 30;
    const DEFAULT_ENGAGEMENT_TIME_IN_MSEC = 100;

    function getRandomId() {
        const bytes = new Uint32Array(2);
        crypto.getRandomValues(bytes);
        return `${bytes[0]}${bytes[1]}`.slice(0, 10);
    }

    async function getOrCreateClientId() {
        const result = await chrome.storage.local.get('analyticsClientId');
        if (result.analyticsClientId) return result.analyticsClientId;

        const clientId = `${getRandomId()}.${Math.floor(Date.now() / 1000)}`;
        await chrome.storage.local.set({ analyticsClientId: clientId });
        return clientId;
    }

    async function getOrCreateSessionId() {
        const now = Date.now();
        let { analyticsSession } = await chrome.storage.session.get('analyticsSession');

        if (analyticsSession?.timestamp) {
            const durationInMin = (now - Number(analyticsSession.timestamp)) / 60000;
            if (durationInMin <= SESSION_EXPIRATION_IN_MIN) {
                analyticsSession.timestamp = now;
                await chrome.storage.session.set({ analyticsSession });
                return analyticsSession.session_id;
            }
        }

        analyticsSession = {
            session_id: String(now),
            timestamp: now
        };
        await chrome.storage.session.set({ analyticsSession });
        return analyticsSession.session_id;
    }

    function normalizeEventName(name) {
        const normalized = String(name || '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
        return /^[a-zA-Z]/.test(normalized) ? normalized : 'extension_event';
    }

    function sanitizeParams(params = {}) {
        const sanitized = {};
        for (const [key, value] of Object.entries(params)) {
            if (value == null) continue;
            const cleanKey = String(key).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
            if (!cleanKey || cleanKey.startsWith('_')) continue;

            if (typeof value === 'number' || typeof value === 'boolean') {
                sanitized[cleanKey] = value;
            } else {
                sanitized[cleanKey] = String(value).slice(0, 100);
            }
        }
        return sanitized;
    }

    async function trackEvent(name, params = {}) {
        try {
            const manifest = chrome.runtime.getManifest();
            const eventParams = {
                session_id: await getOrCreateSessionId(),
                engagement_time_msec: DEFAULT_ENGAGEMENT_TIME_IN_MSEC,
                app_version: manifest.version,
                ...sanitizeParams(params)
            };

            await fetch(ANALYTICS_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: await getOrCreateClientId(),
                    events: [
                        {
                            name: normalizeEventName(name),
                            params: eventParams
                        }
                    ]
                })
            });
        } catch (error) {
            console.debug('Analytics event skipped:', error.message);
        }
    }

    function trackPageView(surface, title) {
        const pageLocation = typeof document === 'undefined' ? chrome.runtime.getURL('background.js') : document.location.href;
        return trackEvent('page_view', {
            surface,
            page_title: title || surface,
            page_location: pageLocation
        });
    }

    globalThis.LocatorLensAnalytics = {
        trackEvent,
        trackPageView
    };
})();
