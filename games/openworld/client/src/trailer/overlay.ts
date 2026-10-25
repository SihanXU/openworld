// What the trailer draws over the world, frame by frame: washes, letterbox, the world's pause, the rule a moment of
// learning writes, the title. Immediate mode: each frame says everything that is on screen, nothing animates on
// its own, so a frame taken for the video is the frame the script meant.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
/** 0 before `a`, 1 after `b`, smooth between. */
export const ramp = (t: number, a: number, b: number) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x) }
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
export const easeBack = (x: number) => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }

/** A rule as the card shows it: lines of [text, kind] pieces (k keyword, f function, b value, c comment). */
export type CodeLine = [string, ('k' | 'f' | 'b' | 'c' | '')?][]

export class Overlay {
  private html: string[] = []
  constructor(private el: HTMLElement) {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.append(style)
  }
  begin(): void { this.html = [] }
  end(): void { this.el.innerHTML = this.html.join('') }

  /** A wash over everything: black to fade, white to flash, a colour to tint. */
  wash(color: string, alpha: number): void {
    if (alpha > 0.001) this.html.push(`<div class="ov-wash" style="background:${color};opacity:${alpha}"></div>`)
  }
  /** The world held still: the colour drained toward a cool grey, a vignette closing in. */
  hold(amount: number): void {
    if (amount <= 0.001) return
    this.html.push(`<div class="ov-hold" style="opacity:${amount}"></div>`)
  }
  vignette(amount: number): void {
    if (amount > 0.001) this.html.push(`<div class="ov-vignette" style="opacity:${amount}"></div>`)
  }
  /** Bars top and bottom (0: none, 1: 2.39:1). */
  letterbox(amount: number): void {
    if (amount <= 0.001) return
    const h = Math.round(((1080 - 1920 / 2.39) / 2) * amount)
    this.html.push(`<div class="ov-bar" style="top:0;height:${h}px"></div><div class="ov-bar" style="bottom:0;height:${h}px"></div>`)
  }
  /** The ring of a world thinking, over someone (screen px). */
  thinking(x: number, y: number, t: number, alpha = 1): void {
    if (alpha <= 0.001) return
    const dots = [0, 1, 2].map((i) => {
      const a = (t * 5 + i * 0.9) % 3
      const lift = Math.max(0, Math.sin(Math.min(Math.PI, a * Math.PI)))
      return `<i style="transform:translateY(${-lift * 10}px);opacity:${0.45 + lift * 0.55}"></i>`
    }).join('')
    this.html.push(`<div class="ov-think" style="left:${x}px;top:${y}px;opacity:${alpha}">${dots}</div>`)
  }
  /** A rule card: grows out of a point, its lines typed as far as `typed` (0..1), stamped when `stamp` > 0. */
  card(o: { x: number; y: number; open: number; title: string; lines: CodeLine[]; typed: number; stamp?: number; alpha?: number; scale?: number; tag?: string }): void {
    const alpha = o.alpha ?? 1
    if (o.open <= 0.001 || alpha <= 0.001) return
    const chars = o.lines.reduce((n, l) => n + l.reduce((m, [s]) => m + s.length, 0), 0)
    let left = Math.floor(chars * clamp(o.typed))
    const body = o.lines.map((l) => {
      const parts = l.map(([s, k]) => {
        if (left <= 0) return ''
        const shown = s.slice(0, left)
        left -= shown.length
        return k ? `<span class="${k}">${esc(shown)}</span>` : esc(shown)
      }).join('')
      return `<div class="ln">${parts || '&nbsp;'}</div>`
    }).join('')
    const caret = o.typed > 0 && o.typed < 1 ? '<span class="caret"></span>' : ''
    const s = (o.scale ?? 1) * (0.6 + 0.4 * easeBack(o.open))
    const stamp = o.stamp && o.stamp > 0.001 ? `<div class="stamp" style="opacity:${clamp(o.stamp * 2)};transform:scale(${1.6 - 0.6 * easeOut(o.stamp)}) rotate(-8deg)">✓</div>` : ''
    this.html.push(`<div class="ov-card" style="left:${o.x}px;top:${o.y}px;opacity:${alpha * clamp(o.open * 1.5)};transform:translate(-50%,-100%) scale(${s})">
      <div class="hd"><span class="dot"></span>${esc(o.title)}${o.tag ? `<span class="tag">${esc(o.tag)}</span>` : ''}</div>
      <div class="code">${body}${caret}</div>${stamp}</div>`)
  }
  /** A thin line from a card down to who it is about. */
  tether(x1: number, y1: number, x2: number, y2: number, alpha: number): void {
    if (alpha <= 0.001) return
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ang = (Math.atan2(dy, dx) * 180) / Math.PI
    this.html.push(`<div class="ov-tether" style="left:${x1}px;top:${y1}px;width:${len}px;transform:rotate(${ang}deg);opacity:${alpha}"></div>`)
  }
  /** A small chip over someone: the rule already known, no pause. */
  chip(x: number, y: number, text: string, alpha: number, lift = 0): void {
    if (alpha <= 0.001) return
    this.html.push(`<div class="ov-chip" style="left:${x}px;top:${y - lift}px;opacity:${alpha}"><span class="dot"></span>${esc(text)}</div>`)
  }
  /** The title, as the cover draws it. */
  title(o: { alpha: number; scale?: number; y?: number; kicker?: string; kickerAlpha?: number; sub?: string; subAlpha?: number }): void {
    if (o.alpha <= 0.001) return
    this.html.push(`<div class="ov-title" style="opacity:${o.alpha};top:${o.y ?? 540}px">
      ${o.kicker ? `<div class="kicker" style="opacity:${o.kickerAlpha ?? 1}">${esc(o.kicker)}</div>` : ''}
      <div class="name" style="transform:scale(${o.scale ?? 1})">OpenWorld</div>
      ${o.sub ? `<div class="sub" style="opacity:${o.subAlpha ?? 1}">${esc(o.sub)}</div>` : ''}</div>`)
  }
  /** A caption slot: empty until its words are written (the team writes them); drawn only when it has text. */
  caption(text: string | undefined, alpha: number): void {
    if (!text || alpha <= 0.001) return
    this.html.push(`<div class="ov-caption" style="opacity:${alpha}">${esc(text)}</div>`)
  }
  /** The waitlist line at the end. */
  cta(text: string, alpha: number): void {
    if (alpha <= 0.001) return
    this.html.push(`<div class="ov-cta" style="opacity:${alpha}">${esc(text)}</div>`)
  }
  /** A counter of rules learned, top right. */
  counter(n: number, alpha: number): void {
    if (alpha <= 0.001) return
    this.html.push(`<div class="ov-counter" style="opacity:${alpha}"><b>${n}</b> rules learned</div>`)
  }
  /** A thing held up (screen px; `url` a picture of it, drawn as pixels at `scale`). */
  icon(x: number, y: number, url: string | undefined, scale: number, alpha = 1, glow = 0): void {
    if (!url || alpha <= 0.001) return
    this.html.push(`<div class="ov-icon" style="left:${x}px;top:${y}px;opacity:${alpha};transform:translate(-50%,-100%) scale(${scale})">${glow > 0 ? `<i style="opacity:${glow}"></i>` : ''}<img src="${url}"></div>`)
  }
  /** A glyph bubble over someone, as the game's emotes are drawn (! ♥ …). */
  emote(x: number, y: number, glyph: string, alpha: number, pop = 1): void {
    if (alpha <= 0.001) return
    this.html.push(`<div class="ov-emote" style="left:${x}px;top:${y}px;opacity:${alpha};transform:translate(-50%,-100%) scale(${0.6 + 0.4 * easeBack(pop)})">${esc(glyph)}</div>`)
  }
  /** A number rising off someone struck. */
  floater(x: number, y: number, text: string, t: number, color = '#fff'): void {
    if (t < 0 || t > 0.8) return
    this.html.push(`<div class="ov-floater" style="left:${x}px;top:${y - 70 * easeOut(t / 0.8)}px;opacity:${1 - clamp((t - 0.5) / 0.3)};color:${color}">${esc(text)}</div>`)
  }
  /** The game's dialogue box (its own styles), the line typed as far as `typed`, the speaker's portrait beside it. */
  dialog(o: { name: string; text: string; typed: number; portrait?: string; alpha: number }): void {
    if (o.alpha <= 0.001) return
    const shown = esc(o.text.slice(0, Math.floor(o.text.length * clamp(o.typed))))
    this.html.push(`<div class="ov-dialog" style="opacity:${o.alpha}"><div class="dialog bust">
      <div class="face bust">${o.portrait ? `<img src="${o.portrait}">` : ''}</div>
      <div class="dtext"><div class="dname">${esc(o.name)}</div><div class="dline">${shown}</div></div><div class="dmore">▼</div></div></div>`)
  }
  /** Rain driven slantwise across the frame (the same streaks for the same moment). */
  rain(t: number, amount: number): void {
    if (amount <= 0.001) return
    const lines: string[] = []
    const n = Math.round(260 * amount)
    for (let i = 0; i < n; i++) {
      const r1 = ((i * 7919) % 1000) / 1000, r2 = ((i * 104729) % 1000) / 1000, r3 = ((i * 1299709) % 1000) / 1000
      const speed = 1700 + r2 * 900, len = 38 + r3 * 40
      const y = ((r2 * 1400 + t * speed) % 1400) - 160
      const x = r1 * 2300 - 200 - y * 0.32
      lines.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - len * 0.32).toFixed(1)}" y2="${(y + len).toFixed(1)}" />`)
    }
    this.html.push(`<svg class="ov-rain" viewBox="0 0 1920 1080" style="opacity:${amount}"><g stroke="rgba(200,215,255,0.55)" stroke-width="2">${lines.join('')}</g></svg>`)
  }
  raw(html: string): void { this.html.push(html) }
}

const CSS = `
#overlay { font-family: 'Segoe UI', system-ui, sans-serif; }
#overlay > * { position: absolute; }
.ov-wash { inset: 0; }
.ov-hold { inset: 0; background: radial-gradient(ellipse 70% 65% at 50% 50%, rgba(40,52,78,0.10), rgba(18,22,36,0.55)); backdrop-filter: saturate(0.25) brightness(0.92); -webkit-backdrop-filter: saturate(0.25) brightness(0.92); }
.ov-vignette { inset: 0; background: radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.65)); }
.ov-bar { left: 0; right: 0; background: #000; }
.ov-think { transform: translate(-50%, -100%); display: flex; gap: 9px; padding: 10px 14px; background: rgba(255,255,255,0.96); border-radius: 999px; box-shadow: 0 6px 20px rgba(0,0,0,0.35); }
.ov-think::after { content: ""; position: absolute; left: 50%; bottom: -7px; width: 14px; height: 14px; background: rgba(255,255,255,0.96); transform: translateX(-50%) rotate(45deg); border-radius: 2px; }
.ov-think i { display: block; width: 11px; height: 11px; border-radius: 50%; background: #2563eb; }
.ov-card { transform-origin: 50% 100%; min-width: 520px; background: rgba(255,255,255,0.97); border-radius: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.2), 0 24px 60px rgba(0,0,0,0.45); padding: 18px 24px 20px; color: #222; }
.ov-card .hd { display: flex; align-items: center; gap: 10px; font: 600 20px/1.2 'Segoe UI', system-ui, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; color: #8a93a3; margin-bottom: 12px; }
.ov-card .hd .dot, .ov-chip .dot { width: 10px; height: 10px; border-radius: 50%; background: #2563eb; box-shadow: 0 0 0 4px rgba(37,99,235,0.18); }
.ov-card .hd .tag { margin-left: auto; font-size: 14px; letter-spacing: 0.08em; color: #2563eb; background: #eef3fe; border-radius: 999px; padding: 3px 12px; }
.ov-card .code { font: 500 29px/1.55 'Cascadia Code', Consolas, 'Courier New', monospace; white-space: pre; }
.ov-card .k { color: #c0265b; font-weight: 700; } .ov-card .f { color: #0057b7; } .ov-card .b { color: #8b5cf6; } .ov-card .c { color: #3a9696; }
.ov-card .caret { display: inline-block; width: 14px; height: 30px; background: #2563eb; vertical-align: -5px; margin-left: 2px; }
.ov-card .stamp { position: absolute; right: -22px; top: -22px; width: 64px; height: 64px; border-radius: 50%; background: #2563eb; color: #fff; font: 700 36px/64px 'Segoe UI', sans-serif; text-align: center; box-shadow: 0 8px 24px rgba(37,99,235,0.5); }
.ov-tether { height: 2px; background: linear-gradient(90deg, rgba(255,255,255,0.95), rgba(255,255,255,0.4)); transform-origin: 0 50%; }
.ov-chip { transform: translate(-50%, -100%); display: flex; align-items: center; gap: 12px; padding: 10px 20px; background: rgba(255,255,255,0.96); border-radius: 999px; font: 600 27px/1 'Cascadia Code', Consolas, monospace; color: #222; box-shadow: 0 6px 20px rgba(0,0,0,0.35); white-space: nowrap; }
.ov-title { left: 0; right: 0; transform: translateY(-50%); text-align: center; color: #fff8ea; }
.ov-title .name { font: 600 190px/1 'Pixelify Sans', 'Segoe UI', sans-serif; letter-spacing: 2px; text-shadow: 0 6px 0 #6b3d1f, 0 10px 40px rgba(0,0,0,0.55); }
.ov-title .kicker { font: 600 30px/1 'Pixelify Sans', 'Segoe UI', sans-serif; letter-spacing: 6px; text-transform: uppercase; color: #f6d48d; margin-bottom: 26px; text-shadow: 0 2px 8px rgba(0,0,0,0.6); }
.ov-title .sub { font: 500 36px/1.3 'Segoe UI', system-ui, sans-serif; margin-top: 30px; color: #fff3dc; text-shadow: 0 2px 10px rgba(0,0,0,0.7); }
.ov-caption { left: 0; right: 0; bottom: 120px; text-align: center; font: 600 44px/1.3 'Segoe UI', system-ui, sans-serif; color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,0.8); }
.ov-cta { left: 0; right: 0; bottom: 150px; text-align: center; font: 600 34px/1 'Segoe UI', system-ui, sans-serif; color: #fff; letter-spacing: 0.02em; }
.ov-icon { transform-origin: 50% 100%; }
.ov-icon img { display: block; image-rendering: pixelated; filter: drop-shadow(0 1px 0 rgba(0,0,0,0.6)); }
.ov-icon i { position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; background: radial-gradient(rgba(255,240,190,0.95), rgba(255,220,120,0) 70%); }
.ov-emote { transform-origin: 50% 100%; min-width: 44px; padding: 6px 12px; background: #fbf7ea; color: #b8321f; border-radius: 12px; font: 600 30px/1 'Pixelify Sans', 'Segoe UI', sans-serif; text-align: center; box-shadow: 0 3px 0 rgba(0,0,0,0.35); }
.ov-emote::after { content: ''; position: absolute; left: 50%; bottom: -8px; margin-left: -8px; border: 8px solid transparent; border-top-color: #fbf7ea; border-bottom: 0; }
.ov-floater { transform: translate(-50%, -100%); font: 600 34px/1 'Pixelify Sans', 'Segoe UI', sans-serif; text-shadow: 0 2px 0 #000, 0 0 6px #000; }
.ov-dialog { left: 50%; bottom: 70px; width: 760px; height: 140px; transform: translateX(-50%) scale(1.65); transform-origin: 50% 100%; }
.ov-dialog .dialog { position: absolute; left: 0; bottom: 0; transform: none; width: 760px; }
.ov-dialog .face.bust img { width: 248px; height: 248px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35)); }
.ov-dialog .dmore { animation: none; }
.ov-rain { left: 0; top: 0; width: 1920px; height: 1080px; }
.ov-counter { right: 60px; top: 50px; font: 500 24px/1 'Cascadia Code', Consolas, monospace; color: #fff; background: rgba(12,16,24,0.6); padding: 12px 18px; border-radius: 10px; }
.ov-counter b { color: #8fb2ff; font-size: 30px; margin-right: 6px; }
`
