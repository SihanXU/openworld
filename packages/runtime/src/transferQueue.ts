export interface TransferProgress<From extends string = 'chest' | 'bag'> {
  from: From
  done: number
  total: number
}

type TransferTurnScheduler = (run: () => void) => () => void

type TransferStep = { done: number; total: number }
type TransferTask<From extends string> = {
  steps: Generator<TransferStep, void>
  from: From
  valid: () => boolean
}

const MAX_STEPS = 64
const MAX_MS = 8

/** Runs inventory operations in short turns so the worker can process messages between batches. */
export class TransferQueue<From extends string = 'chest' | 'bag'> {
  private readonly tasks: TransferTask<From>[] = []
  private cancelScheduled: (() => void) | undefined
  private running = false
  private generation = 0
  private currentProgress: TransferProgress<From> | undefined

  constructor(
    private readonly onError: (err: unknown) => void,
    private readonly now: () => number = () => performance.now(),
    private readonly scheduleTurn: TransferTurnScheduler = (run) => {
      const timer = setTimeout(run, 0)
      return () => clearTimeout(timer)
    },
  ) {}

  get busy(): boolean {
    return this.running || this.cancelScheduled !== undefined || this.tasks.length > 0
  }

  get progress(): TransferProgress<From> | undefined {
    return this.currentProgress
  }

  enqueue(steps: Generator<TransferStep, void>, from: From, valid: () => boolean): void {
    this.tasks.push({ steps, from, valid })
    this.schedule()
  }

  cancel(): void {
    this.generation++
    this.cancelScheduled?.()
    this.cancelScheduled = undefined
    const tasks = this.tasks.splice(0)
    this.currentProgress = undefined
    for (const task of tasks) this.return(task)
  }

  private schedule(): void {
    if (this.running || this.cancelScheduled !== undefined || !this.tasks.length) return
    this.cancelScheduled = this.scheduleTurn(() => {
      this.cancelScheduled = undefined
      this.pump()
    })
  }

  private pump(): void {
    if (this.running) return
    this.running = true
    const generation = this.generation
    const started = this.now()
    let steps = 0
    try {
      while (this.tasks.length && steps < MAX_STEPS && generation === this.generation) {
        // A single iterator.next() cannot be interrupted. Always let one step run, then stop
        // before starting another once the time budget has elapsed.
        if (steps > 0 && this.now() - started >= MAX_MS) break
        const task = this.tasks[0]!
        let valid: boolean
        try {
          valid = task.valid()
        } catch (err) {
          this.report(err)
          this.return(task)
          this.finish(task)
          continue
        }
        if (!valid) {
          this.return(task)
          this.finish(task)
          continue
        }

        let result: IteratorResult<TransferStep, void>
        try {
          result = task.steps.next()
        } catch (err) {
          this.report(err)
          this.return(task)
          this.finish(task)
          continue
        }
        steps++
        if (generation !== this.generation) break
        if (result.done) {
          this.finish(task)
        } else {
          this.currentProgress = { from: task.from, ...result.value }
        }
      }
    } finally {
      this.running = false
      if (!this.tasks.length) this.currentProgress = undefined
      this.schedule()
    }
  }

  private finish(task: TransferTask<From>): void {
    if (this.tasks[0] === task) this.tasks.shift()
    this.currentProgress = undefined
  }

  private return(task: TransferTask<From>): void {
    try {
      task.steps.return()
    } catch (err) {
      this.report(err)
    }
  }

  private report(err: unknown): void {
    try {
      this.onError(err)
    } catch {
      // An error reporter must not keep later queued transfers from running.
    }
  }
}
