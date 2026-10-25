// The sound under the effects (docs/music.md): the music and the ambience, each through its own bus at the level the
// player chose (Options: music, ambience), both into the sound manager's own way out — so its mute and master volume
// hold for them as for the effects. A jingle (a level gained, a quest done) ducks the music for a moment.

import { prefs } from '../ui/common.ts'
import { Ambience } from './ambience.ts'
import { MusicDirector } from './music.ts'

/** The music bus's level at the player's full volume (the effects play at about 0.4–0.6). */
const MUSIC_LEVEL = 0.42
/** How far a jingle ducks the music, and for how long (with its fall and rise). */
const DUCK = { to: 0.3, secs: 2.6 }

export class Soundscape {
  readonly music: MusicDirector
  readonly ambience: Ambience
  private musicBus: GainNode
  private ducking: GainNode
  private ambienceBus: GainNode

  constructor(
    private ctx: AudioContext,
    out: AudioNode,
  ) {
    this.musicBus = ctx.createGain()
    this.ducking = ctx.createGain()
    this.ambienceBus = ctx.createGain()
    this.musicBus.connect(this.ducking).connect(out)
    this.ambienceBus.connect(out)
    this.levels()
    this.music = new MusicDirector(ctx, this.musicBus)
    this.ambience = new Ambience(ctx, this.ambienceBus)
  }

  /** The player's levels (prefs), eased to. */
  levels(): void {
    const t = this.ctx.currentTime
    this.musicBus.gain.setTargetAtTime(MUSIC_LEVEL * prefs.volume('music'), t, 0.1)
    this.ambienceBus.gain.setTargetAtTime(prefs.volume('ambience'), t, 0.1)
  }

  /** A jingle plays: the music steps back under it, and comes up again after. */
  duck(): void {
    const g = this.ducking.gain
    const t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(DUCK.to, t + 0.15)
    g.setValueAtTime(DUCK.to, t + DUCK.secs)
    g.linearRampToValueAtTime(1, t + DUCK.secs + 1.2)
  }

  /** Silent for good (the editor's canvas). */
  disable(): void {
    this.music.disable()
    this.ambience.disable()
  }
}
