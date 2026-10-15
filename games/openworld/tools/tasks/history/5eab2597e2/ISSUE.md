# A status that wards another off does not stop it from taking hold: fireproof does not keep burning away

## What is wrong

`StatusDef.wards` lists the statuses that cannot take hold on a body while the status holding that field lasts. The fireproof draught declares `wards: ['burning']`, so burning should not take hold on anyone under it.

`applyStatus` does not consult `wards`. It reads only `clears`. So burning can still be applied to a body that is fireproof, and the draught does nothing against fire.

An earlier fix for this was lost when a merge overwrote it. The behaviour needs to be restored.

## Expected behaviour

- With `fireproof` in force on an entity, applying `burning` to it leaves the entity without `burning`. `fireproof` remains in force.
- Once `fireproof` has been removed, applying `burning` works as normal and the entity is burning.
- A ward is limited to what it names. With `fireproof` in force, applying `wet` (not named in its wards) still takes hold.
- With no warding status on the entity, `burning` takes hold as it always did.
- The fireproof status definition in the content still lists `burning` among its `wards`.

## Requirements

- `applyStatus` must refuse to apply a status when any status currently held by the target lists it in its `wards`. Nothing should be applied.
- A refused application must not trigger side effects of applying the status. In particular, it must not remove statuses the refused status would have `clears`ed.
- The check considers only statuses the target holds now. Once the warding status is gone, the ward no longer applies.
- Statuses not named in any held status's `wards` are unaffected, as is applying a status to a target that holds no statuses.
- The existing declaration of `wards: ['burning']` on the fireproof draught must stay in place.

## Interface

None
