// Technical export of imagegen atlases: cell extraction, uniform scale, baseline alignment.
// Preserves generated colors and alpha; no repainting, cleanup or generated-art replacement.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("docs/seven-sins-prompts.json"))) as! [String: Any]
let assets = manifest["assets"] as! [[String: String]]
let sizes = ["greed":(74,74), "gluttony":(78,76), "sloth":(90,70), "lust":(72,82), "wrath":(76,84), "envy":(20,25), "pride":(84,88)]
let skillIds = ["greed":["stamp","coins","chains"],"gluttony":["bite","soup","gulp"],"sloth":["stomp","dream","shell"],"lust":["petal","lure","thorns"],"wrath":["cleave","fissure","rage"],"envy":["daggers","mirror","blink"],"pride":["wing","mirror","crown"]]
func context(_ w: Int, _ h: Int) -> CGContext {
  let c = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w*4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  c.interpolationQuality = .none; c.setShouldAntialias(false)
  return c
}
func read(_ path: String) -> CGImage { CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(URL(fileURLWithPath:path) as CFURL,nil)!,0,nil)! }
func write(_ image: CGImage, _ path: URL) {
  let out = CGImageDestinationCreateWithURL(path as CFURL, UTType.png.identifier as CFString,1,nil)!
  CGImageDestinationAddImage(out,image,nil); precondition(CGImageDestinationFinalize(out))
}
func frames(_ im: CGImage, rows: Int) -> [CGImage] {
  let c = context(im.width, im.height)
  c.draw(im, in: CGRect(x:0,y:0,width:im.width,height:im.height))
  let normalized = c.makeImage()!
  let data = normalized.dataProvider!.data! as Data
  var out: [CGImage] = []
  // Imagegen leaves real gutters slightly off the nominal grid. Find each column's
  // quietest row near the expected cut so a neighbouring crown/foot is not imported.
  func rowCuts(_ x0: Int, _ x1: Int) -> [Int] {
    var cuts = [0]
    for boundary in 1..<rows {
      let expected = boundary * im.height / rows, tolerance = im.height / rows / 4
      var best = expected, score = Double.greatestFiniteMagnitude
      for y in (expected-tolerance)...(expected+tolerance) {
        var mass = 0
        for x in x0..<x1 { mass += Int(data[y*normalized.bytesPerRow+x*4+3]) }
        let cost = Double(mass) + Double(abs(y-expected)) * 0.1
        if cost < score { score = cost; best = y }
      }
      cuts.append(best)
    }
    return cuts + [im.height]
  }
  let cuts = (0..<4).map { rowCuts($0*im.width/4, ($0+1)*im.width/4) }
  for row in 0..<rows { for col in 0..<4 {
    let x0=col*im.width/4, x1=(col+1)*im.width/4, y0=cuts[col][row], y1=cuts[col][row+1]
    var l=x1,t=y1,r=x0,b=y0
    for y in y0..<y1 { for x in x0..<x1 {
      if data[y*normalized.bytesPerRow+x*4+3] > 32 {l=min(l,x);r=max(r,x);t=min(t,y);b=max(b,y)}
    }}
    precondition(r>l && b>t,"Missing frame \(row),\(col)")
    precondition((x1-x0)*(y1-y0) > (r-l)*(b-t) || data[y0*normalized.bytesPerRow+x0*4+3] < 32,"Opaque sheet background")
    out.append(normalized.cropping(to:CGRect(x:l,y:t,width:r-l+1,height:b-t+1))!)
  }}
  return out
}
let preview=context(1120,840)
preview.setFillColor(CGColor(red:0.08,green:0.12,blue:0.14,alpha:1));preview.fill(CGRect(x:0,y:0,width:1120,height:840))
for (i, asset) in assets.enumerated() {
  let id=asset["id"]!, dir=root.appendingPathComponent("games/openworld/public/assets/lsw/Bosses/\(id)")
  try FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true)
  for (key,name) in [("source","source.png"),("effects","effects-source.png")] {
    let destination=dir.appendingPathComponent(name)
    if !FileManager.default.fileExists(atPath:destination.path) {try FileManager.default.copyItem(at:URL(fileURLWithPath:asset[key]!),to:destination)}
  }
  let body=frames(read(dir.appendingPathComponent("source.png").path),rows:5), cell=id=="envy" ? 32 : 96
  let bounds=sizes[id]!, scale=min(Double(bounds.0)/Double(body.map{$0.width}.max()!),Double(bounds.1)/Double(body.map{$0.height}.max()!))
  let atlas=context(cell*4,cell*5)
  for (j, frame) in body.enumerated() {
    let w=Int((Double(frame.width)*scale).rounded()),h=Int((Double(frame.height)*scale).rounded())
    let col=j%4,row=j/4
    atlas.draw(frame,in:CGRect(x:col*cell+(cell-w)/2,y:(4-row)*cell+3,width:w,height:h))
  }
  let sheet=atlas.makeImage()!
  write(sheet,dir.appendingPathComponent("actions.png"))
  let first=sheet.cropping(to:CGRect(x:0,y:0,width:cell,height:cell))!
  let px=(i%4)*280,py=840-(i/4+1)*420
  preview.draw(first,in:CGRect(x:px+(280-cell*2)/2,y:py+180,width:cell*2,height:cell*2))
  let effects=frames(read(dir.appendingPathComponent("effects-source.png").path),rows:3)
  for row in 0..<3 {
    let strip=context(256,64)
    let series=Array(effects[(row*4)..<(row*4+4)])
    let s=min(58.0/Double(series.map{$0.width}.max()!),58.0/Double(series.map{$0.height}.max()!))
    for (col,f) in series.enumerated(){let w=Int((Double(f.width)*s).rounded()),h=Int((Double(f.height)*s).rounded());strip.draw(f,in:CGRect(x:col*64+(64-w)/2,y:(64-h)/2,width:w,height:h))}
    let effect=strip.makeImage()!
    write(effect,dir.appendingPathComponent("effect-\(skillIds[id]![row]).png"))
    let keyFrame=effect.cropping(to:CGRect(x:64,y:0,width:64,height:64))!
    preview.draw(keyFrame,in:CGRect(x:px+12+row*88,y:py+65,width:80,height:80))
  }
  print("\(id): 20 body frames (\(cell)px), 3 effects × 4 frames (64px)")
}
write(preview.makeImage()!,root.appendingPathComponent("docs/seven-sins-preview.png"))
