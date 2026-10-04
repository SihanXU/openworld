// Grid A* with a binary heap. Actors are ignored when planning (they move); the caller
// waits or re-plans when the next step turns out to be blocked.

export function astar(
  width: number,
  height: number,
  passable: (x: number, y: number) => boolean,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  maxNodes = 6000,
  /** Can one go from a column to the next (heights: no climbing a cliff, no unsafe drop)? */
  step?: (ax: number, ay: number, bx: number, by: number) => boolean,
): [number, number][] | undefined {
  if (sx === tx && sy === ty) return []
  const N = width * height
  const g = new Float64Array(N).fill(Infinity)
  const came = new Int32Array(N).fill(-1)
  const closed = new Uint8Array(N)
  const heap: number[] = []
  const f: number[] = []
  const push = (i: number, fi: number) => {
    heap.push(i)
    f.push(fi)
    let c = heap.length - 1
    while (c > 0) {
      const p = (c - 1) >> 1
      if (f[p] <= f[c]) break
      ;[heap[p], heap[c]] = [heap[c], heap[p]]
      ;[f[p], f[c]] = [f[c], f[p]]
      c = p
    }
  }
  const pop = (): number => {
    const top = heap[0]
    const li = heap.pop()!
    const lf = f.pop()!
    if (heap.length) {
      heap[0] = li
      f[0] = lf
      let c = 0
      for (;;) {
        const l = 2 * c + 1
        const r = l + 1
        let m = c
        if (l < heap.length && f[l] < f[m]) m = l
        if (r < heap.length && f[r] < f[m]) m = r
        if (m === c) break
        ;[heap[m], heap[c]] = [heap[c], heap[m]]
        ;[f[m], f[c]] = [f[c], f[m]]
        c = m
      }
    }
    return top
  }
  const start = sy * width + sx
  const goal = ty * width + tx
  g[start] = 0
  push(start, Math.abs(tx - sx) + Math.abs(ty - sy))
  let expanded = 0
  while (heap.length) {
    const cur = pop()
    if (cur === goal) break
    if (closed[cur]) continue
    closed[cur] = 1
    if (++expanded > maxNodes) return undefined
    const cx = cur % width
    const cy = (cur - cx) / width
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const ni = ny * width + nx
      if (closed[ni]) continue
      if (ni !== goal && !passable(nx, ny)) continue
      if (step && !step(cx, cy, nx, ny)) continue
      const ng = g[cur] + 1
      if (ng < g[ni]) {
        g[ni] = ng
        came[ni] = cur
        push(ni, ng + Math.abs(tx - nx) + Math.abs(ty - ny))
      }
    }
  }
  if (came[goal] === -1) return undefined
  const path: [number, number][] = []
  for (let c = goal; c !== start; c = came[c]) path.push([c % width, Math.floor(c / width)])
  return path.reverse()
}
