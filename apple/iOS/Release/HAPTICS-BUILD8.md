# Native haptics — 1.1.1 (8)

Replaced the single light-impact bridge with named pickup, damage, milestone, gameOver and light feedback. Native generators are reused. Pickups use soft feedback at 35% intensity, coalesced within 120 ms of the preceding event. Shield hits use a medium impact; evolutions, distance milestones and victory use the native success notification; game over uses one heavy impact. Rain only signals entry; individual droplets signal collection. All feedback is gated by the existing saved haptic switch. Native callbacks are suppressed while the app is inactive. Devices without supported haptic hardware produce no vibration.

Game score, difficulty, and touch controls are unchanged. Existing preference remains intact; turn Haptic feedback on to try it. Physical haptic feel still requires the owner's check on iPhone. No App Store upload or submission performed.

Validation: native event-routing/disabled-preference checks and iPhone/iPad WKWebView tests passed. Signed archive /tmp/Beanbound-1.1.1-build8.xcarchive succeeded. Development export installed successfully on Luke’s iPhone 14.
