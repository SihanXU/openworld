// The music (docs/music.md): one director decides what plays, and plays it as cues. What it plays, first to last:
// the title's own piece; a scene's music (its `music` command, '' for silence); a boss fight's, by the boss's kind and
// phase; a fight's, held a few seconds past the last blow; else the place's — its map's mood, in the version for the
// hour and the weather (the hours of the night move as the story's night lengthens). The place's piece is kept where
// it was while another plays over it and taken up again after; a change of the hour or the weather waits for the end
// of the piece playing; the wilds' cues leave rests of silence between their pieces (Breath of the Wild, Minecraft).
// Every piece is brought to one loudness (the catalogue's measured LUFS). Pieces stream through <audio> elements into
// the music bus, so nothing long is decoded into memory.

import type { MusicCue } from '../assets/types.ts'
import { catalog } from '../game.ts'
import { assetUrl } from '../render/assets.ts'
import { momentsOf, resolveCue, type Moment } from './cues.ts'

export type { Moment } from './cues.ts'

/** The loudness every piece is brought to (integrated LUFS); louder or quieter files are turned down or up to it. */
const TARGET_LUFS = -16
/** No piece is turned up by more than this (a very quiet file stays a little quiet rather than its noise brought up). */
const MAX_BOOST_DB = 9
/** How long a fight's music outlasts the last moment of the fight (the `fighting` flag), in seconds. */
const FIGHT_HOLD = 7
/** Fades, in seconds: into a fight (quick), out of one, a boss, a scene, the title, the place's own. */
const FADE = { fightIn: 0.6, fightOut: 3, boss: 1.2, scene: 2, title: 2.5, place: 2.5, placeOut: 1.5, death: 0.4 }

/** How much a file is turned up or down to the common loudness (a gain factor). */
function levelling(file: string): number {
  const lufs = catalog().loudness?.[file]
  if (lufs === undefined) return 1
  return 10 ** (Math.min(MAX_BOOST_DB, TARGET_LUFS - lufs) / 20)
}

/** One piece streaming: an <audio> element into its own gain, into the bus. */
class Voice {
  readonly el: HTMLAudioElement
  private gain: GainNode
  private node: MediaElementAudioSourceNode
  private gone = false

  constructor(
    private ctx: AudioContext,
    out: AudioNode,
    readonly file: string,
    loop: boolean,
    onEnded: () => void,
  ) {
    this.el = new Audio(assetUrl(file))
    this.el.loop = loop
    this.el.preload = 'auto'
    this.el.addEventListener('ended', () => this.gone || onEnded())
    this.node = ctx.createMediaElementSource(this.el)
    this.gain = ctx.createGain()
    this.gain.gain.value = 0
    this.node.connect(this.gain).connect(out)
  }

  /** To a level over so many seconds (from wherever it is now). */
  fade(to: number, secs: number): void {
    const g = this.gain.gain
    const t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(to, t + Math.max(0.01, secs))
  }

  play(): Promise<void> {
    // (taken up again before a pause asked for came: the pause is called off)
    clearTimeout(this.pausing)
    return this.el.play().catch((err: Error) => {
      // (the page has not been touched yet: the director tries again on the first touch)
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') console.warn(`[music] ${this.file}: ${err.message}`)
    })
  }

  /** Faded out, then paused where it is (to be taken up again). */
  pauseAfter(secs: number): void {
    this.fade(0, secs)
    clearTimeout(this.pausing)
    this.pausing = setTimeout(() => this.el.pause(), secs * 1000 + 50)
  }
  private pausing?: ReturnType<typeof setTimeout>

  /** Faded out and let go. */
  stopAfter(secs: number): void {
    this.fade(0, secs)
    this.gone = true
    setTimeout(() => {
      this.el.pause()
      this.node.disconnect()
      this.gain.disconnect()
      this.el.removeAttribute('src')
      this.el.load()
    }, secs * 1000 + 50)
  }
}

/** A cue playing: its pieces one after another (and its rests), at its level. */
class Strand {
  private voice?: Voice
  private rest?: ReturnType<typeof setTimeout>
  private order: number[] = []
  private last = -1
  private held = false
  /** The cue to go on with once the piece playing ends (the hour or the weather changed it). */
  pending?: { name: string; cue: MusicCue }

  constructor(
    private ctx: AudioContext,
    private out: AudioNode,
    public name: string,
    private cue: MusicCue,
  ) {}

  private get level(): number {
    return this.cue.volume ?? 1
  }

  /** One piece looping on its own: it has no end at which to change. */
  get loops(): boolean {
    return this.cue.tracks!.length === 1 && !this.cue.rest
  }

  /** The next piece: a shuffled round of them, never the one just played first in the next round. */
  private nextFile(): string {
    const tracks = this.cue.tracks!
    if (!this.order.length) {
      this.order = tracks.map((_, i) => i)
      for (let i = this.order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[this.order[i], this.order[j]] = [this.order[j], this.order[i]]
      }
      if (this.order.length > 1 && this.order[0] === this.last) this.order.push(this.order.shift()!)
    }
    this.last = this.order.shift()!
    return tracks[this.last]
  }

  start(fade: number): this {
    this.held = false
    this.playNext(fade)
    return this
  }

  private playNext(fade: number): void {
    if (this.pending) ((this.name = this.pending.name), (this.cue = this.pending.cue), (this.order = []), (this.pending = undefined))
    const file = this.nextFile()
    // one piece and no rests: it loops on its own, without a gap
    const loop = this.cue.tracks!.length === 1 && !this.cue.rest
    const v = new Voice(this.ctx, this.out, file, loop, () => this.ended(v))
    this.voice = v
    v.fade(this.level * levelling(file), fade)
    if (!this.held) void v.play()
  }

  private ended(v: Voice): void {
    if (v !== this.voice) return
    v.stopAfter(0)
    this.voice = undefined
    const rest = this.cue.rest
    if (!rest) return this.playNext(0.05)
    const secs = rest[0] + Math.random() * (rest[1] - rest[0])
    this.rest = setTimeout(() => ((this.rest = undefined), this.held || this.playNext(1.5)), secs * 1000)
  }

  /** Faded out and held where it is (a fight or a scene plays over it). */
  pause(fade: number): void {
    if (this.held) return
    this.held = true
    this.voice?.pauseAfter(fade)
  }

  /** Taken up again where it was held (resting: the rest goes on). */
  resume(fade: number): void {
    if (!this.held) return
    this.held = false
    if (this.pending && !this.voice) return this.playNext(fade)
    if (this.voice) {
      void this.voice.play()
      this.voice.fade(this.level * levelling(this.voice.file), fade)
    } else if (!this.rest) this.playNext(fade)
  }

  stop(fade: number): void {
    if (this.rest) clearTimeout(this.rest)
    this.rest = undefined
    this.voice?.stopAfter(fade)
    this.voice = undefined
  }

  /** The first touch of the page: a piece that could not start yet starts now. */
  retry(): void {
    if (!this.held && this.voice?.el.paused) void this.voice.play()
  }
}

/** What the director is told: each by its own source (the scene, the cover, the death screen). */
interface Wants {
  title: boolean
  death: boolean
  /** A scene's music: a cue, '' silence, undefined none. */
  scene?: string
  boss?: { kind: string; phase: number }
  /** The map's mood and its light (for a map that names no mood). */
  mood?: string
  light: string
}

export class MusicDirector {
  private place?: Strand
  private over?: Strand
  /** What plays over the place now, by what it is (its fade out differs). */
  private overKind?: 'title' | 'scene' | 'boss' | 'fight'
  /** (no place yet: the first map's light is told with its mood) */
  private want: Wants = { title: false, death: false, light: '' }
  private moment: Moment = { hour: 12, dusk: 19, dawn: 6, weather: 'sun' }
  /** The fight's music plays until then (performance.now ms). */
  private fightUntil = 0
  private timer?: ReturnType<typeof setInterval>
  private off = false

  constructor(
    private ctx: AudioContext,
    private out: AudioNode,
  ) {
    // a piece the browser would not start before the page was touched starts on the first touch
    const touch = () => {
      void this.ctx.resume().then(() => (this.place?.retry(), this.over?.retry()))
      if (this.ctx.state === 'running') for (const t of ['pointerdown', 'keydown']) removeEventListener(t, touch, true)
    }
    for (const t of ['pointerdown', 'keydown']) addEventListener(t, touch, true)
    this.timer = setInterval(() => this.decide(), 500)
  }

  /** No music at all (the editor's canvas). */
  disable(): void {
    this.off = true
    clearInterval(this.timer)
    this.over?.stop(0.3)
    this.place?.stop(0.3)
    this.over = this.place = undefined
  }

  setTitle(on: boolean): void {
    this.set({ title: on })
  }
  setDeath(on: boolean): void {
    this.set({ death: on })
  }
  setScene(cue: string | undefined): void {
    this.set({ scene: cue })
  }
  setBoss(boss: { kind: string; phase: number } | undefined): void {
    if (boss?.kind === this.want.boss?.kind && boss?.phase === this.want.boss?.phase) return
    this.set({ boss })
  }
  setPlace(mood: string | undefined, light: string): void {
    this.set({ mood, light })
  }
  setMoment(m: Moment): void {
    const before = this.moment
    this.moment = m
    if (momentsOf(before).join() !== momentsOf(m).join()) this.decide()
  }
  /** The frame says whether the player is in a fight: the music holds a few seconds past its end. */
  setFight(on: boolean): void {
    if (on) {
      const was = performance.now() < this.fightUntil
      this.fightUntil = performance.now() + FIGHT_HOLD * 1000
      if (!was) this.decide()
    }
  }

  private set(w: Partial<Wants>): void {
    if (Object.entries(w).every(([k, v]) => JSON.stringify(this.want[k as keyof Wants]) === JSON.stringify(v))) return
    Object.assign(this.want, w)
    this.decide()
  }

  /** What should play over the place now, as a cue's name ('' silence), and what it is. */
  private overNow(): { name: string; kind: 'title' | 'scene' | 'boss' | 'fight' } | undefined {
    const cues = catalog().music
    const w = this.want
    if (w.title) return { name: 'title', kind: 'title' }
    if (w.scene !== undefined) return { name: w.scene, kind: 'scene' }
    if (w.boss) {
      const { kind, phase } = w.boss
      const tail = kind.split('/').pop()!
      const name = [`boss:${kind}:${phase}`, `boss:${kind}`, `boss:${tail}:${phase}`, `boss:${tail}`, 'boss'].find((n) => cues[n] !== undefined)
      if (name) return { name, kind: 'boss' }
    }
    if (performance.now() < this.fightUntil && cues.battle !== undefined) return { name: 'battle', kind: 'fight' }
    return undefined
  }

  private decide(): void {
    if (this.off) return
    const cues = catalog().music
    const w = this.want
    if (w.death) {
      this.over?.stop(FADE.death)
      this.over = this.overKind = undefined
      this.place?.pause(FADE.death)
      return
    }
    const over = this.overNow()
    if (over) {
      const target = over.name ? resolveCue(cues, over.name, this.moment) : undefined
      if (this.over?.name !== target?.name || !target) {
        const fadeOut = this.overKind === 'fight' ? FADE.fightOut : FADE.placeOut
        this.over?.stop(over.kind === 'fight' ? FADE.fightIn : fadeOut)
        this.over = target && new Strand(this.ctx, this.out, target.name, target.cue).start(over.kind === 'fight' ? FADE.fightIn : FADE[over.kind])
      }
      this.overKind = over.kind
      this.place?.pause(over.kind === 'fight' ? FADE.fightIn : FADE.placeOut)
      return
    }
    if (this.over) {
      this.over.stop(this.overKind === 'fight' ? FADE.fightOut : FADE.placeOut)
      this.over = this.overKind = undefined
    }
    const placeCue = resolveCue(cues, w.mood ?? w.light, this.moment) ?? (w.mood ? resolveCue(cues, w.light, this.moment) : undefined)
    if (!placeCue) {
      this.place?.stop(FADE.placeOut)
      this.place = undefined
      return
    }
    const sameMood = this.place && (this.placeMood === (w.mood ?? w.light))
    if (this.place && this.place.name !== placeCue.name) {
      // the hour or the weather: at the end of the piece playing (one that loops on its own changes now)
      if (sameMood && !this.place.loops) this.place.pending = placeCue
      else {
        this.place.stop(FADE.placeOut)
        this.place = undefined
      }
    } else if (this.place) this.place.pending = undefined
    if (!this.place) {
      this.place = new Strand(this.ctx, this.out, placeCue.name, placeCue.cue).start(FADE.place)
      this.placeMood = w.mood ?? w.light
    } else this.place.resume(FADE.place)
  }
  private placeMood?: string
}
