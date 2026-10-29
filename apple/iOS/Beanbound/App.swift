import UIKit
import WebKit
import AVFoundation
import CoreHaptics

private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = GameViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

final class GameViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private(set) var webView: WKWebView!
    private let environmentRumble = EnvironmentRumble()
    private let pickupFeedback = UIImpactFeedbackGenerator(style: .soft)
    private let rainFeedback = UIImpactFeedbackGenerator(style: .light)
    private let damageFeedback = UIImpactFeedbackGenerator(style: .medium)
    private let gameOverFeedback = UIImpactFeedbackGenerator(style: .heavy)
    private let milestoneFeedback = UINotificationFeedbackGenerator()
    private var lastHapticTime: TimeInterval = -.infinity
    private var lastPriorityHapticTime: TimeInterval = -.infinity
    private let saveKey = "Beanbound.webSave"
    override var prefersStatusBarHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { [.bottom] }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { UIDevice.current.userInterfaceIdiom == .pad ? .all : .allButUpsideDown }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.078, green: 0.239, blue: 0.227, alpha: 1)
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch { NSLog("Beanbound audio: %@", error.localizedDescription) }
        let controller = WKUserContentController()
        let handler = WeakMessageHandler(self)
        controller.add(handler, name: "save")
        controller.add(handler, name: "haptic")
        controller.add(handler, name: "environment")
        controller.add(handler, name: "share")
        let saved = UserDefaults.standard.dictionary(forKey: saveKey) as? [String: String] ?? [:]
        let json = String(data: try! JSONSerialization.data(withJSONObject: saved), encoding: .utf8)!
        // Use native storage so updates and changing bundle paths preserve saves.
        let bridge = """
        (() => {
          if (window !== window.top) {
            Object.defineProperty(window, 'localStorage', {value: window.top.localStorage});
            window.beanboundEnvironment = kind => window.top.beanboundEnvironment(kind);
            window.beanboundHaptic = kind => window.top.beanboundHaptic(kind);
            navigator.vibrate = () => { window.beanboundHaptic('light'); return true; };
            navigator.share = data => window.top.navigator.share(data);
            return;
          }
          const values = \(json);
          const storage = {
            getItem(key) { return Object.prototype.hasOwnProperty.call(values, String(key)) ? values[String(key)] : null; },
            setItem(key, value) { values[String(key)] = String(value); window.webkit.messageHandlers.save.postMessage(values); },
            removeItem(key) { delete values[String(key)]; window.webkit.messageHandlers.save.postMessage(values); },
            clear() { for (const key of Object.keys(values)) delete values[key]; window.webkit.messageHandlers.save.postMessage(values); },
            key(index) { return Object.keys(values)[index] ?? null; },
            get length() { return Object.keys(values).length; }
          };
          Object.defineProperty(window, 'localStorage', {value: storage});
          window.beanboundEnvironment = kind => window.webkit.messageHandlers.environment.postMessage(String(kind));
          window.beanboundHaptic = kind => window.webkit.messageHandlers.haptic.postMessage({kind});
          navigator.vibrate = () => { window.beanboundHaptic('light'); return true; };
          navigator.share = async data => { window.webkit.messageHandlers.share.postMessage({text: String(data.text || '')}); };
        })();
        """
        controller.addUserScript(WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor), webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor), webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        let url = Bundle.main.url(forResource: "index", withExtension: "html")!
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        NotificationCenter.default.addObserver(self, selector: #selector(background), name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(foreground), name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(audioInterrupted(_:)), name: AVAudioSession.interruptionNotification, object: nil)
    }
    deinit { NotificationCenter.default.removeObserver(self) }
    @objc private func audioInterrupted(_ notification: Notification) {
        guard let value = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: value) else { return }
        if type == .began { background() }
        else if UIApplication.shared.applicationState == .active { foreground() }
    }
    @objc private func background() {
        environmentRumble.stop()
        UIApplication.shared.isIdleTimerDisabled = false
        webView.evaluateJavaScript("window.beanboundNative?.background()")
    }
    @objc private func foreground() {
        UIApplication.shared.isIdleTimerDisabled = true
        try? AVAudioSession.sharedInstance().setActive(true)
        webView.evaluateJavaScript("window.beanboundNative?.foreground()")
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        UIApplication.shared.isIdleTimerDisabled = true
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard presentedViewController == nil else { completionHandler(false); return }
        let alert = UIAlertController(title: "Beanbound", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "Reset settings", style: .destructive) { _ in completionHandler(true) })
        present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Game resources stay offline; external links open in the system browser.
        if let url = navigationAction.request.url, ["https", "http", "mailto"].contains(url.scheme ?? "") {
            decisionHandler(.cancel)
            UIApplication.shared.open(url)
        } else { decisionHandler(.allow) }
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame else { return }
        switch message.name {
        case "save":
            if let values = message.body as? [String: String] { UserDefaults.standard.set(values, forKey: saveKey) }
        case "environment":
            guard UIApplication.shared.applicationState == .active, let kind = message.body as? String else { environmentRumble.stop(); return }
            environmentRumble.update(kind)
        case "haptic":
            guard UIApplication.shared.applicationState == .active else { return }
            let kind = (message.body as? [String: String])?["kind"] ?? "light"
            let now = ProcessInfo.processInfo.systemUptime
            // Clustered drops produce one gentle tap, never a continuous vibration.
            if kind == "pickup" && now - lastHapticTime < 0.12 { return }
            if kind == "dirt" || kind == "rain" {
                guard now - lastPriorityHapticTime >= 0.6, now - lastHapticTime >= 0.22 else { return }
            }
            if ["damage", "milestone", "gameOver"].contains(kind) { lastPriorityHapticTime = now; environmentRumble.duck() }
            lastHapticTime = now
            switch kind {
            case "dirt": pickupFeedback.impactOccurred(intensity: 0.2)
            case "rain": rainFeedback.impactOccurred(intensity: 0.45)
            case "pickup": pickupFeedback.impactOccurred(intensity: 0.35)
            case "damage": damageFeedback.impactOccurred(intensity: 0.8)
            case "milestone": milestoneFeedback.notificationOccurred(.success)
            case "gameOver": gameOverFeedback.impactOccurred(intensity: 1)
            default: pickupFeedback.impactOccurred(intensity: 0.45)
            }
        case "share":
            guard presentedViewController == nil, let values = message.body as? [String: String], let text = values["text"] else { return }
            let sheet = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = view
            sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            present(sheet, animated: true)
        default: break
        }
    }
}

// A quiet continuous bed underneath the existing transient gameplay feedback.
private final class EnvironmentRumble {
    private var engine: CHHapticEngine?
    private var player: CHHapticAdvancedPatternPlayer?
    private var kind = "none", playingKind = "none"
    private var lastUpdate: TimeInterval = 0, duckUntil: TimeInterval = 0
    private var timer: Timer?
    func update(_ value: String) {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        guard ["dirt", "rain"].contains(value) else { stop(); return }
        kind = value
        lastUpdate = ProcessInfo.processInfo.systemUptime
        if timer == nil {
            timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in self?.refresh() }
        }
        refresh()
    }
    func duck() {
        duckUntil = ProcessInfo.processInfo.systemUptime + 0.6
        stopPlayer()
    }
    private func refresh() {
        let now = ProcessInfo.processInfo.systemUptime
        guard UIApplication.shared.applicationState == .active, now - lastUpdate < 1.2 else { stop(); return }
        guard now >= duckUntil else { return }
        guard player == nil || playingKind != kind else { return }
        stopPlayer()
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        do {
            if engine == nil {
                let newEngine = try CHHapticEngine()
                newEngine.playsHapticsOnly = true
                newEngine.stoppedHandler = { [weak self] _ in
                    DispatchQueue.main.async { self?.stopPlayer() }
                }
                newEngine.resetHandler = { [weak self] in
                    DispatchQueue.main.async { self?.stopPlayer() }
                }
                engine = newEngine
            }
            guard let engine else { return }
            try engine.start()
            let event = CHHapticEvent(eventType: .hapticContinuous, parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: kind == "dirt" ? 0.24 : 0.34),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: kind == "dirt" ? 0.15 : 0.65)
            ], relativeTime: 0, duration: 30)
            let newPlayer = try engine.makeAdvancedPlayer(with: CHHapticPattern(events: [event], parameters: []))
            newPlayer.loopEnabled = true
            newPlayer.loopEnd = 30
            try newPlayer.start(atTime: CHHapticTimeImmediate)
            player = newPlayer; playingKind = kind
        } catch {
            NSLog("Beanbound continuous haptics could not start: %@", error.localizedDescription)
            stopPlayer()
        }
    }
    private func stopPlayer() {
        try? player?.stop(atTime: CHHapticTimeImmediate)
        player = nil; playingKind = "none"
    }
    func stop() {
        kind = "none"; stopPlayer()
        timer?.invalidate(); timer = nil
    }
    deinit { timer?.invalidate(); try? player?.stop(atTime: CHHapticTimeImmediate) }
}
