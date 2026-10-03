import UIKit

struct CanvasFrame {
    let numbers:[Double]
    let values:[Any]
    static let ops=["property","arc","arcTo","beginPath","bezierCurveTo","clip","closePath","ellipse","fill","fillRect","fillText","lineTo","moveTo","quadraticCurveTo","rect","restore","rotate","roundRect","save","scale","setLineDash","setTransform","stroke","strokeRect","strokeText","translate","clearRect","drawImage","sprite"]
}

/// Replays the existing game's Canvas 2D operations using Core Graphics.
final class CanvasView: UIView {
    // Never queue old frames: remote input stays responsive while drawing runs.
    private(set) var isRendering = false
    private var pendingFrame: CanvasFrame?
    private var rasterWidth: CGFloat = 1280
    private var bitmapRenderer:UIGraphicsImageRenderer?
    private var bitmapSize:CGSize = .zero
    private var bitmapWidth:CGFloat = 0
    private let renderQueue = DispatchQueue(label:"beanbound.renderer",qos:.userInitiated)
    private var colorCache: [String:UIColor] = [:]
    private var spriteCache:[String:UIImage]=[:]
    private var fontCache: [String:UIFont] = [:]
    private(set) var lastDrawMilliseconds: Double = 0
    var onRendered: ((Double)->Void)?
    func submit(_ commands:CanvasFrame) {
        guard bounds.width > 0 else {return}
        if isRendering {pendingFrame=commands;return}
        isRendering=true
        let size=bounds.size, width=rasterWidth
        renderQueue.async { [weak self] in
            guard let self else {return}
            let started=CACurrentMediaTime()
            if self.bitmapRenderer==nil || self.bitmapSize != size || self.bitmapWidth != width {
                let format=UIGraphicsImageRendererFormat();format.opaque=true;format.preferredRange = .standard
                format.scale=min(1,width/size.width)
                self.bitmapRenderer=UIGraphicsImageRenderer(size:size,format:format)
                self.bitmapSize=size;self.bitmapWidth=width
            }
            let frame=self.bitmapRenderer!.image{context in self.replay(commands,in:context.cgContext)}
            let elapsed=(CACurrentMediaTime()-started)*1000
            DispatchQueue.main.async {
                self.layer.contents=frame.cgImage
                self.lastDrawMilliseconds=elapsed
                self.isRendering=false
                self.onRendered?(elapsed)
                // Match resolution to the device's drawing budget, without a frame backlog.
                if elapsed>34 && self.rasterWidth>960 {self.rasterWidth=960} else if elapsed>34 && self.rasterWidth>800 {self.rasterWidth=800}
                if let pending=self.pendingFrame {self.pendingFrame=nil;self.submit(pending)}
            }
        }
    }
    struct PaintState {
        var fill: Any = "#000000", stroke: Any = "#000000"
        var alpha: CGFloat = 1, width: CGFloat = 1
        var font = "10px sans-serif", align = "start"
    }
    private var state = PaintState()
    private var stack: [PaintState] = []
    private var path = CGMutablePath()
    private var base = CGAffineTransform.identity
    private func replay(_ commands:CanvasFrame,in c:CGContext) {
        base = c.ctm; state = PaintState(); stack = []; path = CGMutablePath()
        var cursor=0
        while cursor<commands.numbers.count {
            let op=CanvasFrame.ops[Int(commands.numbers[cursor])]
            let count=Int(commands.numbers[cursor+1]);cursor+=2
            var a:[Any]=[];a.reserveCapacity(count)
            for _ in 0..<count {
                let type=Int(commands.numbers[cursor]),value=commands.numbers[cursor+1];cursor+=2
                if type==0 {a.append(value)} else if type==2 {a.append(value != 0)} else {a.append(commands.values[Int(value)])}
            }
            func n(_ i: Int) -> CGFloat { i < a.count ? CGFloat(a[i] as? Double ?? 0) : 0 }
            func p(_ i: Int) -> CGPoint { CGPoint(x:n(i), y:n(i+1)) }
            func r() -> CGRect { CGRect(x:n(0), y:n(1), width:n(2), height:n(3)) }
            switch op {
            case "property":
                guard a.count > 1, let key = a[0] as? String else { continue }
                let v = a[1]
                switch key {
                case "fillStyle": state.fill = v
                case "strokeStyle": state.stroke = v
                case "globalAlpha": state.alpha = CGFloat(v as? Double ?? 1); c.setAlpha(state.alpha)
                case "lineWidth": state.width = CGFloat(v as? Double ?? 1); c.setLineWidth(state.width)
                case "lineCap": c.setLineCap((v as? String)=="round" ? .round : .butt)
                case "lineJoin": c.setLineJoin((v as? String)=="round" ? .round : .miter)
                case "font": state.font = v as? String ?? state.font
                case "textAlign": state.align = v as? String ?? state.align
                default: break
                }
            case "sprite":
                guard let key=a[0] as? String,let source=a[5] as? String else {continue}
                let image:UIImage
                if let cached=spriteCache[key] {image=cached} else {
                    guard let legacy=(try? JSONSerialization.jsonObject(with:Data(source.utf8))) as? [[Any]] else {continue}
                    let frame=Self.pack(legacy)
                    let previousState=state,previousStack=stack,previousPath=path,previousBase=base
                    let format=UIGraphicsImageRendererFormat();format.scale=1.5;format.opaque=false;format.preferredRange = .standard
                    image=UIGraphicsImageRenderer(size:CGSize(width:n(3),height:n(4)),format:format).image{self.replay(frame,in:$0.cgContext)}
                    state=previousState;stack=previousStack;path=previousPath;base=previousBase
                    if spriteCache.count>64 {spriteCache.removeAll(keepingCapacity:true)}
                    spriteCache[key]=image
                }
                image.draw(in:CGRect(x:n(1),y:n(2),width:n(3),height:n(4)))
            case "save": c.saveGState(); stack.append(state)
            case "restore": if let s = stack.popLast() { c.restoreGState(); state = s }
            case "setTransform":
                c.concatenate(c.ctm.inverted()); c.concatenate(base)
                c.concatenate(CGAffineTransform(a:n(0),b:n(1),c:n(2),d:n(3),tx:n(4),ty:n(5)))
            case "translate": c.translateBy(x:n(0),y:n(1))
            case "scale": c.scaleBy(x:n(0),y:n(1))
            case "rotate": c.rotate(by:n(0))
            case "beginPath": path = CGMutablePath()
            case "closePath": path.closeSubpath()
            case "moveTo": path.move(to:p(0))
            case "lineTo": path.addLine(to:p(0))
            case "bezierCurveTo": path.addCurve(to:p(4),control1:p(0),control2:p(2))
            case "quadraticCurveTo": path.addQuadCurve(to:p(2),control:p(0))
            case "arcTo": path.addArc(tangent1End:p(0),tangent2End:p(2),radius:n(4))
            case "arc": path.addArc(center:p(0),radius:max(0,n(2)),startAngle:n(3),endAngle:n(4),clockwise:(a.count>5 ? a[5] as? Bool : nil) ?? false)
            case "ellipse":
                let t = CGAffineTransform(translationX:n(0),y:n(1)).rotated(by:n(4)).scaledBy(x:max(0.001,n(2)),y:max(0.001,n(3)))
                path.addArc(center:.zero,radius:1,startAngle:n(5),endAngle:n(6),clockwise:(a.count>7 ? a[7] as? Bool : nil) ?? false,transform:t)
            case "rect": path.addRect(r())
            case "roundRect":
                let radius = (a.count>4 ? a[4] as? Double : nil) ?? 8
                path.addRoundedRect(in:r(),cornerWidth:radius,cornerHeight:radius)
            case "clip": c.addPath(path); c.clip()
            case "fill": paint(c,path:path,style:state.fill)
            case "stroke": c.setStrokeColor(cachedColor(state.stroke).cgColor);c.addPath(path);c.strokePath()
            case "fillRect": paint(c,path:CGPath(rect:r(),transform:nil),style:state.fill)
            case "strokeRect": c.setStrokeColor(cachedColor(state.stroke).cgColor);c.stroke(r())
            case "setLineDash": c.setLineDash(phase:0,lengths:(a.first as? [NSNumber] ?? []).map{CGFloat($0.doubleValue)})
            case "fillText", "strokeText":
                guard let text = a.first as? String else { continue }
                let parts = state.font.components(separatedBy:"px")
                let size = Double(parts.first?.split(separator:" ").last ?? "10") ?? 10
                let font: UIFont
                if let cached=fontCache[state.font] {font=cached} else {font=GameFonts.canvas(state.font,size:size);fontCache[state.font]=font}
                var attrs: [NSAttributedString.Key:Any] = [.font:font,.foregroundColor:cachedColor(state.fill)]
                if op=="strokeText" { attrs[.strokeColor]=cachedColor(state.stroke);attrs[.strokeWidth]=state.width / max(1,size)*100;attrs[.foregroundColor]=UIColor.clear }
                let width = (text as NSString).size(withAttributes:attrs).width
                let x = n(1)-(state.align=="center" ? width/2 : state.align=="right" ? width : 0)
                (text as NSString).draw(at:CGPoint(x:x,y:n(2)-font.ascender),withAttributes:attrs)
            default: break
            }
        }
        while !stack.isEmpty { c.restoreGState();stack.removeLast() }
    }
    private func paint(_ c: CGContext,path:CGPath,style:Any) {
        guard let g = style as? [String:Any], let stops = g["stops"] as? [[Any]], let args = g["args"] as? [NSNumber], stops.count>1 else {
            c.setFillColor(cachedColor(style).cgColor);c.addPath(path);c.fillPath();return
        }
        let sorted = stops.sorted { (($0[0] as? NSNumber)?.doubleValue ?? 0) < (($1[0] as? NSNumber)?.doubleValue ?? 0) }
        let colors = sorted.map { cachedColor($0[1]).cgColor } as CFArray
        let positions = sorted.map { CGFloat(($0[0] as? NSNumber)?.doubleValue ?? 0) }
        guard let gradient = CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:colors,locations:positions) else { return }
        let a = args.map{CGFloat($0.doubleValue)}
        c.saveGState();c.addPath(path);c.clip()
        if g["type"] as? String == "radial", a.count==6 {
            c.drawRadialGradient(gradient,startCenter:CGPoint(x:a[0],y:a[1]),startRadius:a[2],endCenter:CGPoint(x:a[3],y:a[4]),endRadius:a[5],options:[.drawsBeforeStartLocation,.drawsAfterEndLocation])
        } else if a.count==4 {
            c.drawLinearGradient(gradient,start:CGPoint(x:a[0],y:a[1]),end:CGPoint(x:a[2],y:a[3]),options:[.drawsBeforeStartLocation,.drawsAfterEndLocation])
        }
        c.restoreGState()
    }
    private static func pack(_ commands:[[Any]])->CanvasFrame {
        var numbers:[Double]=[],values:[Any]=[]
        for cmd in commands {
            guard let op=cmd.first as? String,let code=CanvasFrame.ops.firstIndex(of:op) else {continue}
            numbers.append(Double(code));numbers.append(Double(cmd.count-1))
            for v in cmd.dropFirst() {
                if let num=v as? NSNumber {numbers.append(0);numbers.append(num.doubleValue)}
                else {numbers.append(1);numbers.append(Double(values.count));values.append(v)}
            }
        }
        return CanvasFrame(numbers:numbers,values:values)
    }
    private func cachedColor(_ value:Any)->UIColor {
        guard let key=value as? String else {return .black}
        if let c=colorCache[key] {return c}
        let c=Self.color(key)
        if colorCache.count>1024 {colorCache.removeAll(keepingCapacity:true)}
        colorCache[key]=c;return c
    }
    static func color(_ value: Any) -> UIColor {
        guard let s = value as? String else { return .black }
        if s.hasPrefix("#") {
            var hex = String(s.dropFirst());if hex.count==3 { hex=hex.map{String(repeating:String($0),count:2)}.joined() }
            guard let v = UInt32(hex,radix:16) else { return .black }
            return UIColor(red:CGFloat((v>>16)&255)/255,green:CGFloat((v>>8)&255)/255,blue:CGFloat(v&255)/255,alpha:1)
        }
        let nums = s.components(separatedBy:CharacterSet(charactersIn:"0123456789.-").inverted).compactMap(Double.init)
        if s.hasPrefix("rgb"), nums.count>=3 { return UIColor(red:nums[0]/255,green:nums[1]/255,blue:nums[2]/255,alpha:nums.count>3 ? nums[3] : 1) }
        if s.hasPrefix("hsl"),nums.count>=3 {
            let l=nums[2]/100,sat=nums[1]/100,b=l+sat*min(l,1-l)
            return UIColor(hue:nums[0]/360,saturation:b==0 ? 0 : 2*(1-l/b),brightness:b,alpha:nums.count>3 ? nums[3] : 1)
        }
        return s=="transparent" ? .clear : s=="white" ? .white : .black
    }
}
