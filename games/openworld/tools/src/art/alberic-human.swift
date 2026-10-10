// Alberic's human form (docs/chapter-1.md §11, the steward of the Held Ground): the pack's "Master" character
// (an old man, white-haired) recoloured as the White Knight freed of his crown — his red robe the knight's steel,
// his green collar the Order's gold, and on the portrait the scar the thorns left across his brow.
// Recolours pixels only: the pack's drawing is kept.
//
//   swift games/openworld/tools/src/art/alberic-human.swift

import AppKit

let pack = "assets/ninja-adventure/Ninja Adventure - Asset Pack/Actor/Character/Master"
let out = "games/openworld/public/assets/lsw/Characters/Alberic"

func load(_ path: String) -> NSBitmapImageRep {
  let data = try! Data(contentsOf: URL(fileURLWithPath: path))
  let rep = NSBitmapImageRep(data: data)!
  // into a plain 8-bit RGBA bitmap
  let w = rep.pixelsWide, h = rep.pixelsHigh
  let dst = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: w * 4, bitsPerPixel: 32)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: dst)
  NSGraphicsContext.current!.imageInterpolation = .none
  rep.draw(in: NSRect(x: 0, y: 0, width: w, height: h))
  NSGraphicsContext.restoreGraphicsState()
  return dst
}

func hsv(_ r: Double, _ g: Double, _ b: Double) -> (Double, Double, Double) {
  let mx = max(r, g, b), mn = min(r, g, b), d = mx - mn
  var h = 0.0
  if d > 0 { h = mx == r ? (g - b) / d : mx == g ? 2 + (b - r) / d : 4 + (r - g) / d; h *= 60; if h < 0 { h += 360 } }
  return (h, mx == 0 ? 0 : d / mx, mx)
}

/** `robeFrom`: the first row the robe may be on (the portrait: below the face, whose shadows are red too). */
func recolour(_ rep: NSBitmapImageRep, robeFrom: Int = 0) {
  let p = rep.bitmapData!
  for i in 0..<(rep.pixelsWide * rep.pixelsHigh) {
    let o = i * 4
    let row = i / rep.pixelsWide
    if p[o + 3] == 0 { continue }
    let r = Double(p[o]) / 255, g = Double(p[o + 1]) / 255, b = Double(p[o + 2]) / 255
    let (h, s, v) = hsv(r, g, b)
    var nr = r, ng = g, nb = b
    // outlines, shadows and the portrait's dark ground stay as drawn; so does skin (warm, not saturated red)
    if v < 0.3 { continue }
    if s > 0.5 && (h < 12 || h > 335) && row >= robeFrom {
      // the red robe: the knight's steel, blue-grey, bright where it was lit (his white hair stands out above it)
      let t = min(1, (v - 0.3) / 0.6)
      nr = 0.38 + 0.36 * t; ng = 0.44 + 0.36 * t; nb = 0.58 + 0.32 * t
    } else if s > 0.35 && h >= 70 && h <= 170 {
      // the green collar: the Order's gold
      nr = 0.55 + 0.45 * v; ng = 0.42 + 0.42 * v; nb = 0.12 + 0.15 * v
    } else { continue }
    p[o] = UInt8(max(0, min(255, nr * 255))); p[o + 1] = UInt8(max(0, min(255, ng * 255))); p[o + 2] = UInt8(max(0, min(255, nb * 255)))
  }
}

/** The thorns' scar across the brow: a few dark-red pixels on the portrait (38x38). */
func scar(_ rep: NSBitmapImageRep) {
  let p = rep.bitmapData!, w = rep.pixelsWide
  for (x, y) in [(15, 12), (16, 13), (17, 12), (18, 13), (19, 12), (20, 13), (21, 12), (22, 13)] {
    let o = (y * w + x) * 4
    if p[o + 3] == 0 { continue }
    p[o] = 150; p[o + 1] = 40; p[o + 2] = 46
  }
}

func save(_ rep: NSBitmapImageRep, _ path: String) {
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

let sheet = load("\(pack)/SpriteSheet.png")
recolour(sheet)
save(sheet, "\(out)/SpriteSheet.png")
let face = load("\(pack)/Faceset.png")
recolour(face, robeFrom: 29)
scar(face)
save(face, "\(out)/Faceset.png")
print("Alberic's human form → \(out)")
