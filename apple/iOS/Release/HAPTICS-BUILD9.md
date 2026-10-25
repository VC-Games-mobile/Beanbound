# Environment haptics — 1.1.1 (9)

Dirt uses the native soft generator at 20% intensity at most every 900 ms while growing underground. Above-ground rain uses the light generator at 25% intensity at most every 450 ms, only while a shower replenishes water below full. Dry sky has no environmental feedback. Rain entry no longer doubles up with a pickup tap. Cooldowns use wall time so the speed boost cannot double the pulse rate. New runs start with a cooldown. Paused/backgrounded games do not run this environmental feedback.

The saved Haptic feedback switch gates all events. Native environmental cues are suppressed for 600 ms after damage, milestones, or game over, and for 220 ms after other haptics. Important events remain immediate. Existing individual water pickups retain their gentle, separately limited cue.

Engine checks passed for dirt/rain distinction, per-frame throttling, dry-sky silence, and disabled preferences, alongside settings and Endless regression tests. Physical feel requires the owner to try the iPhone; no App Store submission performed.

Signed iOS archive /tmp/Beanbound-1.1.1-build9.xcarchive, signed tvOS build, and full iPhone/iPad integration tests succeeded. Exported archive with development signing and installed build 9 on Luke’s iPhone 14 on October 25, 2026.
