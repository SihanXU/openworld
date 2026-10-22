/** The unconfirmed assignment state for one resident in the homestead panel. */
export interface ResidentWorkDraft {
  kind: 'harvest' | 'feed'
  warehouse: string
  cells: Set<string>
  animalIds: Set<string>
  editing?: boolean
}

/** A single pending animal claim, independent of any resident's work assignment. */
export function transitionResidentAnimalClaim(
  selectedAnimalId: string | undefined,
  action:
    | { type: 'begin'; animalId: string; claimableIds: Set<string> }
    | { type: 'refresh'; authoritative: boolean; claimableIds: Set<string> }
    | { type: 'confirm'; claimableIds: Set<string> }
    | { type: 'cancel' },
): { selectedAnimalId: string | undefined; command?: { op: 'claim'; animal: string } } {
  if (action.type === 'begin') return {
    selectedAnimalId: action.claimableIds.has(action.animalId) ? action.animalId : undefined,
  }
  if (action.type === 'cancel') return { selectedAnimalId: undefined }
  if (action.type === 'refresh') return {
    selectedAnimalId: !action.authoritative || !selectedAnimalId || action.claimableIds.has(selectedAnimalId) ? selectedAnimalId : undefined,
  }
  return selectedAnimalId && action.claimableIds.has(selectedAnimalId)
    ? { selectedAnimalId: undefined, command: { op: 'claim', animal: selectedAnimalId } }
    : { selectedAnimalId: undefined }
}

/** Copy the active order into a draft, so canceling an edit restores its exact job kind and targets. */
export function residentWorkDraftForOrder(order: {
  kind: 'harvest' | 'feed'
  warehouse: string
  cells: { x: number; y: number }[]
  animalIds: string[]
}): ResidentWorkDraft {
  return {
    kind: order.kind,
    warehouse: order.warehouse,
    cells: new Set(order.cells.map(({ x, y }) => `${x},${y}`)),
    animalIds: new Set(order.animalIds),
    editing: false,
  }
}

/** A versioned client choice contains only the target collection for its selected job kind. */
export function residentWorkAssignment(worker: string, draft: ResidentWorkDraft): Record<string, unknown> {
  if (draft.kind === 'feed') return {
    op: 'assign', kind: 'feed', worker, warehouse: draft.warehouse, animalIds: [...draft.animalIds],
  }
  return {
    op: 'assign', kind: 'harvest', worker, warehouse: draft.warehouse,
    cells: [...draft.cells].map((key) => {
      const [x, y] = key.split(',').map(Number)
      return { x, y }
    }),
  }
}

/** Whether an edited assignment would replace any part of the current order. */
export function residentWorkDraftDiffersFromOrder(
  draft: ResidentWorkDraft,
  order: { kind: 'harvest' | 'feed'; warehouse: string; cells: { x: number; y: number }[]; animalIds: string[] },
): boolean {
  const cells = new Set(order.cells.map(({ x, y }) => `${x},${y}`))
  const animals = new Set(order.animalIds)
  return draft.kind !== order.kind || draft.warehouse !== order.warehouse
    || !sameSet(draft.kind === 'harvest' ? draft.cells : new Set(), draft.kind === 'harvest' ? cells : new Set())
    || !sameSet(draft.kind === 'feed' ? draft.animalIds : new Set(), draft.kind === 'feed' ? animals : new Set())
}

/** Prune stale unconfirmed choices only when the residence's live work lists are authoritative. */
export function reconcileResidentWorkDraft(
  draft: ResidentWorkDraft,
  current: {
    groundVisible: boolean
    targetKeys: Set<string>
    previouslyAuthorizedKeys: Set<string>
    animalIds: Set<string>
    selectableAnimalIds: Set<string>
    selectableWarehouses: Set<string>
  },
): { unavailableWarehouse: boolean; removedDraftCell: boolean; removedDraftAnimal: boolean } {
  if (!current.groundVisible) return { unavailableWarehouse: false, removedDraftCell: false, removedDraftAnimal: false }
  let removedDraftCell = false
  for (const key of draft.cells) if (!current.targetKeys.has(key) && !current.previouslyAuthorizedKeys.has(key)) {
    draft.cells.delete(key)
    removedDraftCell = true
  }
  let removedDraftAnimal = false
  for (const id of draft.animalIds) if (!current.animalIds.has(id) || !current.selectableAnimalIds.has(id)) {
    draft.animalIds.delete(id)
    removedDraftAnimal = true
  }
  const unavailableWarehouse = !!draft.warehouse && !current.selectableWarehouses.has(draft.warehouse)
  if (unavailableWarehouse) draft.warehouse = ''
  return { unavailableWarehouse, removedDraftCell, removedDraftAnimal }
}

function sameSet<T>(a: Set<T>, b: Set<T>): boolean {
  return a.size === b.size && [...a].every((item) => b.has(item))
}
