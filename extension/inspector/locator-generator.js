/**
 * Locator Generator Utility
 * Generates raw Appium locator strategies and selectors.
 */

class LocatorGenerator {
    static generateLocators(element, platform) {
        const locators = [];

        if (platform === 'android') {
            locators.push(...this.generateAndroidLocators(element));
        } else if (platform === 'ios') {
            locators.push(...this.generateIOSLocators(element));
        }

        locators.push(...this.generateCommonLocators(element));

        return this.rankLocators(this.dedupeLocators(locators));
    }

    static generateAndroidLocators(element) {
        const attrs = element.attributes;
        const locators = [];

        if (attrs['resource-id']) {
            locators.push(this.createLocator('ID', 'id', attrs['resource-id'], 100));
            locators.push(this.createLocator(
                'UIAUTOMATOR',
                '-android uiautomator',
                `new UiSelector().resourceId("${this.escapeJavaString(attrs['resource-id'])}")`,
                55
            ));
        }

        if (attrs['content-desc']) {
            locators.push(this.createLocator('ACCESSIBILITY ID', 'accessibility id', attrs['content-desc'], 90));
        }

        if (attrs.text) {
            locators.push(this.createLocator(
                'UIAUTOMATOR',
                '-android uiautomator',
                `new UiSelector().text("${this.escapeJavaString(attrs.text)}")`,
                45
            ));
        }

        return locators;
    }

    static generateIOSLocators(element) {
        const attrs = element.attributes;
        const locators = [];
        const className = this.normalizeIOSClassName(attrs.type || element.tagName);

        if (attrs.name) {
            locators.push(this.createLocator('ACCESSIBILITY ID', 'accessibility id', attrs.name, 90));
            locators.push(this.createLocator(
                'PREDICATE',
                '-ios predicate string',
                `name == "${this.escapePredicateString(attrs.name)}"`,
                60
            ));
        }

        if (attrs.label && attrs.label !== attrs.name) {
            locators.push(this.createLocator('ACCESSIBILITY ID', 'accessibility id', attrs.label, 85));
        }

        if (attrs.label) {
            locators.push(this.createLocator(
                'PREDICATE',
                '-ios predicate string',
                `label == "${this.escapePredicateString(attrs.label)}"`,
                55
            ));
        }

        if (attrs.value) {
            locators.push(this.createLocator(
                'PREDICATE',
                '-ios predicate string',
                `value == "${this.escapePredicateString(attrs.value)}"`,
                50
            ));
        }

        if (className) {
            if (attrs.name) {
                locators.push(this.createLocator(
                    'CLASS CHAIN',
                    '-ios class chain',
                    `**/${className}[\`name == "${this.escapePredicateString(attrs.name)}"\`]`,
                    50
                ));
            }

            locators.push(this.createLocator('CLASS CHAIN', '-ios class chain', `**/${className}`, 20));
        }

        return locators;
    }

    static generateCommonLocators(element) {
        const attrs = element.attributes;
        const locators = [];

        if (attrs.class) {
            locators.push(this.createLocator('CLASS NAME', 'class name', attrs.class, 25));
        }

        if (attrs.text) {
            locators.push(this.createLocator('XPATH', 'xpath', `//*[@text=${this.toXPathLiteral(attrs.text)}]`, 80));
        }

        if (attrs['resource-id']) {
            locators.push(this.createLocator('XPATH', 'xpath', `//*[@resource-id=${this.toXPathLiteral(attrs['resource-id'])}]`, 80));
        }

        if (attrs.name) {
            locators.push(this.createLocator('XPATH', 'xpath', `//*[@name=${this.toXPathLiteral(attrs.name)}]`, 80));
        }

        if (attrs.label && attrs.label !== attrs.name) {
            locators.push(this.createLocator('XPATH', 'xpath', `//*[@label=${this.toXPathLiteral(attrs.label)}]`, 75));
        }

        if (attrs.value) {
            locators.push(this.createLocator('XPATH', 'xpath', `//*[@value=${this.toXPathLiteral(attrs.value)}]`, 70));
        }

        if (!locators.some(locator => locator.strategy === 'xpath')) {
            const relativeXPath = this.generateRelativeXPath(element);
            if (relativeXPath) {
                locators.push(this.createLocator('XPATH', 'xpath', relativeXPath, 65));
            }
        }

        return locators;
    }

    static createLocator(type, strategy, value, priority) {
        return {
            type,
            strategy,
            value,
            priority,
            code: value
        };
    }

    static rankLocators(locators) {
        return locators.sort((a, b) => b.priority - a.priority);
    }

    static dedupeLocators(locators) {
        const seen = new Set();
        return locators.filter(locator => {
            const key = `${locator.strategy}::${locator.value}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    static normalizeIOSClassName(value) {
        if (!value) return '';
        return value.startsWith('XCUIElementType') ? value : `XCUIElementType${value}`;
    }

    static escapeJavaString(value) {
        return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    static escapePredicateString(value) {
        return this.escapeJavaString(value);
    }

    static toXPathLiteral(value) {
        const text = String(value);
        if (!text.includes('"')) return `"${text}"`;
        if (!text.includes("'")) return `'${text}'`;

        return `concat(${text.split('"').map(part => `"${part}"`).join(', \'"\', ')})`;
    }

    static generateRelativeXPath(element) {
        const tagName = element.tagName;
        if (!tagName) return '';

        const parent = element.parentNode;
        if (!parent && element.xpath) {
            const match = element.xpath.match(/\/([^/\[]+)(?:\[(\d+)\])?$/);
            if (match) {
                const [, xpathTag, xpathIndex] = match;
                return xpathIndex ? `(//${xpathTag})[${xpathIndex}]` : `//${xpathTag}`;
            }
        }

        if (!parent) return `//${tagName}`;

        const sameTagSiblings = Array.from(parent.children || []).filter(child => child.tagName === tagName);
        if (sameTagSiblings.length <= 1) return `//${tagName}`;

        return `(//${tagName})[${sameTagSiblings.indexOf(element) + 1}]`;
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
