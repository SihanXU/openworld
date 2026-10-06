// A review contact sheet of existing PNGs; this does not create or repaint artwork.
// Run from the repository root: swift packages/tools/src/art/preview-skill-icons.swift
import AppKit
import Foundation

struct Manifest: Decodable {
    struct Asset: Decodable {
        let id: String
        let name: String
        let branch: String
        let file: String
    }
    let references: [String]
    let assets: [Asset]
}
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let manifest = try JSONDecoder().decode(Manifest.self, from: Data(contentsOf: root.appendingPathComponent("docs/skill-art-prompts.json")))
let columns = 8
let cellWidth = 160
let cellHeight = 184
let margin = 24
let header = 188
let rows = (manifest.assets.count + columns - 1) / columns
let width = columns * cellWidth + margin * 2
let height = header + rows * cellHeight + margin
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: width * 4, bitsPerPixel: 32)!
NSGraphicsContext.saveGraphicsState()
let context = NSGraphicsContext(bitmapImageRep: bitmap)!
NSGraphicsContext.current = context
context.imageInterpolation = .none

func rect(_ x: Int, _ y: Int, _ w: Int, _ h: Int) -> NSRect {
    NSRect(x: x, y: height - y - h, width: w, height: h)
}
func label(_ value: String, _ x: Int, _ y: Int, _ w: Int, _ size: CGFloat,
           color: NSColor = NSColor(calibratedRed: 0.92, green: 0.88, blue: 0.78, alpha: 1), centered: Bool = false) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = centered ? .center : .left
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: size > 20 ? .semibold : .regular),
        .foregroundColor: color, .paragraphStyle: paragraph
    ]
    (value as NSString).draw(in: rect(x, y, w, 36), withAttributes: attributes)
}
func icon(_ file: String, _ x: Int, _ y: Int, _ size: Int) {
    let path = root.appendingPathComponent(file).path
    guard let image = NSImage(contentsOfFile: path) else { fatalError("Missing icon: \(file)") }
    image.draw(in: rect(x, y, size, size), from: .zero, operation: .sourceOver, fraction: 1)
}

NSColor(calibratedRed: 0.11, green: 0.13, blue: 0.12, alpha: 1).setFill()
NSBezierPath(rect: rect(0, 0, width, height)).fill()
label("SYMBOLIC WORLD / Skill illustrations", margin, 22, 850, 28)
label("41 missing talents + 3 profession entrances · Built-in imagegen · 64 × 64 RGBA", margin, 66, 900, 16)
label("Warm outlines / copper fittings / full-colour handcrafted pixel art", margin, 98, 900, 15)
label("Existing artwork preserved. Reference icons →", margin, 130, 880, 14)
for (index, reference) in manifest.references.enumerated() {
    icon(reference, width - margin - 256 + index * 128, 28, 128)
}

let muted = NSColor(calibratedRed: 0.65, green: 0.69, blue: 0.61, alpha: 1)
for (index, asset) in manifest.assets.enumerated() {
    let x = margin + (index % columns) * cellWidth
    let y = header + (index / columns) * cellHeight
    NSColor(calibratedRed: 0.16, green: 0.18, blue: 0.16, alpha: 1).setFill()
    NSBezierPath(roundedRect: rect(x + 4, y, cellWidth - 8, cellHeight - 8), xRadius: 8, yRadius: 8).fill()
    icon(asset.file, x + 16, y + 4, 128)
    label(asset.name, x + 4, y + 134, cellWidth - 8, 15, centered: true)
    label(asset.id, x + 2, y + 157, cellWidth - 4, 11, color: muted, centered: true)
}
NSGraphicsContext.restoreGraphicsState()
let destination = root.appendingPathComponent("docs/skill-art-complete-preview.png")
try bitmap.representation(using: .png, properties: [:])!.write(to: destination)
print("\(destination.path): \(width) × \(height), \(manifest.assets.count) new icons plus preserved references")
