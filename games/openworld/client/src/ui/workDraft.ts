/** The unconfirmed assignment state for one resident in the homestead panel. */
export interface ResidentWorkDraft {
  warehouse: string
  cells: Set<string>
  editing?: boolean
}

/** Prune stale unconfirmed choices only when the residence's live work lists are authoritative. */
export function reconcileResidentWorkDraft(
  draft: ResidentWorkDraft,
  current: { groundVisible: boolean; targetKeys: Set<string>; previouslyAuthorizedKeys: Set<string>; selectableWarehouses: Set<string> },
): { unavailableWarehouse: boolean; removedDraftCell: boolean } {
  if (!current.groundVisible) return { unavailableWarehouse: false, removedDraftCell: false }
  let removedDraftCell = false
  for (const key of draft.cells) if (!current.targetKeys.has(key) && !current.previouslyAuthorizedKeys.has(key)) {
    draft.cells.delete(key)
    removedDraftCell = true
  }
  const unavailableWarehouse = !!draft.warehouse && !current.selectableWarehouses.has(draft.warehouse)
  if (unavailableWarehouse) draft.warehouse = ''
  return { unavailableWarehouse, removedDraftCell }
}
