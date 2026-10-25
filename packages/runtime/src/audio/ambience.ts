// The ambience (docs/music.md): the world's own sounds under the music, made as it plays (WebAudio, no files). Under
// the sky: the wind, keener over snow and in a storm, with a thin whistle on cold heights; the rain, muffled under a
// roof; running water by how much of it is near; birds by day and crickets by night, now and then an owl. A fire
// crackles as near as it is, indoors too (a hearth). In the dark (a cave, a barrow) a low hum and drips that ring.
// A room's own quiet indoors. Thunder rolls in a moment after a strike's flash. Each layer eases to its level; the
// sounds that come and go (drops, crackles, songs, chirps, drips) are scheduled a little ahead of the clock.

import { isNight } from './cues.ts'

/** What the ambience is made from: where the view is, the hour and the weather, and what is near its middle. */
export interface AmbienceState {
  /** Under the sky, under a roof, in the dark (a cave, a barrow): the map's light. */
  light: 'outdoor' | 'indoor' | 'dark'
  hour: number
  dusk: number
  dawn: number
  weather: string
  /** 0–1, near the middle of the view: running or standing water; snow and ice; how near a fire burns. */
  water: number
  cold: number
  fire: number
}

/** How far ahead the coming-and-going sounds are scheduled, and how often the scheduler looks (seconds, ms). */
const AHEAD = 0.3
const LOOK_MS = 100
/** How quickly a layer eases to a new level (the time constant, seconds). */
const EASE = 1.2

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]

/** A noise buffer, a few seconds long: white, or brown (integrated white, deep and soft). */
function noiseBuffer(ctx: BaseAudioContext, seconds: number, brown: boolean): AudioBuffer {
  const buf = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      if (brown) {
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.5
      } else d[i] = w
    }
  }
  return buf
}

/** A room's echo: noise dying away over so many seconds (a cave's, a crypt's). */
function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3
  }
  return buf
}

/** A filter of a kind at a frequency (and Q). */
function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}

function gain(ctx: BaseAudioContext, v = 0): GainNode {
  const g = ctx.createGain()
  g.gain.value = v
  return g
}

/** A noise source looping without end, started at a random point (two layers never in step). */
function loop(ctx: BaseAudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const s = ctx.createBufferSource()
  s.buffer = buf
  s.loop = true
  s.start(0, Math.random() * buf.duration)
  return s
}

/** A level eased to (never set at once: no clicks). */
function ease(p: AudioParam, v: number, t: number, tau = EASE): void {
  p.cancelScheduledValues(t)
  p.setTargetAtTime(v, t, tau)
}

/** A cricket: its own pitch, how often it chirps, its place left or right, and when it chirps next. */
interface Cricket {
  osc: OscillatorNode
  amp: GainNode
  period: number
  next: number
}

export class Ambience {
  private bus: GainNode
  /** What is heard of the outdoors: open under the sky, muffled under a roof. */
  private outdoors: BiquadFilterNode
  private outdoorsLevel: GainNode
  /** The rain's own way out: muffled under a roof (the rain on it), apart from the wind's. */
  private rainOut: BiquadFilterNode
  private echo: ConvolverNode
  private white: AudioBuffer
  private layers: {
    wind: GainNode
    windBand: BiquadFilterNode
    whistle: GainNode
    whistleBand: BiquadFilterNode
    rain: GainNode
    water: GainNode
    babble: GainNode
    fire: GainNode
    room: GainNode
    hum: GainNode
  }
  /** What the coming-and-going sounds go into: the birds and crickets, the crackles, the drops, the drips. */
  private sends: { life: GainNode; crackle: GainNode; drops: GainNode; drips: GainNode }
  private crickets: Cricket[] = []
  private state?: AmbienceState
  private next = { gust: 0, crackle: 0, drop: 0, song: 0, owl: 0, drip: 0, babble: 0 }
  private timer: ReturnType<typeof setInterval>

  constructor(
    private ctx: AudioContext,
    out: AudioNode,
  ) {
    const c = ctx
    this.white = noiseBuffer(c, 3, false)
    const brown = noiseBuffer(c, 4, true)
    this.bus = gain(c, 1)
    this.bus.connect(out)
    this.outdoorsLevel = gain(c, 1)
    this.outdoors = filter(c, 'lowpass', 16000)
    this.outdoors.connect(this.outdoorsLevel).connect(this.bus)
    this.rainOut = filter(c, 'lowpass', 16000)
    this.rainOut.connect(this.bus)
    this.echo = c.createConvolver()
    this.echo.buffer = impulse(c, 2.8)
    this.echo.connect(this.bus)

    // the wind: brown noise through a band that wanders; on cold heights a thin whistle over it
    const windBand = filter(c, 'bandpass', 380, 0.6)
    const wind = gain(c)
    loop(c, brown).connect(windBand).connect(wind).connect(this.outdoors)
    const whistleBand = filter(c, 'bandpass', 1100, 14)
    const whistle = gain(c)
    loop(c, this.white).connect(whistleBand).connect(whistle).connect(this.outdoors)
    // the rain's hiss
    const rain = gain(c)
    loop(c, this.white).connect(filter(c, 'highpass', 1300)).connect(filter(c, 'lowpass', 7500)).connect(rain).connect(this.rainOut)
    // running water: a low rush, and a babble above it that comes and goes
    const water = gain(c)
    loop(c, this.white).connect(filter(c, 'bandpass', 650, 0.5)).connect(water).connect(this.outdoors)
    const babble = gain(c)
    loop(c, this.white).connect(filter(c, 'bandpass', 2400, 1.6)).connect(babble).connect(water)
    // a fire's low roar (its crackles are scheduled), heard indoors as well: a hearth
    const fire = gain(c)
    loop(c, brown).connect(filter(c, 'lowpass', 220)).connect(fire).connect(this.bus)
    // a room's quiet, and the dark's hum
    const room = gain(c)
    loop(c, brown).connect(filter(c, 'lowpass', 260)).connect(room).connect(this.bus)
    const hum = gain(c)
    loop(c, brown).connect(filter(c, 'lowpass', 90)).connect(hum).connect(this.bus)
    this.layers = { wind, windBand, whistle, whistleBand, rain, water, babble, fire, room, hum }

    const life = gain(c, 1)
    life.connect(this.outdoors)
    const crackle = gain(c, 1)
    crackle.connect(this.bus)
    const drops = gain(c, 1)
    drops.connect(this.rainOut)
    const drips = gain(c, 1)
    drips.connect(this.echo)
    drips.connect(gain(c, 0.35)).connect(this.bus)
    this.sends = { life, crackle, drops, drips }

    // the crickets: each a tone gated into its chirps
    for (let i = 0; i < 4; i++) {
      const osc = c.createOscillator()
      osc.frequency.value = rand(4300, 5200)
      const amp = gain(c)
      const pan = c.createStereoPanner()
      pan.pan.value = rand(-0.8, 0.8)
      osc.connect(amp).connect(pan).connect(life)
      osc.start()
      this.crickets.push({ osc, amp, period: rand(0.55, 1.05), next: 0 })
    }
    this.timer = setInterval(() => this.schedule(), LOOK_MS)
  }

  /** The world as it is now (the scene tells it each second, and on a change of map). */
  update(s: AmbienceState): void {
    this.state = s
    const t = this.ctx.currentTime
    const L = this.layers
    const out = s.light === 'outdoor'
    const roof = s.light === 'indoor'
    const dark = s.light === 'dark'
    const storm = s.weather === 'storm'
    const wet = storm || s.weather === 'rain'
    // under a roof the outdoors is heard through the walls; in the dark not at all
    ease(this.outdoors.frequency, out ? 16000 : 650, t, 0.4)
    ease(this.outdoorsLevel.gain, out ? 1 : roof ? 0.45 : 0, t, 0.4)
    ease(this.rainOut.frequency, out ? 16000 : 900, t, 0.4)
    const windy = dark ? 0 : 0.035 + 0.05 * s.cold + (storm ? 0.06 : wet ? 0.02 : 0)
    ease(L.wind.gain, windy, t)
    ease(L.whistle.gain, dark ? 0 : 0.012 * s.cold + (storm ? 0.006 : 0), t)
    ease(L.rain.gain, dark ? 0 : storm ? 0.06 : wet ? 0.034 : 0, t)
    ease(L.water.gain, dark ? 0 : 0.07 * s.water, t)
    ease(L.fire.gain, 0.1 * s.fire, t)
    ease(L.room.gain, roof ? 0.03 : 0, t)
    ease(L.hum.gain, dark ? 0.02 : 0, t)
    ease(this.sends.life.gain, out ? 1 : roof ? 0.5 : 0, t, 0.4)
  }

  /** A strike's flash: the thunder rolls in a moment later, nearer the louder. */
  thunder(): void {
    const c = this.ctx
    const t = c.currentTime + rand(0.4, 1.4)
    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c, 6, true)
    const lp = filter(c, 'lowpass', 160)
    lp.frequency.setValueAtTime(160, t)
    lp.frequency.exponentialRampToValueAtTime(55, t + 5)
    const g = gain(c)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.9, t + 0.12)
    g.gain.exponentialRampToValueAtTime(0.25, t + 1.4)
    g.gain.exponentialRampToValueAtTime(0.001, t + 5.5)
    src.connect(lp).connect(g).connect(this.rainOut)
    src.start(t)
    src.stop(t + 6)
    // the crack before the roll
    this.burst(t - 0.15, 0.12, 'highpass', 1500, 0.7, 0.18, this.rainOut)
  }

  /** A short burst of white noise through a filter, with its own fall (a crackle, a drop, the crack of thunder). */
  private burst(t: number, len: number, type: BiquadFilterType, freq: number, q: number, peak: number, to: AudioNode, pan = 0): void {
    const c = this.ctx
    const src = c.createBufferSource()
    src.buffer = this.white
    src.playbackRate.value = rand(0.8, 1.2)
    const f = filter(c, type, freq, q)
    const g = gain(c)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.0015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len)
    const p = c.createStereoPanner()
    p.pan.value = pan
    src.connect(f).connect(g).connect(p).connect(to)
    src.start(t, Math.random() * (this.white.duration - 1), len + 0.05)
  }

  /** A tone gliding from one pitch to another with its own swell and fall (a note of a song, a drip, a hoot). */
  private tone(t: number, len: number, from: number, to: number, peak: number, out: AudioNode, pan = 0, wave: OscillatorType = 'sine', vibrato = 0): void {
    const c = this.ctx
    const o = c.createOscillator()
    o.type = wave
    o.frequency.setValueAtTime(from, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + len)
    if (vibrato) {
      const lfo = c.createOscillator()
      lfo.frequency.value = rand(5, 8)
      const depth = gain(c, from * vibrato)
      lfo.connect(depth).connect(o.frequency)
      lfo.start(t)
      lfo.stop(t + len + 0.05)
    }
    const g = gain(c)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.02, len / 4))
    g.gain.exponentialRampToValueAtTime(0.0001, t + len)
    const p = c.createStereoPanner()
    p.pan.value = pan
    o.connect(g).connect(p).connect(out)
    o.start(t)
    o.stop(t + len + 0.05)
  }

  /** A bird's song: one of a few kinds — a two-note call, a twitter, a run of glides, a dove's soft coo. */
  private song(t: number, dawn: boolean): void {
    const out = this.sends.life
    const pan = rand(-0.85, 0.85)
    const loud = rand(0.012, 0.03)
    const kind = pick(dawn ? ['call', 'twitter', 'glide', 'coo'] : ['call', 'twitter', 'glide', 'call', 'twitter'])
    if (kind === 'call') {
      const hi = rand(4200, 5200)
      const lo = hi * rand(0.8, 0.88)
      for (let i = 0, n = Math.floor(rand(4, 9)); i < n; i++) this.tone(t + i * 0.17, 0.07, i % 2 ? lo : hi, (i % 2 ? lo : hi) * 0.94, loud, out, pan)
    } else if (kind === 'twitter') {
      let at = t
      for (let i = 0, n = Math.floor(rand(7, 14)); i < n; i++) {
        const f = rand(3600, 7200)
        const len = rand(0.03, 0.055)
        this.tone(at, len, f, f * rand(0.75, 1.2), loud * 0.8, out, pan)
        at += len + rand(0.02, 0.045)
      }
    } else if (kind === 'glide') {
      let at = t
      for (let i = 0, n = Math.floor(rand(3, 6)); i < n; i++) {
        const len = rand(0.14, 0.3)
        this.tone(at, len, rand(2600, 6200), rand(2400, 6600), loud, out, pan, 'sine', 0.01)
        at += len + rand(0.08, 0.16)
      }
    } else for (let i = 0; i < 3; i++) this.tone(t + i * 0.42, i === 1 ? 0.45 : 0.3, 500, 455, loud * 1.4, out, pan, 'sine', 0.006)
  }

  /** What comes and goes, scheduled a little ahead of the clock. */
  private schedule(): void {
    const s = this.state
    const c = this.ctx
    if (!s || c.state !== 'running' || document.hidden) return
    const now = c.currentTime
    const until = now + AHEAD
    const n = this.next
    const L = this.layers
    const out = s.light === 'outdoor'
    const dark = s.light === 'dark'
    const wet = s.weather === 'rain' || s.weather === 'storm'
    const night = isNight(s.hour, s.dusk, s.dawn)
    const morning = !night && s.hour < s.dawn + 3

    // the wind's band wanders and its gusts swell and fall
    if (n.gust <= now) {
      n.gust = now + rand(1.5, 4)
      L.windBand.frequency.setTargetAtTime(rand(260, 620), now, 1.6)
      L.whistleBand.frequency.setTargetAtTime(rand(900, 1500), now, 2.2)
    }
    // the water's babble comes and goes
    if (n.babble <= now) {
      n.babble = now + rand(0.08, 0.25)
      L.babble.gain.setTargetAtTime(rand(0.1, 0.9), now, 0.06)
    }
    // a fire's crackles, as many as it is near
    if (s.fire > 0.02) {
      while (n.crackle < until) {
        n.crackle = Math.max(n.crackle, now) + rand(0.03, 0.22) / (0.4 + s.fire)
        const pop = Math.random() < 0.12
        this.burst(n.crackle, pop ? rand(0.03, 0.06) : rand(0.004, 0.018), 'bandpass', pop ? rand(700, 1500) : rand(1800, 5200), 1.2, (pop ? 0.3 : rand(0.05, 0.21)) * s.fire, this.sends.crackle, rand(-0.3, 0.3))
      }
    } else n.crackle = now
    // the rain's drops
    if (wet && !dark) {
      const heavy = s.weather === 'storm' ? 2 : 1
      while (n.drop < until) {
        n.drop = Math.max(n.drop, now) + rand(0.01, 0.08) / heavy
        this.burst(n.drop, rand(0.006, 0.016), 'bandpass', rand(2500, 7000), 2, rand(0.008, 0.028), this.sends.drops, rand(-0.9, 0.9))
      }
    } else n.drop = now
    // birds by day, out of the rain and off the snow
    if (out && !night && !wet && s.cold < 0.6) {
      if (n.song <= now) (n.song = now + rand(morning ? 1.5 : 3, morning ? 6 : 11)), this.song(now + 0.05, morning)
    } else n.song = now + rand(1, 4)
    // crickets at night where it is not cold or wet; now and then an owl
    const chirping = (out || s.light === 'indoor') && night && !wet && s.cold < 0.4
    for (const k of this.crickets) {
      if (!chirping) {
        k.next = now + rand(0, 1)
        continue
      }
      while (k.next < until) {
        const t = Math.max(k.next, now)
        const peak = 0.006
        for (let i = 0; i < 3; i++) {
          const on = t + i * 0.04
          k.amp.gain.setValueAtTime(0, on)
          k.amp.gain.linearRampToValueAtTime(peak, on + 0.003)
          k.amp.gain.setValueAtTime(peak, on + 0.016)
          k.amp.gain.linearRampToValueAtTime(0, on + 0.02)
        }
        k.next = t + k.period * rand(0.9, 1.1)
      }
    }
    if (out && night && !wet) {
      if (n.owl <= now) {
        if (n.owl) {
          const pan = rand(-0.7, 0.7)
          const f = rand(340, 390)
          this.tone(now + 0.05, 0.38, f, f * 0.94, 0.03, this.echo, pan, 'sine', 0.008)
          this.tone(now + 0.75, 0.22, f * 1.02, f * 0.96, 0.025, this.echo, pan, 'sine', 0.008)
          this.tone(now + 1.05, 0.5, f, f * 0.9, 0.03, this.echo, pan, 'sine', 0.008)
        }
        n.owl = now + rand(40, 110)
      }
    } else n.owl = 0
    // drips in the dark, ringing
    if (dark) {
      if (n.drip <= now) {
        n.drip = now + rand(1.2, 5)
        const f = rand(1300, 2800)
        this.tone(now + 0.05, rand(0.18, 0.32), f, f * rand(0.75, 0.85), rand(0.012, 0.03), this.sends.drips, rand(-0.8, 0.8))
      }
    } else n.drip = now + rand(0.5, 2)
  }

  /** No ambience at all (the editor's canvas). */
  disable(): void {
    clearInterval(this.timer)
    this.bus.disconnect()
  }
}
