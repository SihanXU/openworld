// Technical imagegen export only: preserve generated color/alpha and sample to 64px.
// No repainting, synthetic replacement, background removal, or palette substitution.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 3 else {
    fatalError("usage: export-skill-icon <generated-source.png> <new-icon.png>")
}
let source = URL(fileURLWithPath: CommandLine.arguments[1])
let destination = URL(fileURLWithPath: CommandLine.arguments[2])
precondition(!FileManager.default.fileExists(atPath: destination.path), "Refusing to replace existing artwork")
let imageSource = CGImageSourceCreateWithURL(source as CFURL, nil)!
let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)!
precondition(image.width == image.height, "Skill illustrations need a square canvas")
let size = 64
let flags = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue
let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                        bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: flags)!
context.interpolationQuality = .none
context.setShouldAntialias(false)
context.draw(image, in: CGRect(x: 0, y: 0, width: size, height: size))
let pixels = context.data!.assumingMemoryBound(to: UInt8.self)
var transparent = 0
var visible = 0
for index in 0..<(size * size) {
    let alpha = pixels[index * 4 + 3]
    if alpha == 0 { transparent += 1 }
    if alpha > 128 { visible += 1 }
}
precondition(transparent > size * size / 3, "Generated image lacks generous real transparent padding")
precondition(visible > 100 && visible < size * size * 3 / 4, "Empty or overly crowded illustration")
for index in [0, size - 1, (size - 1) * size, size * size - 1] {
    precondition(pixels[index * 4 + 3] == 0, "Generated background is not transparent")
}
let output = CGImageDestinationCreateWithURL(destination as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(output, context.makeImage()!, nil)
precondition(CGImageDestinationFinalize(output), "PNG export failed")
print("\(destination.lastPathComponent): 64x64 RGBA, \(transparent) transparent pixels, \(visible) visible pixels")
