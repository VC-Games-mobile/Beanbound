import XCTest
import WebKit
@testable import Beanbound

@MainActor
final class GameTests: XCTestCase {
    func evaluate(_ code: String, in game: GameViewController) async throws -> Any? {
        try await game.webView.evaluateJavaScript(code)
    }
    func ready(_ game: GameViewController) async throws {
        for _ in 0..<100 {
            if (try? await evaluate("!!window.beanboundNative", in: game)) as? Bool == true { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTFail("Bundled game did not initialize")
    }
    func testOriginalGameAudioTouchLifecycleAndPersistence() async throws {
        let app = UIApplication.shared.delegate as! AppDelegate
        let game = app.window!.rootViewController as! GameViewController
        try await ready(game)
        try await Task.sleep(nanoseconds: 3_000_000_000)
        // Upgrades present the original changelog before starting menu music.
        _ = try await evaluate("if (!document.getElementById('whatsNew').classList.contains('hidden')) document.getElementById('whatsNewDismiss').click()", in: game)
        try await Task.sleep(nanoseconds: 300_000_000)
        let fonts = try await evaluate("document.fonts.check('20px Bagel Fat One') && document.fonts.check('20px Figtree')", in: game) as? Bool
        XCTAssertEqual(fonts, true)
        let touchLayout = try await evaluate("!document.body.classList.contains('tv') && getComputedStyle(document.body).touchAction !== 'none'", in: game) as? Bool
        XCTAssertEqual(touchLayout, true, "Touch menus use the mobile layout and permit scrolling")
        let playVisible = try await evaluate("(() => {const r=document.getElementById('play').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight})()", in: game) as? Bool
        XCTAssertEqual(playVisible, true, "Play is entirely visible on this device")
        let audio = try await evaluate("beanboundNative.snapshot().audio", in: game) as? String
        XCTAssertEqual(audio, "running", "Original Web Audio starts without a browser gesture")
        let width = try await evaluate("innerWidth", in: game) as! Double
        XCTAssertEqual(width, Double(game.view.bounds.width), accuracy: 1)
        let canvasWidth = try await evaluate("document.querySelector('canvas').width", in: game) as! Double
        XCTAssertGreaterThan(canvasWidth, width)
        // Exercise the original game handlers through the actual WKWebView.
        _ = try await evaluate("document.getElementById('restart').click()", in: game)
        let playing = try await evaluate("beanboundNative.snapshot().state", in: game) as? String
        XCTAssertEqual(playing, "play")
        let before = try await evaluate("beanboundNative.snapshot().playerX", in: game) as! Double
        _ = try await evaluate("document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,clientX:innerWidth*0.5,clientY:innerHeight*0.6,bubbles:true}));document.querySelector('canvas').dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:innerWidth*0.8,clientY:innerHeight*0.6,bubbles:true}))", in: game)
        try await Task.sleep(nanoseconds: 300_000_000)
        let after = try await evaluate("beanboundNative.snapshot().playerX", in: game) as! Double
        XCTAssertGreaterThan(after, before, "Touch steers the player")
        _ = try await evaluate("beanboundNative.background()", in: game)
        try await Task.sleep(nanoseconds: 200_000_000)
        let paused = try await evaluate("beanboundNative.snapshot()", in: game) as! [String: Any]
        XCTAssertEqual(paused["state"] as? String, "paused")
        XCTAssertEqual(paused["audio"] as? String, "suspended")
        _ = try await evaluate("beanboundNative.foreground();document.getElementById('soundToggle').click();localStorage.setItem('beanbound-ios-test','persisted')", in: game)
        let muted = try await evaluate("beanboundNative.snapshot().muted", in: game) as! Bool
        try await Task.sleep(nanoseconds: 200_000_000)
        let next = GameViewController()
        app.window!.rootViewController = next
        try await ready(next)
        let saved = try await evaluate("localStorage.getItem('beanbound-ios-test')", in: next) as? String
        let savedMute = try await evaluate("beanboundNative.snapshot().muted", in: next) as? Bool
        XCTAssertEqual(saved, "persisted")
        XCTAssertEqual(savedMute, muted)
        _ = try await evaluate("localStorage.removeItem('beanbound-ios-test');document.getElementById('soundToggle').click()", in: next)
    }
}
