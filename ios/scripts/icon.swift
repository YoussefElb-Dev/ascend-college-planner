import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let root = CommandLine.arguments[1]
let folder = URL(fileURLWithPath:root).appendingPathComponent("Ascend/Assets.xcassets")
let iconFolder = folder.appendingPathComponent("AppIcon.appiconset")
try FileManager.default.createDirectory(at:iconFolder,withIntermediateDirectories:true)
let assets=URL(fileURLWithPath:root).deletingLastPathComponent().appendingPathComponent("dist/assets")
let source=CGImageSourceCreateWithURL(assets.appendingPathComponent("ascend-app-icon.png") as CFURL,nil)!
let image=CGImageSourceCreateImageAtIndex(source,0,nil)!
let context=CGContext(data:nil,width:1024,height:1024,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue)!
let rect=CGRect(x:0,y:0,width:1024,height:1024)
context.setFillColor(CGColor(gray:1,alpha:1));context.fill(rect)
context.interpolationQuality = .high
context.draw(image,in:rect)
let output=CGImageDestinationCreateWithURL(iconFolder.appendingPathComponent("AppIcon.png") as CFURL,UTType.png.identifier as CFString,1,nil)!
CGImageDestinationAddImage(output,context.makeImage()!,nil)
guard CGImageDestinationFinalize(output) else {fatalError("Could not prepare app icon.")}
let contents=#"{"images":[{"filename":"AppIcon.png","idiom":"universal","platform":"ios","size":"1024x1024"}],"info":{"author":"xcode","version":1}}"#
try Data(contents.utf8).write(to:iconFolder.appendingPathComponent("Contents.json"))
try Data(#"{"info":{"author":"xcode","version":1}}"#.utf8).write(to:folder.appendingPathComponent("Contents.json"))
let accent=folder.appendingPathComponent("AccentColor.colorset")
try FileManager.default.createDirectory(at:accent,withIntermediateDirectories:true)
try Data(#"{"colors":[{"idiom":"universal","color":{"color-space":"srgb","components":{"red":"0.341","green":"0.302","blue":"0.400","alpha":"1.0"}}}],"info":{"author":"xcode","version":1}}"#.utf8).write(to:accent.appendingPathComponent("Contents.json"))
let markFolder=folder.appendingPathComponent("AscendMark.imageset")
try FileManager.default.createDirectory(at:markFolder,withIntermediateDirectories:true)
let mark=markFolder.appendingPathComponent("AscendMark.png")
if FileManager.default.fileExists(atPath:mark.path){try FileManager.default.removeItem(at:mark)}
try FileManager.default.copyItem(at:assets.appendingPathComponent("ascend-mark.png"),to:mark)
try Data(#"{"images":[{"filename":"AscendMark.png","idiom":"universal"}],"info":{"author":"xcode","version":1}}"#.utf8).write(to:markFolder.appendingPathComponent("Contents.json"))
print("Prepared generated Ascend logo and opaque app icon.")
