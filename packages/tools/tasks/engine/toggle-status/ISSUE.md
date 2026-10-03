# Add a `toggleStatus` effect primitive

Rules can add a status (`addStatus`) or remove one (`removeStatus`), but there is no way to
flip one: a lever that switches a lamp on and off, a bell that wakes or lulls, a cloak that is
worn or taken off all need two branches today, one for the status and one for its absence.

Add a primitive `{ op: 'toggleStatus', status: <status id>, duration?: <ticks> }` that removes
the status from the rule's host if it has it, and adds it (with the optional duration) if it does
not. Like every effect, it acts on the host only.

It must be a first-class primitive like the others: typed with the other effects, documented
in the ModSpec (patch authors read `PRIMITIVES`), applied by the effects runner, and checked by
the patch validator like `addStatus` is (an unknown status is an error).
