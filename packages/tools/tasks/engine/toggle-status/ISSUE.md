# Add a `toggleStatus` effect primitive

Rules can add a status (`addStatus`) or remove one (`removeStatus`), but there is no way to
flip one: a lever that switches a lamp on and off, a bell that wakes or lulls, a cloak that is
worn or taken off all need two rules today, one guarded by the status and one by its absence.

Add a primitive `{ op: 'toggleStatus', of: <role>, status: <status id>, duration?: <ticks> }`
that removes the status from the role if it has it, and adds it (with the optional duration)
if it does not.

It must be a first-class primitive like the others: typed with the other effects, documented
in the ModSpec (patch authors read `PRIMITIVES`), applied by the effects runner, and checked by
the patch validator like `addStatus` is (an unknown status is an error).
