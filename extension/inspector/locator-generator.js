/**
 * Locator Generator Utility
 * Generates various locator strategies for mobile elements
 */

class LocatorGenerator {
    /**
     * Generate all possible locators for an element
     * @param {Object} element - Parsed element from page source
     * @param {string} platform - 'android' or 'ios'
     * @returns {Array} Array of locator objects
     */
    static generateLocators(element, platform) {
        const locators = [];

        if (platform === 'android') {
            locators.push(...this.generateAndroidLocators(element));
        } else if (platform === 'ios') {
            locators.push(...this.generateIOSLocators(element));
        }

        // Add common locators
        locators.push(...this.generateCommonLocators(element));

        return this.rankLocators(locators);
    }

    /**
     * Generate Android-specific locators
     */
    static generateAndroidLocators(element) {
        const locators = [];
        const attrs = element.attributes;

        // Resource ID
        if (attrs['resource-id']) {
            locators.push({
                type: 'Resource ID',
                strategy: 'id',
                value: attrs['resource-id'],
                code: `driver.findElement(By.id("${attrs['resource-id']}"))`,
                priority: 9
            });
        }

        // Content Description (Accessibility)
        if (attrs['content-desc']) {
            locators.push({
                type: 'Content Desc',
                strategy: 'accessibility id',
                value: attrs['content-desc'],
                code: `driver.findElement(MobileBy.AccessibilityId("${attrs['content-desc']}"))`,
                priority: 8
            });
        }

        // UiAutomator
        if (attrs['resource-id']) {
            const uiAutomator = `new UiSelector().resourceId("${attrs['resource-id']}")`;
            locators.push({
                type: 'UiAutomator (ID)',
                strategy: '-android uiautomator',
                value: uiAutomator,
                code: `driver.findElement(MobileBy.AndroidUIAutomator("${uiAutomator}"))`,
                priority: 7
            });
        }

        if (attrs.text) {
            const uiAutomator = `new UiSelector().text("${attrs.text}")`;
            locators.push({
                type: 'UiAutomator (Text)',
                strategy: '-android uiautomator',
                value: uiAutomator,
                code: `driver.findElement(MobileBy.AndroidUIAutomator("${uiAutomator}"))`,
                priority: 6
            });
        }

        return locators;
    }

    /**
   * Generate iOS-specific locators
   */
    static generateIOSLocators(element) {
        const locators = [];
        const attrs = element.attributes;

        // 1. Accessibility ID (Priority 9 - FASTEST for iOS)
        // Uses native accessibility framework, extremely fast (~50ms)
        if (attrs.name) {
            locators.push({
                type: 'Accessibility ID',
                strategy: 'accessibility id',
                value: attrs.name,
                code: `driver.findElement(MobileBy.AccessibilityId("${attrs.name}"))`,
                priority: 9
            });
        }

        // Also check 'label' attribute for accessibility
        if (attrs.label && attrs.label !== attrs.name) {
            locators.push({
                type: 'Accessibility ID (Label)',
                strategy: 'accessibility id',
                value: attrs.label,
                code: `driver.findElement(MobileBy.AccessibilityId("${attrs.label}"))`,
                priority: 9
            });
        }

        // 2. Predicate String - Name (Priority 8)
        // Native NSPredicate, very fast (~150ms)
        if (attrs.name) {
            const predicate = `name == "${attrs.name}"`;
            locators.push({
                type: 'Predicate (Name)',
                strategy: '-ios predicate string',
                value: predicate,
                code: `driver.findElement(MobileBy.iOSNsPredicateString("${predicate}"))`,
                priority: 8
            });
        }

        // 3. Predicate String - Label (Priority 8)
        if (attrs.label) {
            const predicate = `label == "${attrs.label}"`;
            locators.push({
                type: 'Predicate (Label)',
                strategy: '-ios predicate string',
                value: predicate,
                code: `driver.findElement(MobileBy.iOSNsPredicateString("${predicate}"))`,
                priority: 8
            });
        }

        // 4. Predicate String - Value (Priority 7)
        // Good for input fields and sliders
        if (attrs.value) {
            const predicate = `value == "${attrs.value}"`;
            locators.push({
                type: 'Predicate (Value)',
                strategy: '-ios predicate string',
                value: predicate,
                code: `driver.findElement(MobileBy.iOSNsPredicateString("${predicate}"))`,
                priority: 7
            });
        }

        // 5. Class Chain (Priority 7)
        // Fast iOS-specific selector (~80ms)
        if (attrs.type) {
            const classChain = `**/XCUIElementType${attrs.type}`;
            locators.push({
                type: 'Class Chain',
                strategy: '-ios class chain',
                value: classChain,
                code: `driver.findElement(MobileBy.iOSClassChain("${classChain}"))`,
                priority: 7
            });

            // Class Chain with name predicate (Priority 8) - More specific
            if (attrs.name) {
                const specificChain = `**/XCUIElementType${attrs.type}[\`name == "${attrs.name}"\`]`;
                locators.push({
                    type: 'Class Chain (Named)',
                    strategy: '-ios class chain',
                    value: specificChain,
                    code: `driver.findElement(MobileBy.iOSClassChain("${specificChain}"))`,
                    priority: 8
                });
            }
        }

        return locators;
    }

    /**
     * Generate common locators (XPath, Class Name)
     */
    static generateCommonLocators(element) {
        const locators = [];
        const attrs = element.attributes;

        // Class Name
        if (attrs.class) {
            locators.push({
                type: 'Class Name',
                strategy: 'class name',
                value: attrs.class,
                code: `driver.findElement(By.className("${attrs.class}"))`,
                priority: 4
            });
        }

        // XPath - Absolute
        if (element.xpath) {
            locators.push({
                type: 'XPath (Absolute)',
                strategy: 'xpath',
                value: element.xpath,
                code: `driver.findElement(By.xpath("${element.xpath}"))`,
                priority: 2
            });
        }

        // XPath - Relative by text
        if (attrs.text) {
            const xpath = `//*[@text="${attrs.text}"]`;
            locators.push({
                type: 'XPath (Text)',
                strategy: 'xpath',
                value: xpath,
                code: `driver.findElement(By.xpath("${xpath}"))`,
                priority: 6
            });
        }

        // XPath - Relative by resource-id
        if (attrs['resource-id']) {
            const xpath = `//*[@resource-id="${attrs['resource-id']}"]`;
            locators.push({
                type: 'XPath (Resource ID)',
                strategy: 'xpath',
                value: xpath,
                code: `driver.findElement(By.xpath("${xpath}"))`,
                priority: 7
            });
        }

        // XPath - Relative by name (iOS)
        if (attrs.name) {
            const xpath = `//*[@name="${attrs.name}"]`;
            locators.push({
                type: 'XPath (Name)',
                strategy: 'xpath',
                value: xpath,
                code: `driver.findElement(By.xpath("${xpath}"))`,
                priority: 7
            });
        }

        return locators;
    }

    /**
     * Rank locators by priority and reliability
     */
    static rankLocators(locators) {
        return locators.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Extract element attributes from XML node
     */
    static extractAttributes(xmlNode) {
        const attributes = {};

        if (xmlNode.attributes) {
            for (let i = 0; i < xmlNode.attributes.length; i++) {
                const attr = xmlNode.attributes[i];
                attributes[attr.name] = attr.value;
            }
        }

        return attributes;
    }

    /**
     * Generate XPath for element
     */
    static generateXPath(element, index = 0) {
        if (!element || !element.tagName) return '';

        let path = '';
        let currentElement = element;

        while (currentElement && currentElement.tagName) {
            const tagName = currentElement.tagName;
            const siblings = currentElement.parentNode ?
                Array.from(currentElement.parentNode.children).filter(e => e.tagName === tagName) :
                [];

            const position = siblings.indexOf(currentElement) + 1;
            const indexPart = siblings.length > 1 ? `[${position}]` : '';

            path = `/${tagName}${indexPart}${path}`;
            currentElement = currentElement.parentNode;
        }
        return path;
    }

    /**
     * Generate Appium method return values for an element
     */
    static generateAppiumMethods(element, platform) {
        const methods = [];
        const attrs = element.attributes;
        const tagName = element.tagName;

        // Common: getSize, getLocation, getRect
        let bounds = null;
        if (attrs.bounds) { // Android
            const match = attrs.bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
            if (match) {
                const [_, x1, y1, x2, y2] = match.map(Number);
                bounds = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
            }
        } else if (attrs.x && attrs.width) { // iOS
            bounds = {
                x: parseFloat(attrs.x),
                y: parseFloat(attrs.y),
                width: parseFloat(attrs.width),
                height: parseFloat(attrs.height)
            };
        }

        if (bounds) {
            methods.push({
                name: 'getSize()',
                value: `{"width": ${bounds.width}, "height": ${bounds.height}}`
            });
            methods.push({
                name: 'getLocation()',
                value: `{"x": ${bounds.x}, "y": ${bounds.y}}`
            });
            methods.push({
                name: 'getRect()',
                value: `{"x": ${bounds.x}, "y": ${bounds.y}, "width": ${bounds.width}, "height": ${bounds.height}}`
            });
        }

        if (platform === 'android') {
            // Android Specific
            methods.push({
                name: 'getText()',
                value: `"${attrs.text || ''}"`
            });
            methods.push({
                name: 'getAttribute("content-desc")',
                value: `"${attrs['content-desc'] || ''}"`
            });
            methods.push({
                name: 'getAttribute("resource-id")',
                value: `"${attrs['resource-id'] || ''}"`
            });
            methods.push({
                name: 'getAttribute("package")',
                value: `"${attrs['package'] || ''}"`
            });
            methods.push({
                name: 'isEnabled()',
                value: attrs.enabled === 'true' ? 'true' : 'false'
            });
            methods.push({
                name: 'isDisplayed()',
                value: 'true' // Elements in page source are generally "present", visibility is complex but assume true if in tree
            });
            methods.push({
                name: 'isSelected()',
                value: attrs.checked === 'true' || attrs.selected === 'true' ? 'true' : 'false'
            });

        } else if (platform === 'ios') {
            // iOS Specific
            // Appium's getText() on iOS usually returns label, value, or name in that order
            const textValue = attrs.label || attrs.value || attrs.name || '';
            methods.push({
                name: 'getText()',
                value: `"${textValue}"`
            });
            methods.push({
                name: 'getAttribute("name")',
                value: `"${attrs.name || ''}"`
            });
            methods.push({
                name: 'getAttribute("label")',
                value: `"${attrs.label || ''}"`
            });
            methods.push({
                name: 'getAttribute("value")',
                value: `"${attrs.value || ''}"`
            });
            methods.push({
                name: 'getAttribute("type")',
                value: `"${attrs.type || ''}"` // e.g. XCUIElementTypeButton
            });
            methods.push({
                name: 'isEnabled()',
                value: attrs.enabled === 'true' ? 'true' : 'false'
            });
            methods.push({
                name: 'isDisplayed()',
                value: attrs.visible === 'true' ? 'true' : 'false'
            });
        }

        return methods;
    }
}

// Export for use in inspector
window.LocatorGenerator = LocatorGenerator;
