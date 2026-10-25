# Beanbound 1.1.1 (7)

Imported GitHub VC-Games-mobile/Beanbound commit d737838 on October 25, 2026. New music/effects volume levels, reduced motion, gameplay hints and auto-pause settings, reset settings, and the ten-tap haptic speed-boost Easter egg. Existing local saves, native lifecycle/sharing, touch layout, remote navigation, and Endless Mode remain in place.

The upstream HTML includes a nested, disabled future Moon game. The Apple bundle imports the active game and settings, retaining a valid document shell and the existing inactive Moon behavior. It does not enable or ship the unused nested Moon payload. Root web index.html is preserved exactly as upstream.

Apple TV exposes separate Increase/Decrease buttons for each volume level, uses native focus/scroll behavior, and displays the current in-game changelog. The haptic switch is selectable for the Easter egg, although Apple TV has no haptic output.

Signed iOS archive: /tmp/Beanbound-1.1.1-build7.xcarchive. Signed tvOS build: /tmp/beanbound-111-tv/Build/Products/Release-appletvos/Beanbound.app. This update has not been uploaded or submitted to Apple and has not been installed on physical devices.

Runtime and Endless regression checks passed, including twelve 100,000-metre boundaries and normal victory. New settings engine tests passed for independent volume levels, remote controls, reduced motion, Easter egg activation and expiry. Original iPhone/iPad simulator integration tests passed. Additional settings persistence tests passed on both iPhone 17 Pro and iPad Pro 13-inch (M5). The speed-boost toast was verified in the real WKWebView.

App Store What's New is copied only from the active in-game CHANGELOG. Reviewer-only notes separately disclose the Easter egg activation.

October 25, 2026 at 10:45 AM America/Detroit: submitted iOS 1.1.1 (12). App Store Connect confirms Waiting for Review. Upload succeeded at 10:41 AM. Submission ID: b9b13a0a-d0c7-46bc-a524-72b634d36d86. Automatic release after approval, immediately to all users; existing rating preserved. What’s New contains only the active in-game CHANGELOG. Reviewer notes cover the new settings, final haptics, physical iPhone testing, and speed-boost Easter egg. Existing app description, support URL and screenshot assets carried forward. No new agreement acceptance was required or performed.
Review URL: https://appstoreconnect.apple.com/apps/6818844668/distribution/reviewsubmissions/details/b9b13a0a-d0c7-46bc-a524-72b634d36d86
