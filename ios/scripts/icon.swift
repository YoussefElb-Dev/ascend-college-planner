import AppKit
let root = CommandLine.arguments[1]
let folder = URL(fileURLWithPath: root).appendingPathComponent("Ascend/Assets.xcassets")
let iconFolder = folder.appendingPathComponent("AppIcon.appiconset")
try FileManager.default.createDirectory(at: iconFolder, withIntermediateDirectories: true)
let image = NSImage(size: NSSize(width: 1024, height: 1024))
image.lockFocus()
let rectangle = NSRect(x: 0, y: 0, width: 1024, height: 1024)
let gradient = NSGradient(starting: NSColor(srgbRed: 0.88, green: 0.87, blue: 0.97, alpha: 1), ending: NSColor(srgbRed: 0.76, green: 0.87, blue: 0.84, alpha: 1))!
gradient.draw(in: rectangle, angle: -65)
let paragraph = NSMutableParagraphStyle(); paragraph.alignment = .center
let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 650, weight: .semibold), .foregroundColor: NSColor(srgbRed: 0.25, green: 0.23, blue: 0.40, alpha: 1), .paragraphStyle: paragraph, .kern: -30]
("a." as NSString).draw(in: NSRect(x: -5, y: 150, width: 1024, height: 800), withAttributes: attributes)
image.unlockFocus()
let representation = NSBitmapImageRep(data: image.tiffRepresentation!)!
try representation.representation(using: .png, properties: [:])!.write(to: iconFolder.appendingPathComponent("AppIcon.png"))
let contents = """
{"images":[{"filename":"AppIcon.png","idiom":"universal","platform":"ios","size":"1024x1024"}],"info":{"author":"xcode","version":1}}
"""
try Data(contents.utf8).write(to: iconFolder.appendingPathComponent("Contents.json"))
try Data("{\"info\":{\"author\":\"xcode\",\"version\":1}}".utf8).write(to: folder.appendingPathComponent("Contents.json"))
let accent = folder.appendingPathComponent("AccentColor.colorset"); try FileManager.default.createDirectory(at: accent, withIntermediateDirectories: true)
try Data("{\"colors\":[{\"idiom\":\"universal\",\"color\":{\"color-space\":\"srgb\",\"components\":{\"red\":\"0.36\",\"green\":\"0.32\",\"blue\":\"0.62\",\"alpha\":\"1.0\"}}}],\"info\":{\"author\":\"xcode\",\"version\":1}}".utf8).write(to: accent.appendingPathComponent("Contents.json"))
print("Generated native wordmark icon and accent color.")
