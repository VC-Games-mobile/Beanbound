# Beanbound 1.1.0 (6) — Endless Mode

October 20, 2026: added functional Endless Mode to the shared native game and exposed its button on iPhone/iPad. Every 100,000 metres adds a new stretch: five interpolated space palettes cycle, the three hazard families rotate through different thirds of the stretch, and speed rises by 3% per stretch up to an 18% cap. Procedural layouts remain randomized. Distance, score, evolutions, and stalk continue without a reset; each milestone restores water to at least 75% and grants two seconds of collision protection. A short clear corridor eases transitions. Rain and markers continue beyond the original endpoint.

Endless best uses its own local persistence key, leaving normal Play best unchanged. Replay/restart preserve mode; returning to menu then selecting Play restores normal mode. Normal Play still ends at 100,000 metres. Reset Progress clears both records. Existing native save, audio, lifecycle, and controls are retained. Apple TV resources include the same gameplay and show stretch information.

Signed archive: /tmp/Beanbound-1.1.0-build6.xcarchive. This build has not been uploaded to App Store Connect or submitted for review.

Native engine tests crossed 12 boundaries, checked five palette variations, continued hazards and rain, water recovery, mode-preserving replay, separate scores, and normal victory. Existing native runtime tests passed. Both signed native builds succeeded. iPhone/iPad integration tests and device installation status are recorded below when complete. Long physical-device play has not yet been verified.

Final validation: iPhone 17 Pro and iPad Pro 13-inch integration tests passed (both original gameplay/audio/lifecycle/persistence and new Endless menu/restart/background behavior). The first iPhone audio test failure was caused by the new test leaving audio suspended after simulating backgrounding; the test now simulates foregrounding before returning to the menu. Production audio behavior did not need changing.

Installed and launched 1.1.0 (6) on Luke's iPhone 14. Installed on Living Room Apple TV; automatic launch was blocked because the TV is asleep. No physical iPad installation performed. Neither long physical gameplay nor real-time play through 100,000 metres has been user-verified yet; milestone behavior was exercised by the native engine regression tests.
