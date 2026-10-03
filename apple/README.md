# Beanbound Apple apps

Backup of the working iPhone/iPad and Apple TV apps built from Beanbound 1.0.7.

- `iOS/Beanbound.xcodeproj`: universal iPhone/iPad app. Uses the original bundled game with WKWebView, native save storage, haptics, score sharing, and lifecycle handling.
- `tvOS/Beanbound.xcodeproj`: native Apple TV app with JavaScriptCore gameplay, Core Graphics rendering, remote navigation, and synthesized music/sound effects.
- `index.html`: shared source used by these ports, including remote/controller support. The website at the repository root remains the upstream game.

Open either Xcode project, select the Beanbound scheme and your connected device, choose your development team under Signing & Capabilities, and Run. Generated game resources, original fonts, and Home-screen icons are included. Requires Xcode with the appropriate iOS/tvOS SDK; deployment target is 17.0.

See `iOS/README.md` and `tvOS/README.md` for controls, source regeneration, builds, and validation. This backup contains rebuildable source projects; signing certificates and provisioning profiles are not included.

Validated October 3, 2026: iPhone/iPad simulator integration tests passed; the app was installed and launched on an iPhone 14 and reported working by the player. Apple TV runtime tests passed and the app was installed on the Living Room Apple TV. Music-enabled early gameplay measured 30fps on that Apple TV. Physical iPad testing and extended gameplay remain to be checked.
