export type EquipmentButton = 'left' | 'right' | 'mode'

type Gesture<Aim> = {
  button: EquipmentButton
  scope: string
  aim: Aim
  double: boolean
  repeat?: boolean
  held?: boolean
  perform: (aim: Aim, double: boolean) => boolean
}

const DOUBLE_MS = 220
const REPEAT_MS = 140

/** Resolve pointer edges before committing attacks. The host steps held inputs with its game clock. */
export class EquipmentGestures<Aim> {
  private pending?: { input: Gesture<Aim>; timer: ReturnType<typeof setTimeout> }
  private repeating?: { input: Gesture<Aim>; next: number }

  constructor(private readonly clock = () => performance.now()) {}

  private pop() {
    const previous = this.pending
    if (previous) clearTimeout(previous.timer)
    this.pending = undefined
    return previous?.input
  }

  cancel(): void {
    this.pop()
    this.repeating = undefined
  }

  release(button: EquipmentButton): void {
    if (this.pending?.input.button === button) this.pending.input.held = false
    if (this.repeating?.input.button === button) this.repeating = undefined
  }

  private single(input: Gesture<Aim>): void {
    if (input.perform(input.aim, false) && input.held && input.repeat)
      this.repeating = { input, next: this.clock() + REPEAT_MS }
  }

  press(input: Gesture<Aim>): void {
    const previous = this.pop()
    if (input.button === 'mode') {
      if (previous) this.single(previous)
      this.repeating = undefined
      this.single(input)
      return
    }
    if (previous?.button === input.button && previous.scope === input.scope && input.double) {
      this.release(input.button)
      input.perform(input.aim, true)
      return
    }
    if (previous) this.single(previous)
    if (!input.double) { this.single(input); return }
    const timer = setTimeout(() => {
      this.pending = undefined
      this.single(input)
    }, DOUBLE_MS)
    this.pending = { input, timer }
  }

  step(aim?: Aim, now = this.clock()): void {
    const current = this.repeating
    if (!current || now < current.next) return
    current.next = Math.max(now + 35, current.next + REPEAT_MS)
    if (!current.input.perform(aim ?? current.input.aim, false)) this.repeating = undefined
  }
}
