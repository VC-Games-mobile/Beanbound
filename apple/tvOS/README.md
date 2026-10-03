# Beanbound for Apple TV

Native tvOS app for the Living Room Apple TV. Uses the original `index.html` game logic through JavaScriptCore, native Core Graphics rendering, UIKit focusable menus, AVAudioEngine synthesized audio, and on-device UserDefaults saves. No web browser or network server is required.

## Play

Select Play. Click the left/right edge of the Siri Remote, or slide across its touch surface, to steer. Play/Pause pauses or resumes; Menu/Back closes a menu or pauses gameplay. On the main menu, Menu/Back returns to the Apple TV Home screen. Bluetooth gamepads also support steering.

## Build and install

Open `Beanbound.xcodeproj` in Xcode, select the Beanbound scheme and Living Room destination, and Run. The project uses the existing development team; change Signing & Capabilities when building under another account. Requires Xcode with the tvOS SDK and a paired Apple TV with Developer Mode enabled. Deployment target: tvOS 17.0.

Command-line equivalent, from the repository root:

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
python3 tvOS/extract.py
swift tvOS/tests/RuntimeTests.swift
xcodebuild -project tvOS/Beanbound.xcodeproj -scheme Beanbound -configuration Release -sdk appletvos -destination 'id=5b1db6b12194d497ab24ab9dfa181d2284ffacba' -derivedDataPath /tmp/beanbound-device -allowProvisioningUpdates build
xcrun devicectl device install app --device E5156745-93FB-5C1E-B729-4E6EDFF96599 /tmp/beanbound-device/Build/Products/Release-appletvos/Beanbound.app
xcrun devicectl device process launch --device E5156745-93FB-5C1E-B729-4E6EDFF96599 com.vcgames.beanbound.tv
```

## Source updates

`extract.py` derives bundled game logic and a menu content tree from the root HTML. Run it after changes to `index.html`; generated resources are checked in so Xcode can build without Python. Native host changes belong in `Resources/host.js` or the Swift files. `make_project.py` regenerates the Xcode project; `make_icons.swift` regenerates the layered Home-screen icon.

## Validation and limits

Runtime tests cover splash/menu transitions, evolution rendering, steering, pause/frozen simulation, resume countdown, background pause, reset cancellation, rendering commands, original music reaching native audio, and mute/unmute. Simulator visual checks cover the menu, Select-to-play, hazards, game over, and return to menu. Signed builds are installed using the paired device.

The native menus and canvas text use the original embedded Bagel Fat One and Figtree fonts; the evolution gallery lists unlocks and descriptions rather than the browser's image cards. Audio preserves the procedural melody and sound effects with a native oscillator synth; browser echo/panning/noise effects are simplified. Sharing a score is omitted on TV. Endless Mode and the Moon remain coming-soon content from the original game. This is a development installation, not an App Store/TestFlight release; it must be re-signed and reinstalled when its provisioning profile expires.

## Performance and focus fixes

Menu comparison uses ordered button IDs and titles instead of unordered dictionary descriptions. Existing buttons are updated in place when toggling settings, preserving focus and scroll position. Returning to an overlay remembers its focused button; long menus scroll to reveal the focused control.

Raster drawing runs on a serial background queue, starting at 1280×720 and adapting down to 800×450 on the living room A8 device as needed. The renderer keeps only the latest pending frame, so it never accumulates stale frames. Standard 8-bit color and a reused bitmap renderer avoid expensive HDR rasterization on this older Apple TV. Gameplay targets 30fps; menu backgrounds run at 10fps, while menu controls stay native and full resolution. Parsed colors/fonts and static rock/cloud sprites are cached. Adjacent stalk segments are batched into continuous paths. Numeric drawing commands cross JavaScriptCore in one typed buffer, with a round-trip preservation test. Audio oscillators precompute pitch and envelope factors instead of evaluating powers per sample; audio rendering no longer holds the lock used by the UI to schedule tones.

For timing diagnostics, launch with `BEANBOUND_METRICS=1`; frame rate, generation, and draw timing are logged every five seconds. `BEANBOUND_AUTOPLAY=1` starts one unattended run for diagnostics. Neither setting is enabled during normal use.

To regenerate fonts after replacing the original HTML fonts: create a Python environment with `fonttools[woff]` and run `tvOS/extract_fonts.py`. Generated TTF files are checked in.

Physical-device validation on October 3, 2026 measured 29.6fps during an early-game run with diagnostics enabled. Simulator checks confirmed navigation to the last Settings option and focus retention after toggling sound. Later stages and extended play have not been profiled.

Build 3 restores the original music by exposing the native AudioContext on window. Music output and mute/unmute pass runtime tests. A subsequent Living Room device run with music enabled measured 30.0fps during steady early gameplay; startup briefly averaged 25.1fps. Normal launch disables diagnostics and autoplay.
