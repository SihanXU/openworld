// The three envelopes of a held beam share the game's Web Audio output and master mute.
type Phase = 'charge' | 'beam'
type Sample = 'charge' | 'blast' | 'body'

export class PrismAudio {
  private phase?: Phase
  private buffers = new Map<Sample, AudioBuffer>()
  private voice?: { gain: GainNode; sources: AudioScheduledSourceNode[] }

  constructor(private ctx: AudioContext, private out: AudioNode) {}

  sync(phase?: Phase, progress = 0): void {
    if (this.phase === phase) return
    this.release()
    this.phase = phase
    if (!phase) return
    const ctx = this.ctx
    const at = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(this.out)
    if (phase === 'charge') {
      const charge = this.sample('charge')
      const source = this.play(charge, gain)
      gain.gain.value = 0.33
      source.addEventListener('ended', () => gain.disconnect(), { once: true })
      source.start(at, Math.min(0.59, progress * charge.duration))
      this.voice = { gain, sources: [source] }
      return
    }
    const attack = ctx.createGain()
    attack.gain.value = 0.58
    attack.connect(this.out)
    const blast = this.play(this.sample('blast'), attack)
    blast.addEventListener('ended', () => attack.disconnect(), { once: true })
    blast.start(at)
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(0.125, at + 0.13)
    const tone = ctx.createOscillator()
    tone.type = 'triangle'
    tone.frequency.setValueAtTime(76, at)
    tone.frequency.exponentialRampToValueAtTime(106, at + 0.23)
    const low = ctx.createGain()
    low.gain.value = 0.4
    tone.connect(low).connect(gain)
    tone.addEventListener('ended', () => { tone.disconnect(); low.disconnect() }, { once: true })
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 560
    filter.Q.value = 0.7
    filter.connect(gain)
    const texture = this.play(this.sample('body'), filter)
    texture.loop = true
    texture.addEventListener('ended', () => { filter.disconnect(); gain.disconnect() }, { once: true })
    tone.start(at)
    texture.start(at)
    this.voice = { gain, sources: [tone, texture] }
  }

  private release(): void {
    if (!this.voice) return
    const { gain, sources } = this.voice
    this.voice = undefined
    const at = this.ctx.currentTime
    const level = gain.gain.value
    gain.gain.cancelScheduledValues(at)
    gain.gain.setValueAtTime(level, at)
    gain.gain.setTargetAtTime(0, at, 0.035)
    for (const node of sources) node.stop(at + 0.18)
  }

  private play(buffer: AudioBuffer, out: AudioNode): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(out)
    source.addEventListener('ended', () => source.disconnect(), { once: true })
    return source
  }

  private sample(kind: Sample): AudioBuffer {
    const existing = this.buffers.get(kind)
    if (existing) return existing
    const length = { charge: 0.6, blast: 0.46, body: 1.37 }[kind]
    const rate = this.ctx.sampleRate
    const buffer = this.ctx.createBuffer(1, Math.round(rate * length), rate)
    const data = buffer.getChannelData(0)
    let seed = 172479, phase = 0, low = 0, sub = 0
    for (let i = 0; i < data.length; i++) {
      const t = i / rate, p = t / length
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
      const noise = seed / 2147483648 - 1
      low += (noise - low) * 0.076
      sub += (noise - sub) * 0.014
      if (kind === 'charge') {
        phase += 2 * Math.PI * (126 + 645 * p * p) / rate
        const tone = 0.52 * Math.sin(phase) + 0.23 * Math.sin(phase * 2.018) + 0.1 * Math.sin(phase * 3.011)
        const shimmer = 0.84 + 0.16 * Math.sin(2 * Math.PI * (7 * t + 22 * t * t))
        const swell = Math.min(1, t / 0.025, (1 - p) * 28) * (0.1 + 0.9 * p ** 1.4)
        data[i] = (tone * shimmer + (noise - low) * (0.1 + 0.24 * p)) * swell
      } else if (kind === 'blast') {
        phase += 2 * Math.PI * (40 + 115 * Math.exp(-17 * t)) / rate
        const slam = (0.65 * Math.sin(phase) + 0.22 * Math.sin(phase * 2.03)) * Math.exp(-11 * t)
        const crack = ((noise - low) * 0.54 + low * 0.61) * Math.exp(-9.2 * t)
        data[i] = Math.tanh((slam + crack + sub * 0.54 * Math.exp(-5 * t)) * 1.7) * Math.min(1, t / 0.003, (1 - p) * 16)
      } else data[i] = noise * 0.53 + low * 0.3
    }
    this.buffers.set(kind, buffer)
    return buffer
  }
}
