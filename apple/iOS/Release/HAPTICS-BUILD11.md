# Settings Back and perceptible rumble — 1.1.1 (11)

Moved Settings Back immediately below the heading, ahead of Evolutions and other settings. Native remote menus use the same first-control order. Engine test checks the order; browser preview confirms it visually.

Owner reports feeling collision feedback but no environmental feedback. The prior continuous values were very low (dirt intensity 0.08/sharpness 0.05, rain intensity 0.045/sharpness 0.35). Raised them to dirt 0.24/0.15 and rain 0.18/0.4. This is a tuning response to the report; the simulator cannot confirm physical feel or prove low intensity was the sole cause. Added native error logging for continuous-engine startup failures. Existing lifecycle stops, heartbeat watchdog, saved haptic preference, and event prioritization remain.

Settings/continuous transition engine tests and iPhone/iPad WKWebView integration tests passed; signed iOS archive /tmp/Beanbound-1.1.1-build11.xcarchive succeeded. No App Store upload or submission.

Development export installed successfully on Luke’s iPhone 14 on October 25, 2026. Physical rumble perception awaits owner check.
