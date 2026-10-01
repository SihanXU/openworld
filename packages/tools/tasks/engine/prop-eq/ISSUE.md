# Tests cannot check that a property has an exact value

A rule's tests (and the patch validator's replays) check outcomes with expectations such as
`{ key, hasStatus }`, `{ key, propGt: [prop, n] }` and `{ key, propLt: [prop, n] }`. There is no way
to say "this property now equals that value", so a rule that sets `owner: 'maren'` or
`planks: 3` cannot be tested precisely.

Add an expectation `{ key: string, propEq: [prop: string, value: string | number | boolean] }`:
it passes when the entity's property equals the value, and otherwise reports what the property
actually is. Make it part of the scenario/test format everywhere expectations are: the types,
the checker, and the ModSpec's description of expectations (patch authors read it).
