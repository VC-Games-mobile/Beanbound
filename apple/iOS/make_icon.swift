import AppKit
import Foundation

// Preserve the supplied artwork; resize only for the required App Store asset.
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let source = root.appendingPathComponent("IconSource/Beanbound.png")
let destination = root.appendingPathComponent("Beanbound/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
let image = NSBitmapImageRep(data: try Data(contentsOf: source))!.cgImage!
let context = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
context.interpolationQuality = .high
context.draw(image, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
try NSBitmapImageRep(cgImage: context.makeImage()!).representation(using: .png, properties: [:])!.write(to: destination)
