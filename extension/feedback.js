const FEEDBACK_API_URL = 'https://locatorlens.com/api/feedback';

const form = document.getElementById('feedback-form');
const statusEl = document.getElementById('status');

LocatorLensAnalytics.trackPageView('feedback', 'LocatorLens Feedback');

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const feedbackType = document.getElementById('feedback-type').value;
    const message = document.getElementById('message').value.trim();
    const contact = document.getElementById('contact').value.trim();
    const platform = document.getElementById('platform').value.trim();
    const diagnostics = document.getElementById('diagnostics').value.trim();

    if (!message) {
        LocatorLensAnalytics.trackEvent('feedback_submit_failed', {
            surface: 'feedback',
            feedback_type: feedbackType,
            error_code: 'message_required'
        });
        statusEl.textContent = 'Please add a message before sending.';
        return;
    }

    LocatorLensAnalytics.trackEvent('feedback_submit_clicked', {
        surface: 'feedback',
        feedback_type: feedbackType
    });

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    statusEl.textContent = 'Sending feedback...';

    try {
        const response = await fetch(FEEDBACK_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: 'chrome-extension-feedback-page',
                extensionId: chrome.runtime.id,
                extensionVersion: chrome.runtime.getManifest().version,
                feedbackType,
                message,
                contact,
                platform,
                diagnostics,
                userAgent: navigator.userAgent
            })
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'Could not send feedback right now.');
        }

        form.reset();
        statusEl.textContent = 'Thanks! Your feedback was sent.';
        LocatorLensAnalytics.trackEvent('feedback_submit_succeeded', {
            surface: 'feedback',
            feedback_type: feedbackType
        });
    } catch (error) {
        statusEl.textContent = error.message;
        LocatorLensAnalytics.trackEvent('feedback_submit_failed', {
            surface: 'feedback',
            feedback_type: feedbackType,
            error_code: 'send_failed'
        });
    } finally {
        submitButton.disabled = false;
    }
});
