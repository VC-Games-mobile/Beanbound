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
    func testEndlessModeMenuAndRestart() async throws {
        let app = UIApplication.shared.delegate as! AppDelegate
        let game = GameViewController()
        app.window!.rootViewController = game
        try await ready(game)
        try await Task.sleep(nanoseconds: 3_000_000_000)
        _ = try await evaluate("document.getElementById('whatsNewDismiss').click();document.getElementById('overMenu').click();document.getElementById('extrasBtn').click()", in: game)
        let visible = try await evaluate("(() => {const b=document.getElementById('endless');const r=b.getBoundingClientRect();return !b.hidden && getComputedStyle(b).display!=='none' && r.width>0})()", in: game) as? Bool
        XCTAssertEqual(visible, true)
        _ = try await evaluate("document.getElementById('endless').click();document.getElementById('restart').click()", in: game)
        let endless = try await evaluate("beanboundNative.snapshot().endless && beanboundNative.snapshot().state==='play'", in: game) as? Bool
        XCTAssertEqual(endless, true, "Endless starts and restart preserves its mode")
        _ = try await evaluate("beanboundNative.background()", in: game)
        let paused = try await evaluate("beanboundNative.snapshot().endless && beanboundNative.snapshot().state==='paused'", in: game) as? Bool
        XCTAssertEqual(paused, true)
        _ = try await evaluate("beanboundNative.foreground();document.getElementById('overMenu').click();document.getElementById('play').click()", in: game)
        let normal = try await evaluate("!beanboundNative.snapshot().endless", in: game) as? Bool
        XCTAssertEqual(normal, true, "Normal Play remains a separate mode")
        _ = try await evaluate("document.getElementById('overMenu').click()", in: game)
    }

    func testNewSettingsPersistAcrossReload() async throws {
        let app = UIApplication.shared.delegate as! AppDelegate
        let game = GameViewController()
        app.window!.rootViewController = game
        try await ready(game)
        _ = try await evaluate("document.getElementById('musicVol').value='25';document.getElementById('musicVol').dispatchEvent(new Event('input'));document.getElementById('sfxVol').value='70';document.getElementById('sfxVol').dispatchEvent(new Event('input'));if(document.getElementById('reducedMotionToggle').getAttribute('aria-checked')!=='true')document.getElementById('reducedMotionToggle').click()", in: game)
        let labels = try await evaluate("document.getElementById('musicVolVal').textContent==='25%' && document.getElementById('sfxVolVal').textContent==='70%'", in: game) as? Bool
        XCTAssertEqual(labels, true)
        _ = try await evaluate("for(let i=0;i<10;i++)document.getElementById('hapticToggle').click()", in: game)
        try await Task.sleep(nanoseconds: 200_000_000)
        let toast = try await evaluate("document.body.textContent.includes('2x speed for 5 minutes!')", in: game) as? Bool
        XCTAssertEqual(toast, true)
        let next = GameViewController()
        app.window!.rootViewController = next
        try await ready(next)
        let settings = try await evaluate("document.getElementById('musicVol').value==='25' && document.getElementById('sfxVol').value==='70' && document.getElementById('reducedMotionToggle').getAttribute('aria-checked')==='true'", in: next) as? Bool
        XCTAssertEqual(settings, true, "Independent volume and motion preferences survive native reload")
        _ = try await evaluate("document.getElementById('musicVol').value='100';document.getElementById('musicVol').dispatchEvent(new Event('input'));document.getElementById('sfxVol').value='100';document.getElementById('sfxVol').dispatchEvent(new Event('input'));document.getElementById('reducedMotionToggle').click()", in: next)
    }

    func testChallengeNativeIntegration() async throws {
        let app = UIApplication.shared.delegate as! AppDelegate
        let game = GameViewController()
        app.window!.rootViewController = game
        try await ready(game)
        game.webView.configuration.userContentController.addUserScript(WKUserScript(source: "window.addEventListener('error',e=>window.testLoadError=String(e.message)+' at '+e.lineno)", injectionTime: .atDocumentStart, forMainFrameOnly: false))
        _ = try await evaluate("document.getElementById('extrasBtn').click();document.getElementById('modeChallenge').click()", in: game)
        var loaded = false
        for _ in 0..<100 {
            if (try? await evaluate("!!document.getElementById('challengeFrame').contentWindow.beanboundNative", in: game)) as? Bool == true { loaded = true; break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        if !loaded {
            let detail = try await evaluate("(() => {const f=document.getElementById('challengeFrame');return {src:f.src,error:f.contentWindow.testLoadError,html:f.contentDocument?.documentElement?.outerHTML.slice(-1000)}})()", in: game)
            XCTFail("Challenge initialization: \(String(describing: detail))")
        }
        guard loaded else { return }
        _ = try await evaluate("var challenge=document.getElementById('challengeFrame').contentWindow;challenge.document.getElementById('restart').click()", in: game)
        let playing = try await evaluate("challenge.beanboundNative.snapshot().state==='play' && typeof challenge.beanboundHaptic==='function' && challenge.localStorage===window.localStorage", in: game) as? Bool
        XCTAssertEqual(playing, true, "Challenge uses native haptics and shared native storage")
        _ = try await evaluate("challenge.localStorage.setItem('beanbound-challenge-test','saved');beanboundNative.background()", in: game)
        try await Task.sleep(nanoseconds: 100_000_000)
        let paused = try await evaluate("challenge.beanboundNative.snapshot().state==='paused' && challenge.beanboundNative.snapshot().audio==='suspended'", in: game) as? Bool
        XCTAssertEqual(paused, true, "Backgrounding pauses and silences the active mode")
        _ = try await evaluate("beanboundNative.foreground();challenge.parent.postMessage('beanbound:earth','*')", in: game)
        // Use the actual child exit button to verify the sender-checked return path.
        _ = try await evaluate("challenge.document.getElementById('overMenu').click()", in: game)
        try await Task.sleep(nanoseconds: 200_000_000)
        let returned = try await evaluate("document.getElementById('challengeFrame').hidden", in: game) as? Bool
        XCTAssertEqual(returned, true)
        let next = GameViewController()
        app.window!.rootViewController = next
        try await ready(next)
        let saved = try await evaluate("localStorage.getItem('beanbound-challenge-test')", in: next) as? String
        XCTAssertEqual(saved, "saved")
        _ = try await evaluate("localStorage.removeItem('beanbound-challenge-test')", in: next)
    }

}
