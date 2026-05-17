LocatorLens Privacy Policy

Last Updated: May 17, 2026

Data Collection
LocatorLens does not collect, store, or transmit mobile app screenshots, page source XML, locator values, device names, app package names, or other inspected app content to external servers.

Local Communication
This extension communicates with a local backend server running on your computer via Chrome's native messaging API. All communication occurs exclusively on your local machine and is used solely to:
- Start and stop local Appium and backend servers
- Retrieve device information from your local system
- Facilitate mobile app inspection through your local Appium installation
- Capture local mobile device screenshots and page source XML for inspection
- Send tap coordinates to your local Appium session when you use interact mode

No screenshots, page source XML, locator values, or inspected app content from these local communications is transmitted to external servers or third parties.

Usage Analytics
LocatorLens sends anonymous product usage events to the LocatorLens website endpoint, which forwards them to Google Analytics. These events include actions such as opening extension pages, starting servers, connecting a device, copying a locator, changing settings, or submitting feedback. They help understand which features are used and where users encounter problems.

Analytics events may include:
- Extension version
- Extension surface, such as popup, inspector, options, logs, or feedback
- Selected mobile platform, such as Android or iOS
- Generic result or error category
- Locator strategy type, such as ID, XPath, or Accessibility ID
- Match count bucket, such as 1 match or multiple matches

Analytics events do not include screenshots, page source XML, locator selector values, feedback message text, contact email, device names, UDIDs, app names, package names, or other inspected app content.

Feedback
If you submit feedback from the extension, LocatorLens sends the feedback form contents to the LocatorLens feedback endpoint so the message can be delivered by email. This may include the feedback type, message, optional contact email, optional platform notes, optional diagnostics notes, extension version, and browser user agent.

Permissions Explained
- storage: Saves your local preferences (server port, Appium URL, FPS settings) and an anonymous analytics client ID
- nativeMessaging: Communicates with the local Node.js backend on your computer
- host_permissions (localhost / 127.0.0.1): Connects to your local backend server (configurable port, default 8765)
- host_permissions (locatorlens.com): Sends anonymous usage events and feedback form submissions

Data Storage
Any settings you configure are stored locally in your browser using Chrome's storage API. LocatorLens keeps active device/session state locally while the backend is running. LocatorLens also stores an anonymous analytics client ID locally so usage events can be counted consistently while the extension remains installed.

Local Logs
LocatorLens writes local native host and server logs to help troubleshoot setup issues. These logs remain on your computer and are not uploaded by LocatorLens.

Third-Party Services
LocatorLens uses Google Analytics for anonymous usage analytics through the LocatorLens website endpoint. LocatorLens does not use analytics events for advertising personalization and does not send inspected app content to Google Analytics.

Contact
For questions about this privacy policy, please contact: pritesh1991@gmail.com

Changes to This Policy
We will update this privacy policy as needed. The "Last Updated" date will reflect any changes.
