const DEFAULT_SCREEN_CAPTURE_FPS = 3;
const MIN_SCREEN_CAPTURE_FPS = 1;
const MAX_SCREEN_CAPTURE_FPS = 30;

function normalizeScreenFps(value, fallback = DEFAULT_SCREEN_CAPTURE_FPS) {
    const parsed = value === '' || value == null ? NaN : Number(value);
    if (Number.isFinite(parsed)) {
        return Math.min(MAX_SCREEN_CAPTURE_FPS, Math.max(MIN_SCREEN_CAPTURE_FPS, Math.round(parsed)));
    }

    const parsedFallback = fallback === '' || fallback == null ? NaN : Number(fallback);
    if (Number.isFinite(parsedFallback)) {
        return Math.min(MAX_SCREEN_CAPTURE_FPS, Math.max(MIN_SCREEN_CAPTURE_FPS, Math.round(parsedFallback)));
    }

    return DEFAULT_SCREEN_CAPTURE_FPS;
}

module.exports = {
    DEFAULT_SCREEN_CAPTURE_FPS,
    MIN_SCREEN_CAPTURE_FPS,
    MAX_SCREEN_CAPTURE_FPS,
    normalizeScreenFps
};
