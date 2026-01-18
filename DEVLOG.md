# Development Log - LocatorLens

## 2026-01-16 - Fixed Page Source Search and Element Tree Navigation

### The Change
Modified `inspector.js` and `inspector.css` to fix two critical bugs:
1. Search functionality now highlights matching elements and auto-selects first result
2. Element tree navigation now correctly expands to show exact clicked element path

**Files Modified:**
- `extension/inspector/inspector.js` - Added WeakMap-based element tracking, rewrote `highlightElementInTree()`, enhanced `handleSearch()`
- `extension/inspector/inspector.css` - Added `.search-match` styling with theme support

### The Reasoning

**Problem 1: Search didn't highlight matches**
The `handleSearch()` function filtered visible nodes but provided no visual feedback. Users couldn't tell which elements matched their query.

**Solution:** Added `.search-match` CSS class to matching nodes, auto-select first match, and scroll it into view.

**Problem 2: Element tree used unreliable attribute matching**
The old `highlightElementInTree()` searched for elements by matching text content against attributes like `resource-id`, `text`, etc. This failed when:
- Elements had no distinguishing attributes
- Multiple elements shared the same attribute values
- The tree wasn't expanded to the target element

**Solution:** Implemented a WeakMap to directly map XML elements to their DOM tree nodes. This provides:
- O(1) lookup performance (vs O(n) text search)
- 100% accurate element identification
- Automatic cleanup on page source refresh (WeakMap benefits)

### The Tech Debt
None. The WeakMap solution is production-ready and actually improves performance and reliability over the previous approach.

### Implementation Details
1. Added `elementToNodeMap` WeakMap and `nodeIdCounter` for unique element tracking
2. Modified `renderTree()` to store XML element → DOM node mappings on creation
3. Reset WeakMap on page source refresh to prevent stale references
4. Rewrote `highlightElementInTree()` to use direct element lookup and expand full parent path
5. Enhanced `handleSearch()` to add visual highlighting and auto-selection
6. Added `clearSearchHighlights()` helper to remove search highlights when clearing search
7. Added CSS for `.search-match` with proper theme support and combined state styling
8. **Fixed `selectElement()` to call `drawElementHighlight()` for bi-directional highlighting** (tree selection → screen highlight)
9. **Added stale state cleanup in `updatePageSource()`** - clears highlights, selections, search results, and element details when page source refreshes to prevent showing outdated elements

## 2026-01-16 - Added Element Match Count for Locators

### The Change
Added element match counting to show how many elements match each generated locator.

**Files Modified:**
- `extension/inspector/inspector.js` - Added `countMatchingElements()` function and updated locator display
- `extension/inspector/inspector.css` - Added styling for match count badges

### The Reasoning
Users need to know if a locator is unique (matches 1 element) or if it matches multiple elements. Non-unique locators can cause flaky tests by finding the wrong element.

**Solution:** For each generated locator, query the page source XML to count matching elements and display the count with visual indicators:
- Green badge with ✓ for unique locators (count = 1)
- Orange badge with ⚠ for non-unique locators (count > 1)

### Implementation Details
- Created `countMatchingElements()` with support for all locator strategies (ID, XPath, UiAutomator, Predicate, Class Chain, etc.)
- Uses `querySelectorAll` for attribute-based queries and `XPathResult` for XPath evaluation
- Parses UiAutomator and Predicate strings to extract the underlying selector
- Added color-coded badges showing count next to each locator

### The Tech Debt
None. The counting is done client-side on the already-loaded XML document, so there's no performance impact.

## 2026-01-18 - Added "Open in New Tab" Feature for Server Logs

### The Change
Implemented ability to open server logs in a dedicated full-page browser tab with filtering and clear functionality.

**Files Created:**
- `extension/logs.html` - Dedicated logs viewer page with header, filters, and scrollable content
- `extension/logs.css` - Dark theme styling matching extension design
- `extension/logs.js` - Controller for log display, filtering, and message handling

**Files Modified:**
- `extension/popup/popup.html` - Added "Open in New Tab" button to logs header
- `extension/popup/popup.css` - Styled button with hover reveal effect
- `extension/popup/popup.js` - Added `openLogsInNewTab()` function and event listener
- `extension/background.js` - Enhanced log routing, tab management, and history storage

### The Reasoning
The popup's collapsible log viewer is constrained by size, making it difficult to monitor server activity and debug issues. A dedicated full-page logs viewer provides:
- More screen real estate for reading logs
- Filter controls to focus on specific log levels
- Clear logs button for managing clutter
- Better UX for long debugging sessions

**Implementation Approach:**
- Created standalone logs page accessible via button in popup
- Background script tracks logs tab ID and routes messages to both popup and logs tab
- Stores recent 1000 logs in memory for initial load when tab opens
- Tab focus behavior: clicking button again focuses existing tab instead of creating new one
- Clean separation: logs viewer is independent, doesn't affect popup functionality

### The Tech Debt
None currently, but potential future enhancements:
- Add log export functionality (download as txt/json)
- Add search within logs
- Add log level statistics/summary

## 2026-01-18 - Fixed Copy Button Not Working

### The Change
Fixed non-functional copy buttons on locator elements by replacing CSP-violating inline onclick handlers with event delegation.

**File Modified:**
- `extension/inspector/inspector.js` - Replaced inline onclick with data attributes, added event delegation listener

### The Reasoning
The copy buttons were completely non-functional. Investigation revealed that inline `onclick` attributes were being silently blocked by Chrome Extension Content Security Policy (CSP). CSP prohibits inline event handlers for security reasons.

**Solution:** 
- Removed all inline `onclick="copyToClipboard(...)"` handlers
- Added data attributes (`data-copy-text`, `data-copy-source`) to store copy targets
- Implemented single event delegation listener on `elementDetails` container that:
  - Captures clicks on copy buttons using `.closest()` 
  - Reads text from data attributes
  - Calls existing `copyToClipboard()` function

### Implementation Details
- Locator copy buttons use `data-copy-text` to store the locator code
- Method result copy buttons use `data-copy-source` to reference the element ID containing the value
- Event listener attached once to container, handles all copy buttons dynamically (better performance)
- Preserves existing visual feedback (green "Copied!" state)

### The Tech Debt
None. Event delegation is the recommended approach for dynamic content and is more performant than individual handlers.

## 2026-01-18 - Removed Unused "Disconnected" Status Element

### The Change
Removed dead code: unused "Disconnected" status element and related CSS from popup.

**Files Modified:**
- `extension/popup/popup.html` - Removed status div (lines 41-44)
- `extension/popup/popup.css` - Removed `.status`, `.status-connected`, `.status-disconnected` styles

### The Reasoning
The element was never referenced in JavaScript, always hidden, and redundant since server status is already displayed via Backend/Appium status dots in the Server Control Panel.

### The Tech Debt
None. This was pure code cleanup.

## 2026-01-18 - Fixed Copy Button Content Truncation

### The Change
Fixed copy button to copy full locator content instead of truncated/escaped version.

**File Modified:**
- `extension/inspector/inspector.js` - Changed data attribute to store raw text, removed double-escaping

### The Reasoning
The copy button was not copying the complete locator code shown in the UI. The issue was double-escaping:
1. Locator code was escaped with `escapeHtml()` when stored in `data-copy-text` attribute
2. When copying, the code attempted to unescape using `innerHTML`, which could fail or produce incorrect results
3. Special characters and long strings were being corrupted

**Solution:** 
- Store raw unescaped text in data attribute (only escaping quotes with `&quot;` for HTML attribute safety)
- Display uses `escapeHtml()` for safe HTML rendering
- Copy retrieves raw text directly from attribute - no unescaping needed

### The Tech Debt
None. This is the correct approach - separate concerns of HTML safety vs clipboard content.
