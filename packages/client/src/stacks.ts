// Identical items (same type, name, tags and statuses) are shown as one stack.

import type { ItemInfo } from '@lsw/engine'

export function stacks(items: ItemInfo[]): ItemInfo[][] {
  const by = new Map<string, ItemInfo[]>()
  for (const it of items) {
    const key = JSON.stringify([it.type, it.name, [...it.tags].sort(), [...it.statuses].sort()])
    const s = by.get(key)
    if (s) s.push(it)
    else by.set(key, [it])
  }
  return [...by.values()]
}
