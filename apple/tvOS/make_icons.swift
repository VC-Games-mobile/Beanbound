import AppKit
import CoreText
import Foundation
let root=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Beanbound/Assets.xcassets")
let fontURL=URL(fileURLWithPath:#filePath).deletingLastPathComponent().appendingPathComponent("Beanbound/Resources/BagelFatOne-400.ttf")
CTFontManagerRegisterFontsForURL(fontURL as CFURL,.process,nil)
let fm=FileManager.default
let info:[String:Any]=["author":"xcode","version":1]
func json(_ url:URL,_ value:[String:Any]){try! fm.createDirectory(at:url.deletingLastPathComponent(),withIntermediateDirectories:true);try! JSONSerialization.data(withJSONObject:value,options:.prettyPrinted).write(to:url)}
func icon(_ width:Int,_ height:Int,_ layer:String,_ out:URL) {
    let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:width,pixelsHigh:height,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
    NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)
    let c=NSGraphicsContext.current!.cgContext;c.scaleBy(x:CGFloat(width)/400,y:CGFloat(height)/240)
    if layer=="Background" {
        let colors=[NSColor(calibratedRed:0.07,green:0.19,blue:0.17,alpha:1).cgColor,NSColor(calibratedRed:0.24,green:0.55,blue:0.48,alpha:1).cgColor] as CFArray
        c.drawLinearGradient(CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:colors,locations:[0,1])!,start:CGPoint(x:0,y:0),end:CGPoint(x:400,y:240),options:[])
        for i in 0..<20 {c.setFillColor(NSColor(calibratedRed:1,green:0.85,blue:0.42,alpha:0.22).cgColor);c.fillEllipse(in:CGRect(x:(i*73)%390,y:(i*41)%230,width:3,height:3))}
    } else if layer=="Foreground" {
        let text="Beanbound" as NSString
        let a:[NSAttributedString.Key:Any]=[.font:(NSFont(name:"BagelFatOne-Regular",size:44) ?? NSFont.systemFont(ofSize:44,weight:.heavy)),.foregroundColor:NSColor(calibratedRed:1,green:0.85,blue:0.42,alpha:1)]
        let size=text.size(withAttributes:a);text.draw(at:CGPoint(x:(400-size.width)/2,y:45),withAttributes:a)
        c.setStrokeColor(NSColor(calibratedRed:0.3,green:0.8,blue:0.52,alpha:1).cgColor);c.setLineWidth(8);c.move(to:CGPoint(x:200,y:110));c.addLine(to:CGPoint(x:200,y:170));c.strokePath()
        c.setFillColor(NSColor(calibratedRed:0.37,green:0.83,blue:0.55,alpha:1).cgColor)
        c.saveGState();c.translateBy(x:190,y:165);c.rotate(by:-0.35);c.fillEllipse(in:CGRect(x:-35,y:-5,width:45,height:22));c.restoreGState()
        c.saveGState();c.translateBy(x:207,y:169);c.rotate(by:0.35);c.fillEllipse(in:CGRect(x:0,y:-5,width:45,height:22));c.restoreGState()
    }
    NSGraphicsContext.restoreGraphicsState();try! bitmap.representation(using:.png,properties:[:])!.write(to:out)
}
json(root.appendingPathComponent("Contents.json"),["info":info])
let brand=root.appendingPathComponent("AppIcon.brandassets")
var assets:[[String:String]]=[]
for (name,w,h,scales) in [("App Icon",400,240,[1,2]),("App Store",1280,768,[1])] {
    let stack=brand.appendingPathComponent(name+".imagestack")
    json(stack.appendingPathComponent("Contents.json"),["info":info,"layers":[["filename":"Foreground.imagestacklayer"],["filename":"Background.imagestacklayer"]]])
    for layer in ["Foreground","Background"] {
        let dir=stack.appendingPathComponent(layer+".imagestacklayer/Content.imageset")
        var images:[[String:String]]=[]
        for scale in scales {
            try! fm.createDirectory(at:dir,withIntermediateDirectories:true)
            let file="image@\(scale)x.png";icon(w*scale,h*scale,layer,dir.appendingPathComponent(file))
            images.append(["filename":file,"idiom":"tv","scale":"\(scale)x"])
        }
        json(dir.appendingPathComponent("Contents.json"),["info":info,"images":images])
    }
    assets.append(["filename":name+".imagestack","idiom":"tv","size":"\(w)x\(h)","role":"primary-app-icon"])
}
json(brand.appendingPathComponent("Contents.json"),["info":info,"assets":assets])
let preview=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:800,pixelsHigh:480,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:preview)
for layer in ["Background","Foreground"] {
    let url=brand.appendingPathComponent("App Icon.imagestack/\(layer).imagestacklayer/Content.imageset/image@2x.png")
    let image=NSBitmapImageRep(data:try! Data(contentsOf:url))!.cgImage!
    NSGraphicsContext.current!.cgContext.draw(image,in:CGRect(x:0,y:0,width:800,height:480))
}
NSGraphicsContext.restoreGraphicsState()
try! preview.representation(using:.png,properties:[:])!.write(to:root.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("icon-preview.png"))
