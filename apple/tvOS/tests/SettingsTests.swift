import Foundation
import JavaScriptCore
let js=JSContext()!
var errors:[String]=[]
js.exceptionHandler={_,e in let s="\(e?.toString() ?? "") at \(e?.forProperty("line")?.toString() ?? "") \(e?.forProperty("stack")?.toString() ?? "")";errors.append(s);print(s)}
let read:@convention(block)(String)->String?={_ in nil}
let write:@convention(block)(String,String)->Void={_,_ in}
let remove:@convention(block)(String)->Void={_ in}
var tones:[(wave:String,volume:Double)]=[]
let tone:@convention(block)(Double,Double,Double,String,Double,Double,Double)->Void={_,_,_,wave,volume,_,_ in tones.append((wave,volume))}
js.setObject(tone,forKeyedSubscript:"nativeTone" as NSString)
js.setObject(read,forKeyedSubscript:"nativeRead" as NSString);js.setObject(write,forKeyedSubscript:"nativeWrite" as NSString);js.setObject(remove,forKeyedSubscript:"nativeRemove" as NSString)
let base=URL(fileURLWithPath:#filePath).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Beanbound/Resources").path+"/"
for (file,prefix) in [("dom.json","var nativeDOM = "),("host.js",""),("game.js","")] {var source=try! String(contentsOfFile:base+file,encoding:.utf8)
if file == "game.js" {
 source=source.replacingOccurrences(of:"  globalThis.beanbound = {",with:"""
  globalThis.endlessTest = {
    jump(m) {dist=M(m);P.y=-dist;cam=P.y-H*TIPF;spawnDist=dist+50;nextShower=dist+300;nextMile=(Math.floor(m/5000)+1)*M(5000);obst=[];drops=[];showers=[];leaves=[];parts=[];trail=[{x:P.x,y:P.y,d:dist}];water=10;invuln=10;},
    step:stepPlay,
    rows() {spawnAhead();return {hazards:obst.length,showers:showers.length,spawnDist,dist};},
    data() {return {endless,endlessLoop,water,best,endlessBest,score,state,theme:endlessLoop?endlessTheme(endlessLoop).name:'Original',colors:endlessLoop?endlessSky(dist):skyAt(skyT(dist))};},
    finish() {die('wilt');}, rain() {showers=[{y0:P.y-2000,y1:P.y+2000,under:false}];water=30;}, feedback: buzz, start: startGame, settings: () => ({musicVol,sfxVol,reducedMotion,boost:speedBoostActive(),haptics})
  };
  globalThis.beanbound = {
""")
}
js.evaluateScript(prefix+source,withSourceURL:URL(fileURLWithPath:file))}
func run(_ code:String){js.evaluateScript(code)}
func check(_ code:String,_ label:String){if js.evaluateScript(code)?.toBool() != true {print("FAIL: \(label)");exit(1)}}
func frames(_ from:Int,_ to:Int){for i in from...to {run("commands=[];nativeFrame(\(i*16))")}}

frames(0,300)
run("nodes.whatsNewDismiss.click();nodes.settingsBtn.click()")
check("nativeMenu().buttons.some(b=>b.id==='musicVolDown') && nativeMenu().buttons.some(b=>b.id==='reducedMotionToggle')", "new settings accessible with remote")
run("nodes.musicVolDown.click();nodes.sfxVolDown.click()")
check("endlessTest.settings().musicVol===0.9 && endlessTest.settings().sfxVol===0.9", "independent volume controls")
run("for(let i=0;i<15;i++)nodes.musicVolDown.click()")
check("endlessTest.settings().musicVol===0 && endlessTest.settings().sfxVol===0.9", "music can be silent while effects remain audible")
run("nodes.reducedMotionToggle.click()")
check("endlessTest.settings().reducedMotion", "reduced motion toggle")
run("var initialHaptics=endlessTest.settings().haptics;for(let i=0;i<10;i++)nodes.hapticToggle.click()")
check("endlessTest.settings().boost && endlessTest.settings().haptics===initialHaptics", "secret unlock restores original haptic preference")
run("nativeNow+=300001")
check("!endlessTest.settings().boost", "secret expires after five minutes")
run("if(!endlessTest.settings().haptics)nodes.hapticToggle.click();var feedback=[];window.beanboundHaptic=k=>feedback.push(k);endlessTest.start(true,true);endlessTest.jump(100000);endlessTest.step(0.016);endlessTest.finish()")
check("feedback.includes('milestone') && feedback.includes('gameOver')", "milestone and game-over route distinct feedback events")
run("nodes.hapticToggle.click();feedback=[];endlessTest.feedback(8,'pickup')")
check("feedback.length===0", "disabled haptics suppress native feedback")
run("nodes.hapticToggle.click();endlessTest.start(true,true);endlessTest.jump(100);feedback=[];nativeNow+=1000;endlessTest.step(0.016)")
check("feedback.filter(k=>k==='dirt').length===1", "dirt gets its own soft cue")
run("for(let i=0;i<10;i++)endlessTest.step(0.016)")
check("feedback.filter(k=>k==='dirt').length===1", "dirt does not vibrate every frame or twice during speed boost")
run("endlessTest.jump(40000);endlessTest.rain();feedback=[];nativeNow+=500;endlessTest.step(0.016)")
check("feedback.includes('rain') && !feedback.includes('dirt')", "rain has a distinct cue while restoring water")
run("endlessTest.jump(40000);feedback=[];nativeNow+=1000;endlessTest.step(0.016)")
check("!feedback.includes('rain') && !feedback.includes('dirt')", "dry sky has no environment vibration")
run("nodes.hapticToggle.click();endlessTest.jump(100);feedback=[];nativeNow+=1000;endlessTest.step(0.016)")
check("feedback.length===0", "environment feedback respects the off switch")
run("nodes.hapticToggle.click();var environments=[];window.beanboundEnvironment=k=>environments.push(k);endlessTest.start(true,true);endlessTest.jump(100);nativeNow+=1000;endlessTest.step(0.016)")
check("environments.includes('dirt')", "continuous dirt texture starts")
run("endlessTest.jump(40000);endlessTest.rain();nativeNow+=500;endlessTest.step(0.016)")
check("environments[environments.length-1]==='rain'", "continuous texture switches to rain")
run("nodes.pauseBtn.click()")
check("environments[environments.length-1]==='none'", "pausing stops the continuous texture immediately")
run("nodes.restart.click();endlessTest.jump(100);nativeNow+=1000;endlessTest.step(0.016);nodes.hapticToggle.click()")
check("environments[environments.length-1]==='none'", "switching haptics off stops the continuous texture immediately")
if !errors.isEmpty {exit(1)}
print("PASS: remote volume controls, independent levels, reduced motion, secret activation and expiry")
