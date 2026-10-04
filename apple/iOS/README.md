# Beanbound for iPhone and iPad

One universal iOS app with the original game's touch controls, embedded fonts and artwork, procedural Web Audio music and sound effects. The game is bundled locally and works offline. Supports iOS/iPadOS 17 or later, portrait and landscape, plus resizable iPad windows.

Drag across the game to steer. Tap Pause to pause; returning from another app leaves the run paused until you resume. The native wrapper provides iPhone haptics, an iPad-safe score share sheet, and persistent progress/settings in UserDefaults. Saves are local to each device; there is no iCloud sync between iPhone, iPad, and Apple TV.

## Run on a device

Open `Beanbound.xcodeproj` in Xcode, choose the Beanbound scheme, connect and unlock an iPhone or iPad, and accept Trust if prompted. Select that device and Run. The project uses the existing development team P4ZB4J2Z8M; Xcode needs a registered iOS device to create the development provisioning profile. Developer Mode may need to be enabled on the device. This is a development build, not an App Store or TestFlight distribution.

## Shared game source

From the workspace root, run `python3 iOS/prepare.py` after changing the original `index.html`. It bundles the game and adds the iOS lifecycle boundary, turns off the Apple TV layout, restores touch menu scrolling, and adapts update instructions. It does not modify the Apple TV source or build. Generated resources are included so Xcode builds without Python.

`python3 iOS/make_project.py` regenerates the project and shared scheme. `swift iOS/make_icon.swift` generates the required opaque 1024×1024 iPhone/iPad icon from the supplied artwork in `iOS/IconSource/Beanbound.png`. The source is preserved without creative alterations.

## Validation

The hosted WKWebView integration test runs the actual bundled game. It checks original fonts, mobile menu layout, visible Play control, music startup, drag steering, background pause/audio suspension, and settings persistence after creating a new game view. Run it on both phone and tablet:

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcodebuild -project iOS/Beanbound.xcodeproj -scheme Beanbound \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)' \
  -parallel-testing-enabled NO -derivedDataPath /tmp/beanbound-ios \
  CODE_SIGNING_ALLOWED=NO test
```

Physical-device audio output, haptic feel, thermal performance, and extended gameplay require testing on a connected iPhone/iPad. Native sharing opens the system share sheet; the player chooses the destination and sends the score.
