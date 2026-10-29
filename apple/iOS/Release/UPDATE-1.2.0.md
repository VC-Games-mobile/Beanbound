# Challenge Mode testing — 1.2.0 (13)

October 29, 2026. Integrated the supplied Downloads/index.html into the iPhone/iPad game.

- Extras contains Challenge Mode and Endless Mode.
- Challenge Mode climbs a frozen mountain, with tighter gaps, faster hazards, and faster water drain. Challenge records remain separate from the normal game.
- The secret speed boost carries between modes using a shared expiry time.
- The bundled Challenge screen inherits the main screen origin, shares the native save bridge, forwards semantic and continuous haptics, and pauses/suspends audio when the app backgrounds.
- Audio uses the ambient session category, allowing other apps' audio to continue.
- Existing settings Back layout and rain/dirt haptics are retained.

Verification: four WKWebView integration tests passed on each of iPhone 17 Pro and iPad Pro 13-inch (M5) simulators. They cover normal gameplay/audio/touch/persistence, Endless, settings, and Challenge start/exit/native storage/background pause. Signed release archive and development export succeeded. Installed and launched on Luke’s iPhone 14. Physical play and haptic feel await Luke’s testing.

Archive: /tmp/Beanbound-1.2.0-build13.xcarchive
Development export: /tmp/Beanbound-1.2.0-build13-development

This is a device test build. No App Store upload or submission was performed. The root web index and tvOS resources have not been updated to Challenge Mode in this change; native sources are under apple/.
