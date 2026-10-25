# Continuous environment texture — 1.1.1 (10)

Adds a native Core Haptics continuous bed under the existing transient effects. Dirt intensity 0.08, sharpness 0.05; rain intensity 0.045, sharpness 0.35. Patterns loop in 30-second segments for sustained texture. The prior spaced soil/rain taps and pickup, shield hit, milestone, evolution and game-over cues remain. Priority events duck the bed for 600 ms.

The game sends environment changes and a 500 ms heartbeat during active play. Pause, menu, game over, and disabled haptics send an immediate stop. Native app background stops independently; a native timer also stops the player after 1.2 seconds without a heartbeat. No continuous texture in dry sky. Devices lacking Core Haptics hardware skip this layer. The saved opt-in preference is preserved.

Engine tests passed for dirt/rain transition, pause stop, disabled-preference stop, and prior transient throttling. Simulator tests cannot establish physical intensity/feel; the owner should try the installed iPhone build.

Full iPhone/iPad WKWebView tests and signed archive /tmp/Beanbound-1.1.1-build10.xcarchive passed. Development export installed on Luke’s iPhone 14 on October 25, 2026. No App Store upload/submission.
