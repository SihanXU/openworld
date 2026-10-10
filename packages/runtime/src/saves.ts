// Save slots: three in the browser (IndexedDB, storage.ts), each with a summary to show on the
// cover without loading it; any slot can be written out to a file on the player's computer
// and read back into a slot. The rule library the world has learned is shared by all slots.

import type { SaveData } from '@openworld/engine'
import type { SaveSummary } from './protocol.ts'
import { kvDel, kvGet, kvSet } from './storage.ts'

export const SLOTS = [1, 2, 3] as const
export type Slot = (typeof SLOTS)[number]

export interface SlotData {
  save: SaveData
  summary?: SaveSummary
  savedAt: string
}

/** The file a slot is exported as. */
interface SaveFile {
  format: 'openworld-save'
  version: 1
  world: string
  slot: SlotData
}

const key = (world: string, slot: Slot) => `save:${world}:slot${slot}`

export async function readSlot(world: string, slot: Slot): Promise<SlotData | undefined> {
  return kvGet<SlotData>(key(world, slot))
}

export async function writeSlot(world: string, slot: Slot, data: SlotData): Promise<void> {
  await kvSet(key(world, slot), data)
  await kvSet(`lastSlot:${world}`, slot)
}

export async function deleteSlot(world: string, slot: Slot): Promise<void> {
  await kvDel(key(world, slot))
}

export async function lastSlot(world: string): Promise<Slot | undefined> {
  const s = await kvGet<number>(`lastSlot:${world}`)
  return SLOTS.find((x) => x === s)
}

/** Every slot (undefined: empty). The single save of older versions moves into slot 1 first. */
export async function listSlots(world: string): Promise<(SlotData | undefined)[]> {
  const legacy = await kvGet<SaveData>(`save:${world}`)
  if (legacy) {
    if (!(await readSlot(world, 1))) await writeSlot(world, 1, { save: legacy, savedAt: legacy.savedAt })
    await kvDel(`save:${world}`)
  }
  return Promise.all(SLOTS.map((s) => readSlot(world, s)))
}

/** Download a slot as a .json file. */
export function exportSlot(world: string, slot: Slot, data: SlotData): void {
  const file: SaveFile = { format: 'openworld-save', version: 1, world, slot: data }
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const day = data.summary ? `-day${data.summary.day}` : ''
  // (OpenWorld's saves kept the name `world` from before there were other games)
  a.download = `${world === 'world' ? 'openworld' : world}-slot${slot}${day}-${data.savedAt.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Ask for a save file; resolves with its slot data, or throws if it is not one. */
export function pickSaveFile(): Promise<SlotData> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) return reject(new Error('no file'))
      try {
        const file = JSON.parse(await f.text()) as Partial<SaveFile>
        if (file.format !== 'openworld-save' || !file.slot?.save?.state) throw new Error('not an OpenWorld save')
        resolve(file.slot)
      } catch (err) {
        reject(err)
      }
    }
    input.click()
  })
}
