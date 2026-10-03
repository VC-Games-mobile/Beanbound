import UIKit
import CoreText

enum GameFonts {
    static func register() {
        for name in ["BagelFatOne-400","Figtree-500","Figtree-700"] {
            if let url=Bundle.main.url(forResource:name,withExtension:"ttf") {CTFontManagerRegisterFontsForURL(url as CFURL,.process,nil)}
        }
    }
    static func display(_ size:CGFloat)->UIFont {UIFont(name:"BagelFatOne-Regular",size:size) ?? .systemFont(ofSize:size,weight:.heavy)}
    static func body(_ size:CGFloat,bold:Bool=false)->UIFont {UIFont(name:bold ? "FigtreeLight-Bold" : "FigtreeLight-Medium",size:size) ?? .systemFont(ofSize:size,weight:bold ? .bold : .medium)}
    static func canvas(_ css:String,size:CGFloat)->UIFont {css.contains("Bagel") ? display(size) : body(size,bold:css.contains("700") || css.contains("bold"))}
}
