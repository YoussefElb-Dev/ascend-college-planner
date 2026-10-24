import AppKit
let root = CommandLine.arguments[1]
let folder = URL(fileURLWithPath:root).appendingPathComponent("Ascend/Assets.xcassets")
let iconFolder = folder.appendingPathComponent("AppIcon.appiconset")
try FileManager.default.createDirectory(at:iconFolder,withIntermediateDirectories:true)
let assets=URL(fileURLWithPath:root).deletingLastPathComponent().appendingPathComponent("dist/assets")
let source=NSImage(contentsOf:assets.appendingPathComponent("ascend-app-icon.png"))!
let rect=NSRect(x:0,y:0,width:1024,height:1024)
let rep=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:1024,pixelsHigh:1024,bitsPerSample:8,samplesPerPixel:3,hasAlpha:false,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:rep)
NSColor.white.setFill();rect.fill();source.draw(in:rect)
NSGraphicsContext.restoreGraphicsState()
try rep.representation(using:.png,properties:[:])!.write(to:iconFolder.appendingPathComponent("AppIcon.png"))
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
