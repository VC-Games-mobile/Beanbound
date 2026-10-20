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
    finish() {die('wilt');}, start: startGame
  };
  globalThis.beanbound = {
""")
}
js.evaluateScript(prefix+source,withSourceURL:URL(fileURLWithPath:file))}
func run(_ code:String){js.evaluateScript(code)}
func check(_ code:String,_ label:String){if js.evaluateScript(code)?.toBool() != true {print("FAIL: \(label)");exit(1)}}
func frames(_ from:Int,_ to:Int){for i in from...to {run("commands=[];nativeFrame(\(i*16))")}}

frames(0,300)
run("nodes.whatsNewDismiss.click();nodes.endless.click();nodes.restart.click()")
check("endlessTest.data().endless && endlessTest.data().state==='play'", "Endless button starts actual gameplay")
run("var testedColors=[]")
for lap in 1...12 {
 run("endlessTest.jump(\(lap * 100000));endlessTest.step(0.016)")
 check("endlessTest.data().state==='play' && endlessTest.data().endlessLoop===\(lap)","continues through stretch \(lap + 1)")
 check("endlessTest.data().water>74 && endlessTest.data().score>=\(lap * 100000)","boundary restores water and preserves distance")
 run("endlessTest.jump(\(lap * 100000 + 1000));endlessTest.step(0.016);var generation=endlessTest.rows()")
 check("generation.spawnDist>generation.dist && generation.showers>0", "rain and generation continue beyond original endpoint")
 run("testedColors.push(endlessTest.data().colors.join(','))")
 check("generation.hazards>0", "hazards continue in later stretches")
 run("commands=[];nativeFrame(\(10000+lap*16))")
}
check("new Set(testedColors).size>=5", "later stretches have different palettes")
run("endlessTest.finish()")
check("endlessTest.data().endlessBest>1200000 && endlessTest.data().best===0", "Endless high score stays separate")
run("nodes.again.click();nodes.restart.click()")
check("endlessTest.data().endless && endlessTest.data().endlessLoop===0", "replay keeps Endless and resets stretch")
run("nodes.toMenu.click();nodes.play.click();nodes.restart.click();endlessTest.jump(100000);endlessTest.step(0.016)")
check("!endlessTest.data().endless && endlessTest.data().state==='victory' && endlessTest.data().score===100000", "normal Play still wins at 100000")
check("endlessTest.data().best===100000 && endlessTest.data().endlessBest>1200000", "normal and Endless records remain independent")
if !errors.isEmpty {exit(1)}
print("PASS: Endless menu, 12 boundaries, continued hazards/rain, recovery, replay, separate records, and normal victory")
