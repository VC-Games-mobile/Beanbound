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
for (file,prefix) in [("dom.json","var nativeDOM = "),("host.js",""),("game.js","")] {js.evaluateScript(prefix+(try! String(contentsOfFile:base+file,encoding:.utf8)),withSourceURL:URL(fileURLWithPath:file))}
func run(_ code:String){js.evaluateScript(code)}
func check(_ code:String,_ label:String){if js.evaluateScript(code)?.toBool() != true {print("FAIL: \(label)");exit(1)}}
func frames(_ from:Int,_ to:Int){for i in from...to {run("commands=[];nativeFrame(\(i*16))")}}
frames(0,300)
if !tones.contains(where:{$0.wave == "triangle" && $0.volume > 0.01}) || !tones.contains(where:{$0.wave == "sine" && $0.volume > 0.01}) {print("FAIL: original menu melody and accompaniment reach native audio");exit(1)}
check("beanbound.snapshot().overlay === 'start'","splash transitions to main menu")
run("nodes.settingsBtn.click()")
check("beanbound.snapshot().overlay === 'settings'","settings opens")
run("nodes.openEvos.click()")
check("beanbound.snapshot().overlay === 'evos' && nodes.evoList.children.length === 10","all evolution previews execute")
run("beanbound.back();beanbound.back();nodes.restart.click()")
check("beanbound.snapshot().state === 'play'","start native run")
run("var startX=beanbound.snapshot().playerX;beanbound.steering(1)")
frames(301,330)
check("beanbound.snapshot().playerX > startX","remote axis steers right")
run("beanbound.steering(0);beanbound.pause()")
check("beanbound.snapshot().state === 'paused' && beanbound.snapshot().overlay === 'pause'","Play/Pause pauses")
let pausedScore=js.evaluateScript("beanbound.snapshot().score")!.toInt32()
frames(331,360)
check("beanbound.snapshot().score === \(pausedScore)","paused gameplay stays frozen")
run("nodes.resume.click()")
check("beanbound.snapshot().state === 'countdown'","resume uses countdown")
frames(361,580)
check("beanbound.snapshot().state === 'play' || beanbound.snapshot().state === 'over'","countdown resumes simulation")
run("beanbound.background()")
check("beanbound.snapshot().state !== 'play'","background pauses active run")
run("nodes.toMenu.click();nodes.settingsBtn.click();nodes.resetProgress.click()")
check("beanbound.snapshot().overlay === 'resetConfirm'","progress reset requires confirmation")
run("nodes.resetConfirmNo.click()")
check("beanbound.snapshot().overlay === 'settings'","cancel reset returns to settings")
check("commands.some(c=>c[0] === 'fill') && commands.some(c=>c[0] === 'setTransform')","native rendering commands emitted")
run("""
nativePackedFrame(10000,0);
var decoded=[],cursor=0;
while(cursor<nativePackedLength){
 const op=nativeOps[nativePackedNumbers[cursor++]],n=nativePackedNumbers[cursor++],cmd=[op];
 for(let i=0;i<n;i++){const type=nativePackedNumbers[cursor++],v=nativePackedNumbers[cursor++];cmd.push(type===0?v:type===2?!!v:nativePackedValues[v])}
 decoded.push(cmd);
}
""")
check("JSON.stringify(decoded) === JSON.stringify(commands)","packed transfer preserves all canvas operations and styles")
run("nodes.soundToggle.click()")
tones.removeAll()
for i in 101...120 {run("nativeFrame(\(i*100))")}
if tones.contains(where:{$0.volume > 0.001}) {print("FAIL: muted music remains audible");exit(1)}
run("nodes.soundToggle.click()")
tones.removeAll()
for i in 121...140 {run("nativeFrame(\(i*100))")}
if !tones.contains(where:{$0.volume > 0.01}) {print("FAIL: unmuting restores music");exit(1)}
if !errors.isEmpty {exit(1)}
print("PASS: native engine startup, menus, evolutions, steering, pause, resume, background, reset cancellation, canvas rendering, original music, mute and unmute")
