import UIKit
import JavaScriptCore
import GameController

@main final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey:Any]? = nil) -> Bool {
        window=UIWindow(frame:UIScreen.main.bounds);window?.rootViewController=GameViewController();window?.makeKeyAndVisible();return true
    }
    func applicationDidBecomeActive(_ application:UIApplication) { (window?.rootViewController as? GameViewController)?.foreground() }
    func applicationWillResignActive(_ application:UIApplication) { (window?.rootViewController as? GameViewController)?.background() }
}

final class GameViewController: UIViewController, UIGestureRecognizerDelegate {
    private let js = JSContext()!
    private var packedFrameFunction:JSValue!
    private let audio = GameAudio()
    private let canvas = CanvasView()
    private let panel = UIView(), hud = UILabel(), titleLabel = UILabel(), textLabel = UILabel()
    private let buttonStack = UIStackView(), scroll = UIScrollView()
    private var displayLink: CADisplayLink?
    private var startTime: CFTimeInterval = 0
    private var backgroundTime: CFTimeInterval?
    private var wasMuted=false
    private let metricsEnabled=ProcessInfo.processInfo.environment["BEANBOUND_METRICS"] == "1"
    private var metricStart:CFTimeInterval=0, metricFrames=0
    private var metricGeneration=0.0, metricDraw=0.0, metricMaxDraw=0.0
    private var lastMenuPoll: CFTimeInterval = 0
    private var lastRender: CFTimeInterval = 0
    private var focusedByOverlay: [String:String] = [:]
    private var signature = "", overlay = "", state = "menu"
    private var remoteAxis: Double = 0, controllerAxis: Double = 0, swipeUntil: CFTimeInterval = 0
    private var preferredButton: UIView?
    override var preferredFocusEnvironments: [UIFocusEnvironment] { preferredButton.map{[$0]} ?? [buttonStack] }
    override func viewDidLoad() {
        super.viewDidLoad(); GameFonts.register(); view.backgroundColor=CanvasView.color("#12302C")
        canvas.frame=view.bounds;canvas.autoresizingMask=[.flexibleWidth,.flexibleHeight];view.addSubview(canvas)
        hud.font = GameFonts.display(28);hud.textColor = .white;hud.numberOfLines=3
        hud.frame=CGRect(x:80,y:50,width:1000,height:130);view.addSubview(hud)
        panel.backgroundColor=CanvasView.color("#12302C").withAlphaComponent(0.94);panel.layer.cornerRadius=32
        panel.translatesAutoresizingMaskIntoConstraints=false;view.addSubview(panel)
        NSLayoutConstraint.activate([panel.centerXAnchor.constraint(equalTo:view.centerXAnchor),panel.centerYAnchor.constraint(equalTo:view.centerYAnchor),panel.widthAnchor.constraint(equalToConstant:1040),panel.heightAnchor.constraint(equalTo:view.safeAreaLayoutGuide.heightAnchor,multiplier:0.9)])
        scroll.translatesAutoresizingMaskIntoConstraints=false;panel.addSubview(scroll)
        NSLayoutConstraint.activate([scroll.leadingAnchor.constraint(equalTo:panel.leadingAnchor,constant:50),scroll.trailingAnchor.constraint(equalTo:panel.trailingAnchor,constant:-50),scroll.topAnchor.constraint(equalTo:panel.topAnchor,constant:30),scroll.bottomAnchor.constraint(equalTo:panel.bottomAnchor,constant:-30)])
        let content=UIStackView();content.axis = .vertical;content.spacing=18;content.translatesAutoresizingMaskIntoConstraints=false;scroll.addSubview(content)
        NSLayoutConstraint.activate([content.leadingAnchor.constraint(equalTo:scroll.contentLayoutGuide.leadingAnchor),content.trailingAnchor.constraint(equalTo:scroll.contentLayoutGuide.trailingAnchor),content.topAnchor.constraint(equalTo:scroll.contentLayoutGuide.topAnchor),content.bottomAnchor.constraint(equalTo:scroll.contentLayoutGuide.bottomAnchor),content.widthAnchor.constraint(equalTo:scroll.frameLayoutGuide.widthAnchor)])
        titleLabel.font = GameFonts.display(64);titleLabel.textColor=CanvasView.color("#FFD86B");titleLabel.textAlignment = .center;titleLabel.numberOfLines=2
        textLabel.font = GameFonts.body(24,bold:true);textLabel.textColor = .white;textLabel.numberOfLines=0;textLabel.textAlignment = .center
        buttonStack.axis = .vertical;buttonStack.spacing=14
        [titleLabel,textLabel,buttonStack].forEach{content.addArrangedSubview($0)}
        js.exceptionHandler={ _,e in NSLog("Beanbound JavaScript: %@",e?.toString() ?? "unknown") }
        let read: @convention(block) (String)->String? = { UserDefaults.standard.string(forKey:$0) }
        let write: @convention(block) (String,String)->Void = { UserDefaults.standard.set($1,forKey:$0) }
        let remove: @convention(block) (String)->Void = { UserDefaults.standard.removeObject(forKey:$0) }
        js.setObject(read,forKeyedSubscript:"nativeRead" as NSString);js.setObject(write,forKeyedSubscript:"nativeWrite" as NSString);js.setObject(remove,forKeyedSubscript:"nativeRemove" as NSString)
        let tone: @convention(block) (Double,Double,Double,String,Double,Double,Double)->Void = { [weak self] f,end,duration,wave,volume,attack,delay in self?.audio.tone(f,end,duration,wave,volume,attack,delay) }
        js.setObject(tone,forKeyedSubscript:"nativeTone" as NSString)
        load("dom",ext:"json",prefix:"var nativeDOM = ");load("host",ext:"js");load("game",ext:"js")
        packedFrameFunction=js.objectForKeyedSubscript("nativePackedFrame")
        canvas.onRendered={ [weak self] ms in
            guard let self,self.metricsEnabled else {return}
            self.metricFrames+=1;self.metricDraw+=ms;self.metricMaxDraw=max(self.metricMaxDraw,ms)
        }
        startTime=CACurrentMediaTime();metricStart=startTime
        if ProcessInfo.processInfo.environment["BEANBOUND_AUTOPLAY"] == "1" {js.evaluateScript("setTimeout(()=>{beanbound.select();nodes.restart.click()},3000)")}
        displayLink=CADisplayLink(target:self,selector:#selector(tick));displayLink?.preferredFramesPerSecond=30;displayLink?.add(to:.main,forMode:.common)
        let pan=UIPanGestureRecognizer(target:self,action:#selector(pan(_:)));pan.delegate=self;pan.allowedTouchTypes=[NSNumber(value:UITouch.TouchType.indirect.rawValue)];view.addGestureRecognizer(pan)
        NotificationCenter.default.addObserver(self,selector:#selector(controllerConnected),name:.GCControllerDidConnect,object:nil);NotificationCenter.default.addObserver(self,selector:#selector(controllerDisconnected),name:.GCControllerDidDisconnect,object:nil);controllerConnected()
        UIApplication.shared.isIdleTimerDisabled=true
    }
    private func load(_ name:String,ext:String,prefix:String="") {
        guard let url=Bundle.main.url(forResource:name,withExtension:ext),let s=try? String(contentsOf:url,encoding:.utf8) else { fatalError("Missing bundled \(name)") }
        js.evaluateScript(prefix+s,withSourceURL:url)
    }
    @objc private func tick() {
        let now=CACurrentMediaTime()
        if controllerAxis != 0 { swipeUntil=0 }
        let axis=abs(controllerAxis)>0.15 ? controllerAxis : remoteAxis
        js.objectForKeyedSubscript("beanbound")?.invokeMethod("steering",withArguments:[now < swipeUntil || swipeUntil==0 ? axis : 0])
        // Limit menu background animation to 10fps; gameplay targets 30fps.
        let interval:Double = overlay.isEmpty && state != "paused" ? 1.0/30.0 : 0.1
        if now-lastRender >= interval-0.002 {
            lastRender=now
            let generationStart=CACurrentMediaTime()
            let packed=packedFrameFunction.call(withArguments:[(now-startTime)*1000,now < swipeUntil || swipeUntil==0 ? axis : 0])
            let count=Int(js.objectForKeyedSubscript("nativePackedLength")?.toInt32() ?? 0)
            if let packed,
               let object=JSValueToObject(js.jsGlobalContextRef,packed.jsValueRef,nil),
               let bytes=JSObjectGetTypedArrayBytesPtr(js.jsGlobalContextRef,object,nil) {
                let numbers=Array(UnsafeBufferPointer(start:bytes.assumingMemoryBound(to:Double.self),count:count))
                let values=js.objectForKeyedSubscript("nativePackedValues")?.toArray() ?? []
                canvas.submit(CanvasFrame(numbers:numbers,values:values))
            }
            if metricsEnabled {metricGeneration+=(CACurrentMediaTime()-generationStart)*1000}
        }
        if metricsEnabled && now-metricStart >= 5 && metricFrames>0 {
            NSLog("Beanbound performance state=%@ fps=%.1f generation=%.1fms draw=%.1fms maxDraw=%.1fms",state,Double(metricFrames)/(now-metricStart),metricGeneration/Double(metricFrames),metricDraw/Double(metricFrames),metricMaxDraw)
            metricStart=now;metricFrames=0;metricGeneration=0;metricDraw=0;metricMaxDraw=0
        }
        guard now-lastMenuPoll >= 0.1 else {return}
        lastMenuPoll=now
        guard let menu=js.objectForKeyedSubscript("nativeMenu")?.call(withArguments:[])?.toDictionary() as? [String:Any],let snap=menu["snapshot"] as? [String:Any] else {return}
        state=snap["state"] as? String ?? "menu"
        let previousOverlay=overlay
        overlay=snap["overlay"] as? String ?? ""
        let muted=snap["muted"] as? Bool ?? false
        if muted && !wasMuted {audio.silence()};wasMuted=muted
        hud.isHidden=state != "play" && state != "countdown"
        hud.text="Score \(snap["score"] ?? 0)   •   Water \(Int((snap["water"] as? Double) ?? 0))%\n\(snap["layer"] ?? "")   \(snap["ability"] ?? "")\nPlay/Pause to pause"
        let splash=snap["splash"] as? Bool ?? false
        panel.isHidden=overlay.isEmpty && !splash && state != "countdown"
        let buttons=menu["buttons"] as? [[String:String]] ?? []
        // Dictionary descriptions have unstable key ordering. Compare explicit fields.
        let sig="\(overlay)|\(splash)|\(state == "countdown" ? snap["countdown"] ?? "" : "")|" + buttons.map{($0["id"] ?? "")+":"+($0["title"] ?? "")}.joined(separator:"|") + "|" + (menu["text"] as? String ?? "")
        if sig==signature {return};signature=sig
        titleLabel.text=splash ? "VC Games" : state=="countdown" ? "\(snap["countdown"] ?? "")" : menu["title"] as? String
        if let title=titleLabel.text {titleLabel.attributedText=NSAttributedString(string:title,attributes:[.font:titleLabel.font!, .foregroundColor:CanvasView.color("#FFD86B"), .strokeColor:CanvasView.color("#12302C"), .strokeWidth:-5])}
        textLabel.text=menuText(menu,snap:snap)
        let oldButtons=buttonStack.arrangedSubviews.compactMap{$0 as? UIButton}
        let sameButtons=oldButtons.map{$0.accessibilityIdentifier ?? ""} == buttons.map{$0["id"] ?? ""}
        if previousOverlay==overlay && sameButtons {
            for (b,item) in zip(oldButtons,buttons) {b.setTitle(item["title"],for:.normal)}
            return // Keep focus and scroll position when a setting changes.
        }
        scroll.setContentOffset(.zero,animated:false)
        buttonStack.arrangedSubviews.forEach{buttonStack.removeArrangedSubview($0);$0.removeFromSuperview()};preferredButton=nil
        for item in buttons {
            guard let id=item["id"] else {continue}
            let b=UIButton(type:.system);b.setTitle(item["title"],for:.normal);b.titleLabel?.font = GameFonts.display(32)
            b.heightAnchor.constraint(equalToConstant:64).isActive=true;b.accessibilityIdentifier=id
            b.addAction(UIAction{[weak self] _ in self?.js.objectForKeyedSubscript("nodes")?.forProperty(id)?.invokeMethod("click",withArguments:[]);self?.lastMenuPoll=0},for:.primaryActionTriggered)
            buttonStack.addArrangedSubview(b)
            if preferredButton==nil || ["play","resume","again","resetConfirmNo"].contains(id) {preferredButton=b}
            if focusedByOverlay[overlay]==id {preferredButton=b}
        }
        if let id=focusedByOverlay[overlay],let remembered=buttonStack.arrangedSubviews.first(where:{$0.accessibilityIdentifier==id}) {preferredButton=remembered}
        view.layoutIfNeeded();setNeedsFocusUpdate();updateFocusIfNeeded()
    }
    private func menuText(_ menu:[String:Any],snap:[String:Any])->String {
        switch overlay {
        case "start": return "Grow a beanstalk from deep underground all the way to space.\nBest: \(snap["best"] ?? 0)\nUse the remote’s touch surface or click left and right to steer."
        case "over": return ["finalScore","statLine","evoLine","bestLine"].compactMap{js.objectForKeyedSubscript("nodes")?.forProperty($0)?.forProperty("textContent")?.toString()}.filter{!$0.isEmpty}.joined(separator:"\n")
        case "pause": return js.objectForKeyedSubscript("nodes")?.forProperty("pauseInfo")?.forProperty("textContent")?.toString() ?? ""
        case "about": return "Beanbound 1.0.7 • VC Games\nA tiny game about growing a bean all the way to space.\nProgress and settings are stored on this Apple TV."
        case "resetConfirm": return js.objectForKeyedSubscript("nodes")?.forProperty("resetConfirmText")?.forProperty("textContent")?.toString() ?? ""
        case "whatsNew": return "The game is out!\nGrow all the way to space."
        case "settings": return "Progress and settings are saved on this Apple TV."
        case "how": return "Steer left and right. Catch water before you run dry. Avoid rocks, birds, clouds, storms, and balloons. Sun orbs give you a shield; seed packs grant a random ability. Reach 100,000 m to win. Play/Pause pauses your run." + ((js.evaluateScript("!nodes.seedInfoPanel.classList.contains(\"hidden\")")?.toBool() ?? false) ? "\n\nSeed packs can cause Dehydration, Big, Small, Slow, or Fast. Dehydration is the most common." : "")
        case "updatesInfo": return "This native build updates when a new version is installed from Xcode."
        case "evos": return (snap["evolutions"] as? [[String:Any]] ?? []).map{"\(($0["unlocked"] as? Bool ?? false) ? $0["name"] ?? "" : "Locked") — \($0["m"] ?? 0) m\n\(($0["unlocked"] as? Bool ?? false) ? $0["desc"] ?? "" : "Keep growing to unlock this form.")"}.joined(separator:"\n\n")
        default: return (menu["text"] as? String ?? "").prefix(1000).description
        }
    }
    override func didUpdateFocus(in context:UIFocusUpdateContext,with coordinator:UIFocusAnimationCoordinator) {
        super.didUpdateFocus(in:context,with:coordinator)
        if let button=context.nextFocusedView as? UIButton,let id=button.accessibilityIdentifier {
            focusedByOverlay[overlay]=id;preferredButton=button
            let rect=button.convert(button.bounds,to:scroll)
            scroll.scrollRectToVisible(rect.insetBy(dx:0,dy:-12),animated:true)
        }
    }
    private func key(_ key:String,_ down:Bool){js.objectForKeyedSubscript("nativeKey")?.call(withArguments:[key,down])}
    override func pressesBegan(_ presses:Set<UIPress>,with event:UIPressesEvent?) {
        for p in presses {
            switch p.type {
            case .menu:
                if state=="menu" && overlay=="start" {super.pressesBegan(presses,with:event);return}
                js.objectForKeyedSubscript("beanbound")?.invokeMethod("back",withArguments:[])
            case .playPause: js.objectForKeyedSubscript("beanbound")?.invokeMethod("pause",withArguments:[])
            case .leftArrow,.rightArrow:
                if overlay.isEmpty {remoteAxis=p.type == .leftArrow ? -1 : 1;swipeUntil=0} else {super.pressesBegan(presses,with:event)}
            case .select:
                if overlay.isEmpty {js.objectForKeyedSubscript("beanbound")?.invokeMethod("select",withArguments:[])} else {super.pressesBegan(presses,with:event)}
            default:super.pressesBegan(presses,with:event)
            }
        }
    }
    override func pressesEnded(_ presses:Set<UIPress>,with event:UIPressesEvent?) {
        for p in presses where p.type == .leftArrow || p.type == .rightArrow {swipeUntil=CACurrentMediaTime()+0.16}
        super.pressesEnded(presses,with:event)
    }
    override func pressesCancelled(_ presses:Set<UIPress>,with event:UIPressesEvent?){remoteAxis=0;super.pressesCancelled(presses,with:event)}
    func gestureRecognizerShouldBegin(_ gestureRecognizer:UIGestureRecognizer)->Bool {overlay.isEmpty}
    @objc private func pan(_ g:UIPanGestureRecognizer) {
        guard overlay.isEmpty else {return}
        if g.state == .ended || g.state == .cancelled {swipeUntil=CACurrentMediaTime()+0.12;return}
        remoteAxis=max(-1,min(1,Double(g.velocity(in:view).x)/700));swipeUntil=0
    }
    @objc private func controllerDisconnected(){controllerAxis=0}
    @objc private func controllerConnected() {
        for c in GCController.controllers() {
            c.extendedGamepad?.valueChangedHandler={ [weak self] pad,_ in
                DispatchQueue.main.async { self?.controllerAxis=Double(abs(pad.leftThumbstick.xAxis.value)>0.15 ? pad.leftThumbstick.xAxis.value : pad.dpad.xAxis.value) }
            }
            c.extendedGamepad?.buttonMenu.pressedChangedHandler={ [weak self] _,_,pressed in if pressed { DispatchQueue.main.async {self?.js.objectForKeyedSubscript("beanbound")?.invokeMethod("pause",withArguments:[])} } }
        }
    }
    func background(){
        backgroundTime=CACurrentMediaTime();displayLink?.isPaused=true;audio.silence();remoteAxis=0;controllerAxis=0
        js.objectForKeyedSubscript("beanbound")?.invokeMethod("background",withArguments:[])
    }
    func foreground(){if let t=backgroundTime {startTime+=CACurrentMediaTime()-t};backgroundTime=nil;displayLink?.isPaused=false}
}
