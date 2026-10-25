// A piece's film on the project page (?embed): played round and round, held while the page says it is out of sight,
// sought when the page asks. The page speaks by postMessage — { run: true|false }, { seek: seconds } — and hears
// { t: seconds } back now and then, to mark the chapter playing.
export const EMBED = new URLSearchParams(location.search).has('embed')
if (EMBED) document.body.classList.add('embed')

/** Plays `draw(t)` from 0 to `length` and again; returns a handle to seek it. */
export function playLoop(draw, length, { onSeek } = {}) {
  let t = 0, last = null, run = true, told = 0
  const seek = (s) => { t = Math.max(0, Math.min(length - 0.01, s)); onSeek?.(t) }
  addEventListener('message', (e) => {
    if (e.source !== parent || typeof e.data !== 'object' || !e.data) return
    if (typeof e.data.run === 'boolean') run = e.data.run
    if (typeof e.data.seek === 'number') seek(e.data.seek)
  })
  function frame(now) {
    if (last !== null && run && !document.hidden) t += Math.min(0.1, (now - last) / 1000)
    last = now
    if (t >= length) t = 0
    if (run) draw(t)
    if (EMBED && parent !== window && now - told > 400) { told = now; parent.postMessage({ t }, '*') }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  return { seek, get t() { return t } }
}
