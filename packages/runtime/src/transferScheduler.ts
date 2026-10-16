interface TransferPort {
  onmessage: ((event: MessageEvent) => void) | null
  postMessage(value: unknown): void
}

interface TransferChannel {
  port1: TransferPort
  port2: TransferPort
}

export type TransferTurnScheduler = (run: () => void) => () => void

/** Create a FIFO scheduler backed by one reusable MessageChannel. */
export function createTransferScheduler(channelFactory: () => TransferChannel = () => new MessageChannel()): TransferTurnScheduler {
  const { port1, port2 } = channelFactory()
  const queue: { run: () => void; cancelled: boolean }[] = []
  let armed = false

  const signal = () => {
    if (armed) return
    armed = true
    port2.postMessage(undefined)
  }

  port1.onmessage = () => {
    armed = false
    const task = queue.shift()
    try {
      if (task && !task.cancelled) task.run()
    } finally {
      if (queue.length) signal()
    }
  }

  return (run) => {
    const task = { run, cancelled: false }
    queue.push(task)
    signal()
    return () => {
      if (task.cancelled) return
      task.cancelled = true
      const index = queue.indexOf(task)
      if (index >= 0) queue.splice(index, 1)
    }
  }
}

const schedule = createTransferScheduler()

/** Schedule one transfer turn without creating a timer chain. */
export function scheduleTransferTurn(run: () => void): () => void {
  return schedule(run)
}
