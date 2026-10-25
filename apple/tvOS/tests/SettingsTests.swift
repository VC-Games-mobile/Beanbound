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
    finish() {die('wilt');}, start: startGame, settings: () => ({musicVol,sfxVol,reducedMotion,boost:speedBoostActive(),haptics})
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
if !errors.isEmpty {exit(1)}
print("PASS: remote volume controls, independent levels, reduced motion, secret activation and expiry")
