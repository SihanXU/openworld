/** A centered pixel-art preview. The source canvas keeps its world-space padding and anchors. */
export function pixelArtwork(source: HTMLCanvasElement, width = 64, height = 48): HTMLElement {
  const stage = document.createElement('span')
  stage.className = 'ui-artwork'
  stage.setAttribute('aria-hidden', 'true')
  const w = Math.max(1, Math.floor(Number.isFinite(width) ? width : 64))
  const h = Math.max(1, Math.floor(Number.isFinite(height) ? height : 48))
  stage.style.setProperty('--ui-artwork-width', `${w}px`)
  stage.style.setProperty('--ui-artwork-height', `${h}px`)
  if (!source.width || !source.height) return stage

  const context = source.getContext('2d')
  if (!context) return stage
  let left = source.width
  let top = source.height
  let right = -1
  let bottom = -1
  const pixels = context.getImageData(0, 0, source.width, source.height).data
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (!pixels[(y * source.width + x) * 4 + 3]) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top) return stage

  const canvas = document.createElement('canvas')
  canvas.width = right - left + 1
  canvas.height = bottom - top + 1
  const paint = canvas.getContext('2d')
  if (!paint) return stage
  paint.imageSmoothingEnabled = false
  paint.drawImage(source, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)

  // Small sprites use at most 2× pixels; large fixtures retain their native detail. Leave room
  // for the inset frame, and use a proportional reduction only for art larger than the stage.
  const fit = Math.min(Math.max(1, w - 8) / canvas.width, Math.max(1, h - 8) / canvas.height)
  const scale = fit >= 1 ? Math.min(2, Math.floor(fit)) : fit
  canvas.style.width = `${canvas.width * scale}px`
  canvas.style.height = `${canvas.height * scale}px`
  canvas.style.imageRendering = 'pixelated'
  stage.append(canvas)
  return stage
}
