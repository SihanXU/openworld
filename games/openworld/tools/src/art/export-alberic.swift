// Technical export of approved imagegen sheets only: cell extraction, shared nearest-neighbour
// scale and ground alignment. Never paints, recolours, removes a background or touches legacy art.
// Run at the repository root: swift games/openworld/tools/src/art/export-alberic.swift [--v2|--v4|--v5] [--partial]
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
import AppKit
import CryptoKit

struct Manifest: Decodable {
    struct Asset: Decodable {
        struct Sheet: Decodable { let source: String, columns: Int, rows: Int, frames: Int }
        let id: String, name: String, kind: String, source: String
        let row: Int?, columns: Int, rows: Int, frames: Int
        let size: Int?, originY: Double?
        let sampling: Double?
        let sheets: [Sheet]?
    }
    struct Export: Decodable {
        let directory: String, bodyCell: Int, bodyColumns: Int, bodyRows: Int, bodyAnchorY: Int
        let bodySampling: Double, effectSampling: Double
        let directions: [String]?, reviewDirectory: String?
        let registrationAtlas: String?
    }
    let assets: [Asset]
    let export: Export
}
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let manifestPath = CommandLine.arguments.contains("--v2") ? "docs/alberic-art-prompts.json"
    : CommandLine.arguments.contains("--v5") ? "docs/alberic-art-v5-prompts.json"
    : CommandLine.arguments.contains("--v4") ? "docs/alberic-art-v4-prompts.json" : "docs/alberic-art-v3-prompts.json"
let manifest = try JSONDecoder().decode(Manifest.self, from: Data(contentsOf: root.appendingPathComponent(manifestPath)))
let directions = manifest.export.directions ?? ["right"]
let actionsPerDirection = manifest.export.bodyRows / directions.count
let poses = manifest.export.bodyColumns
let partial = CommandLine.arguments.contains("--partial")
let out = root.appendingPathComponent(manifest.export.directory)
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
let review = root.appendingPathComponent(manifest.export.reviewDirectory ?? "docs/boss-art/alberic-v2")
try FileManager.default.createDirectory(at: review, withIntermediateDirectories: true)
func context(_ width: Int, _ height: Int) -> CGContext {
    let flags = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue
    let c = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: flags)!
    c.interpolationQuality = .none
    c.setShouldAntialias(false)
    return c
}
func read(_ url: URL) -> CGImage {
    let source = CGImageSourceCreateWithURL(url as CFURL, nil)!
    return CGImageSourceCreateImageAtIndex(source, 0, nil)!
}
func write(_ image: CGImage, _ url: URL) {
    let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, image, nil)
    precondition(CGImageDestinationFinalize(dest), "PNG write failed")
}
if CommandLine.arguments.contains("--references") {
    let dense = CommandLine.arguments.contains("--v5")
    let referenceDir = root.appendingPathComponent("docs/boss-art/alberic-\(dense ? "v5" : "v4")/references")
    try FileManager.default.createDirectory(at: referenceDir, withIntermediateDirectories: true)
    let old = read(root.appendingPathComponent("games/openworld/public/assets/lsw/Bosses/alberic/\(dense ? "v4" : "v3")/actions.png"))
    for (direction, name) in ["down", "right", "up"].enumerated() {
        for (row, action) in ["idle", "walk", "thorns", "arrow", "volley", "hurt", "death"].enumerated() {
            let count = dense ? 12 : 4, columns = dense ? 4 : 2, rows = dense ? 3 : 2
            let sheet = context(columns * 256, rows * 256)
            for col in 0..<count {
                let frame = old.cropping(to: CGRect(x: col * 128, y: (direction * 7 + row) * 128, width: 128, height: 128))!
                sheet.draw(frame, in: CGRect(x: (col % columns) * 256, y: (rows - 1 - col / columns) * 256, width: 256, height: 256))
            }
            write(sheet.makeImage()!, referenceDir.appendingPathComponent("\(action)-\(name).png"))
        }
    }
    print("Packed existing poses into single-direction references; no pixels repainted.")
    exit(0)
}
struct Cell {
    let image: CGImage
    let logicalWidth: Double, logicalHeight: Double
    let xOffset: Double, yOffset: Double
    let bottom: Double
}
func bounds(_ image: CGImage) -> CGRect {
    let data = image.dataProvider!.data! as Data
    var left = image.width, top = image.height, right = 0, bottom = 0
    for y in 0..<image.height { for x in 0..<image.width {
        if data[y * image.bytesPerRow + x * 4 + 3] > 32 {
            left = min(left, x); right = max(right, x)
            top = min(top, y); bottom = max(bottom, y)
        }
    }}
    return CGRect(x: left, y: top, width: right - left + 1, height: bottom - top + 1)
}
func lowerBodyLine(_ cell: Cell) -> Double {
    let image = cell.image, data = image.dataProvider!.data! as Data
    var weights = [Double](repeating: 0, count: image.height)
    for y in 0..<image.height { for x in 0..<image.width {
        weights[y] += Double(data[y * image.bytesPerRow + x * 4 + 3])
    }}
    let threshold = weights.reduce(0, +) * 0.9
    var sum = 0.0
    for (y, weight) in weights.enumerated() {
        sum += weight
        if sum >= threshold { return Double(y) + cell.yOffset }
    }
    return cell.bottom + cell.yOffset
}
func horizontalCenter(_ cell: Cell) -> Double {
    let image = cell.image, data = image.dataProvider!.data! as Data
    var mass = 0.0, weightedX = 0.0
    for y in 0..<image.height { for x in 0..<image.width {
        let alpha = Double(data[y * image.bytesPerRow + x * 4 + 3])
        mass += alpha; weightedX += Double(x) * alpha
    }}
    return weightedX / mass + cell.xOffset
}
func cells(_ image: CGImage, _ id: String, _ columns: Int, _ rows: Int, _ frameCount: Int) -> [Cell] {
    let c = context(image.width, image.height)
    c.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
    let normalized = c.makeImage()!
    let data = normalized.dataProvider!.data! as Data
    let stride = normalized.bytesPerRow
    // Find genuinely empty gutters near the nominal cuts; never erase generated pixels.
    func cuts(_ divisions: Int, horizontal: Bool, crossFrom: Int = 0, crossTo: Int? = nil) -> [Int] {
        let length = horizontal ? image.width : image.height
        let cross = horizontal ? image.height : image.width
        var result = [0]
        for boundary in 1..<divisions {
            let nominal = length * boundary / divisions
            let tolerance = length / divisions / 4
            var best = nominal, bestCost = Double.greatestFiniteMagnitude
            for coordinate in (nominal - tolerance)...(nominal + tolerance) {
                var mass = 0
                for other in crossFrom..<(crossTo ?? cross) {
                    let x = horizontal ? coordinate : other, y = horizontal ? other : coordinate
                    mass += Int(data[y * stride + x * 4 + 3])
                }
                let cost = Double(mass) + Double(abs(coordinate - nominal)) * 0.01
                if cost < bestCost { bestCost = cost; best = coordinate }
            }
            result.append(best)
        }
        return result + [length]
    }
    let sharedXs = cuts(columns, horizontal: true), ys = cuts(rows, horizontal: false)
    var result: [Cell] = []
    for row in 0..<rows {
        // Wide fallen poses can have different gutters from standing poses. For v5,
        // locate each row's own cuts so a neighbour's cape never leaks into a cell.
        let xs = poses >= 32 ? cuts(columns, horizontal: true, crossFrom: ys[row], crossTo: ys[row + 1]) : sharedXs
        for col in 0..<columns {
        let x = xs[col], y = ys[row], w = xs[col + 1] - x, h = ys[row + 1] - y
        var visible = 0, transparent = 0, bottom = 0
        for yy in y..<(y + h) { for xx in x..<(x + w) {
            let alpha = data[yy * stride + xx * 4 + 3]
            if alpha == 0 { transparent += 1 }
            if alpha > 32 { visible += 1; bottom = max(bottom, yy - y) }
        }}
        precondition(visible > 30, "Missing frame in \(id) \(row),\(col)")
        precondition(transparent > w * h / 4, "\(id) needs genuine transparent padding")
        let cell = normalized.cropping(to: CGRect(x: x, y: y, width: w, height: h))!
        result.append(Cell(image: cell, logicalWidth: Double(image.width) / Double(columns),
            logicalHeight: Double(image.height) / Double(rows),
            xOffset: Double(x) - Double(col * image.width) / Double(columns),
            yOffset: Double(y) - Double(row * image.height) / Double(rows), bottom: Double(bottom + 1)))
    }}
    precondition(result.count == frameCount)
    return result
}

let bodySize = manifest.export.bodyCell
let registrationAtlas = manifest.export.registrationAtlas.map { read(root.appendingPathComponent($0)) }
let atlas = context(bodySize * manifest.export.bodyColumns, bodySize * manifest.export.bodyRows)
var bodyCount = 0
var rendered: [String: [CGImage]] = [:]
var report: [[String: Any]] = []
for asset in manifest.assets {
    let sheets = asset.sheets ?? [Manifest.Asset.Sheet(source: asset.source, columns: asset.columns, rows: asset.rows, frames: asset.frames)]
    if sheets.contains(where: { !FileManager.default.fileExists(atPath: root.appendingPathComponent($0.source).path) }) {
        precondition(partial, "Missing generated source: \(asset.id)")
        continue
    }
    var frames = sheets.flatMap { cells(read(root.appendingPathComponent($0.source)), asset.id, $0.columns, $0.rows, $0.frames) }
    precondition(frames.count == asset.frames)
    if poses > 4 && asset.kind == "body" {
        if asset.id == "idle" || asset.id == "walk" {
            // These loop sheets have a slightly narrower generated column pitch than the
            // nominal grid. Measure one offset per COLUMN across all source rows/facings,
            // then translate that whole column. Keep individual poses and gait sway intact.
            let columns = asset.columns
            let offsets = (0..<columns).map { column -> Double in
                let shifts = stride(from: 0, to: frames.count, by: columns).map { start in
                    horizontalCenter(frames[start]) - horizontalCenter(frames[start + column])
                }.sorted()
                return (shifts[(shifts.count - 1) / 2] + shifts[shifts.count / 2]) / 2
            }
            frames = frames.enumerated().map { index, c in
                Cell(image: c.image, logicalWidth: c.logicalWidth, logicalHeight: c.logicalHeight,
                    xOffset: c.xOffset + offsets[index % columns], yOffset: c.yOffset, bottom: c.bottom)
            }
        }
        // Generated sheets can leave different amounts of whitespace ABOVE each grid row.
        // Correct that row-wide packing offset, otherwise frame 4->5 and 8->9 jump vertically.
        // One median offset for a whole source row preserves the poses' relative motion;
        // no frame is stretched or independently fitted to its silhouette.
        for direction in 0..<directions.count {
            let columns = asset.sheets?[direction].columns ?? asset.columns
            let begin = direction * poses
            func medianLine(_ start: Int) -> Double {
                let lines = frames[start..<(start + columns)].map(lowerBodyLine).sorted()
                return (lines[(columns - 1) / 2] + lines[columns / 2]) / 2
            }
            let baseline = medianLine(begin)
            for row in 1..<(poses / columns) {
                let start = begin + row * columns, offset = baseline - medianLine(start)
                for i in start..<(start + columns) {
                    let c = frames[i]
                    frames[i] = Cell(image: c.image, logicalWidth: c.logicalWidth, logicalHeight: c.logicalHeight,
                        xOffset: c.xOffset, yOffset: c.yOffset + offset, bottom: c.bottom)
                }
            }
        }
    }
    let size = asset.kind == "body" ? bodySize : asset.size!
    let ground = asset.kind == "body" ? Double(manifest.export.bodyAnchorY) : Double(size) * asset.originY!
    let strip = context(size * asset.frames, size)
    var exported: [CGImage] = []
    var registrations: [(scale: Double, x: Double, y: Double)] = []
    if poses > 4 && asset.kind == "body", rendered["idle"] != nil || registrationAtlas != nil {
        for direction in 0..<directions.count {
            let group = Array(frames.dropFirst(direction * poses).prefix(poses))
            let first = group[0]
            let source = bounds(first.image).offsetBy(dx: first.xOffset, dy: first.yOffset)
            let targetFrame = registrationAtlas?.cropping(to: CGRect(x: 0, y: direction * actionsPerDirection * bodySize, width: bodySize, height: bodySize))
                ?? rendered["idle"]![direction * poses]
            let target = bounds(targetFrame)
            // Register the REST pose to idle once, then use exactly the same transform for
            // the entire action. Never fit each pose: that makes breathing/falling pulsate.
            var scale = min(target.width / source.width, target.height / source.height)
            var x = target.midX - source.midX * scale
            var y = target.maxY - source.maxY * scale
            let pivotX = Double(size) / 2, pivotY = ground, margin = 3.0
            var shrink = 1.0
            for cell in group {
                let b = bounds(cell.image).offsetBy(dx: cell.xOffset, dy: cell.yOffset)
                for edge in [b.minX * scale + x, b.maxX * scale + x] {
                    if edge < margin { shrink = min(shrink, (pivotX - margin) / (pivotX - edge)) }
                    if edge > Double(size) - margin { shrink = min(shrink, (Double(size) - margin - pivotX) / (edge - pivotX)) }
                }
                for edge in [b.minY * scale + y, b.maxY * scale + y] {
                    if edge < margin { shrink = min(shrink, (pivotY - margin) / (pivotY - edge)) }
                    if edge > Double(size) - margin { shrink = min(shrink, (Double(size) - margin - pivotY) / (edge - pivotY)) }
                }
            }
            scale *= shrink; x = pivotX + (x - pivotX) * shrink; y = pivotY + (y - pivotY) * shrink
            registrations.append((scale, x, y))
        }
    }
    for (index, cell) in frames.enumerated() {
        // Fixed logical canvas scale, NOT per-frame bounding-box fitting: a kneeling or
        // fallen body remains shorter, and an extended arm does not shrink the knight.
        let registration = registrations.isEmpty ? nil : registrations[index / poses]
        let scale = registration?.scale ?? (Double(size) / max(cell.logicalWidth, cell.logicalHeight)
            * (asset.sampling ?? (asset.kind == "body" ? manifest.export.bodySampling : manifest.export.effectSampling)))
        let w = Double(cell.image.width) * scale, h = Double(cell.image.height) * scale
        let x = ((registration?.x ?? ((Double(size) - cell.logicalWidth * scale) / 2)) + cell.xOffset * scale).rounded()
        // Overhead bodies use a fixed map-plane pivot, not their cape/weapon's lowest pixel.
        let top = registration.map { ($0.y + cell.yOffset * scale).rounded() } ?? (asset.kind == "body" && directions.count > 1
            ? ((Double(size) - cell.logicalHeight * scale) / 2 + cell.yOffset * scale).rounded()
            : asset.kind == "fx" && asset.originY == 0.5
                ? ((Double(size) - h) / 2).rounded() : (ground - cell.bottom * scale).rounded())
        let frame = context(size, size)
        frame.draw(cell.image, in: CGRect(x: x, y: Double(size) - top - h, width: w, height: h))
        let image = frame.makeImage()!
        let pixels = image.dataProvider!.data! as Data
        let alpha = stride(from: 3, to: pixels.count, by: 4).map { pixels[$0] }
        precondition(alpha.filter { $0 > 32 }.count > 12, "Empty exported frame: \(asset.id)")
        precondition(alpha.filter { $0 == 0 }.count > size * size / 4, "Opaque exported frame: \(asset.id)")
        // Reject clipped silhouettes: all four outer borders must retain transparency.
        var edge: [Int] = []
        for coordinate in 0..<size {
            edge.append(coordinate)
            edge.append((size - 1) * size + coordinate)
            edge.append(coordinate * size)
            edge.append(coordinate * size + size - 1)
        }
        precondition(edge.allSatisfy { alpha[$0] < 16 }, "Clipped frame \(asset.id) \(index); revise framing or explicit anchor")
        let hash = SHA256.hash(data: pixels).map { String(format: "%02x", $0) }.joined()
        report.append(["asset": asset.id, "frame": index, "size": size,
            "visiblePixels": alpha.filter { $0 > 32 }.count, "transparentPixels": alpha.filter { $0 == 0 }.count,
            "sha256": hash, "top": top, "left": x, "samplingScale": scale])
        strip.draw(image, in: CGRect(x: index * size, y: 0, width: size, height: size))
        if asset.kind == "body" {
            let col = index % manifest.export.bodyColumns
            let row = asset.row! + index / manifest.export.bodyColumns * actionsPerDirection
            atlas.draw(image, in: CGRect(x: col * size, y: (manifest.export.bodyRows - 1 - row) * size, width: size, height: size))
        }
        exported.append(image)
    }
    if asset.kind == "body" { bodyCount += 1 }
    else { write(strip.makeImage()!, out.appendingPathComponent("\(asset.id).png")) }
    rendered[asset.id] = exported
    if poses >= 32 && asset.kind == "body" {
        let contacts = review.appendingPathComponent("actions")
        try FileManager.default.createDirectory(at: contacts, withIntermediateDirectories: true)
        for (direction, name) in directions.enumerated() {
            let sheet = context(size * 8, size * 4)
            for pose in 0..<poses {
                sheet.draw(exported[direction * poses + pose],
                    in: CGRect(x: pose % 8 * size, y: (3 - pose / 8) * size, width: size, height: size))
            }
            write(sheet.makeImage()!, contacts.appendingPathComponent("\(asset.id)-\(name).png"))
        }
    }
    print("\(asset.id): \(asset.frames) real generated frames, \(size)px RGBA")
}
if bodyCount == actionsPerDirection { write(atlas.makeImage()!, out.appendingPathComponent("actions.png")) }
if partial && rendered.count < manifest.assets.count { exit(0) }
precondition(bodyCount == actionsPerDirection && rendered.count == manifest.assets.count)
try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
    .write(to: review.appendingPathComponent("frames.json"))

// Contact sheets and GIFs only compose already-generated pixels; labels are review UI.
func canvas(_ w: Int, _ h: Int, _ draw: (NSGraphicsContext) -> Void) -> CGImage {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8,
        samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: w * 4, bitsPerPixel: 32)!
    NSGraphicsContext.saveGraphicsState()
    let ctx = NSGraphicsContext(bitmapImageRep: bitmap)!
    NSGraphicsContext.current = ctx; ctx.imageInterpolation = .none
    NSColor(calibratedRed: 0.09, green: 0.105, blue: 0.11, alpha: 1).setFill()
    NSBezierPath(rect: NSRect(x: 0, y: 0, width: w, height: h)).fill()
    draw(ctx)
    NSGraphicsContext.restoreGraphicsState()
    return bitmap.cgImage!
}
func label(_ text: String, _ x: Int, _ y: Int, _ size: CGFloat = 16) {
    (text as NSString).draw(at: NSPoint(x: x, y: y), withAttributes: [
        .font: NSFont.systemFont(ofSize: size, weight: .medium),
        .foregroundColor: NSColor(calibratedRed: 0.89, green: 0.85, blue: 0.73, alpha: 1)])
}
for (directionIndex, direction) in directions.enumerated() {
let overview = canvas(max(1184, 224 + poses * 136), 1552) { ctx in
    label("ALBERIC / THE WHITE KNIGHT", 24, 1494, 30)
    label("\(direction.uppercased()) / \(poses * actionsPerDirection) action frames / built-in imagegen", 24, 1458)
    for asset in manifest.assets {
        let y = asset.kind == "body" ? 1298 - asset.row! * 144 : 252 - manifest.assets.filter { $0.kind == "fx" }.firstIndex(where: { $0.id == asset.id })! * 106
        label(asset.name, 24, y + 56, 13)
        let size = asset.kind == "body" ? bodySize : asset.size!
        let selected = asset.kind == "body"
            ? Array(rendered[asset.id]!.dropFirst(directionIndex * poses).prefix(poses)) : rendered[asset.id]!
        for (i, image) in selected.enumerated() {
            ctx.cgContext.draw(image, in: CGRect(x: 208 + i * (asset.kind == "body" ? 136 : 96), y: y, width: size, height: size))
        }
    }
    if poses <= 4 {
    let identity = read(review.appendingPathComponent("identity.png"))
    ctx.cgContext.draw(identity, in: CGRect(x: 784, y: 994, width: 376, height: 376))
    label("Design reference", 838, 964)
    label("128px / overhead map projection", 784, 926, 12)
    label("Crown, closed helm, ivory plate,", 784, 884, 14)
    label("torn vestments, bow and sword.", 784, 860, 14)
    label("No collision or balance changes.", 784, 816, 14)
    }
}
write(overview, review.appendingPathComponent(directionIndex == 0 ? "overview.png" : "overview-\(direction).png"))
}
let gifSteps = poses * directions.count
let gif = CGImageDestinationCreateWithURL(review.appendingPathComponent("motion-preview.gif") as CFURL,
    UTType.gif.identifier as CFString, gifSteps, nil)!
CGImageDestinationSetProperties(gif, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
for step in 0..<gifSteps {
    let picture = canvas(1088, 736) { ctx in
        label("ALBERIC / OVERHEAD / \(directions[(step / poses) % directions.count].uppercased())", 24, 686, 24)
        for (index, asset) in manifest.assets.enumerated() {
            let col = index % 4, row = index / 4
            let y = 472 - row * 224
            let source = rendered[asset.id]![step % asset.frames]
            let s = asset.kind == "body" ? 192 : 144
            ctx.cgContext.draw(source, in: CGRect(x: 24 + col * 264 + (224 - s) / 2, y: max(28, y), width: s, height: s))
            label(asset.name, 24 + col * 264, max(8, y - 24), 13)
        }
    }
    CGImageDestinationAddImage(gif, picture, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: poses >= 32 ? 0.04 : poses > 4 ? 0.08 : 0.2]] as CFDictionary)
}
precondition(CGImageDestinationFinalize(gif))

// A labelled composition check on existing game pixels, not a claimed gameplay screenshot.
if directions.count == 3 {
    let map = read(root.appendingPathComponent("docs/firstlight-village-preview.png"))
    let background = map.cropping(to: CGRect(x: 880, y: 330, width: 392, height: 416))!
    let knight = read(root.appendingPathComponent("games/openworld/public/assets/na/Actor/Character/Knight/SpriteSheet.png"))
        .cropping(to: CGRect(x: 0, y: 0, width: 16, height: 16))!
    let scene = canvas(1200, 544) { ctx in
        label("ALBERIC / OVERHEAD PROJECTION CHECK", 16, 506, 24)
        label("Composition preview on existing map pixels / 2x map zoom / not a gameplay capture", 16, 476, 14)
        for (i, direction) in directions.enumerated() {
            let x = 8 + i * 400
            ctx.cgContext.draw(background, in: CGRect(x: x, y: 40, width: 392, height: 416))
            ctx.cgContext.draw(rendered["idle"]![i * poses], in: CGRect(x: x + 28, y: 112, width: 320, height: 320))
            ctx.cgContext.draw(knight, in: CGRect(x: x + 304, y: 144, width: 32, height: 32))
            label(direction.uppercased(), x + 12, 10, 18)
        }
    }
    write(scene, review.appendingPathComponent("map-context.png"))
}
print("Exported runtime atlas, effects, frame audit, overview and animated review; legacy files untouched.")
