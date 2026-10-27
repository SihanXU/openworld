// What the base rules do where an element is carried and the answer they give does not read it (a fire axe swung at
// anything, a rope held out to a fire slime): undefined there, so the AI answers and players find out what an element
// does (burns, freezes, stuns), with the answer as it was the default (with no model, the game plays as before).

import type { Cond, Effect, RoleName, Tree } from '@openworld/engine'

/** The elements (the ontology's; kept here, where nothing is imported, so every rule file may read them as it loads). */
export const ELEMENTS = ['fire', 'water', 'ice', 'lightning', 'wind', 'earth']

/** A role that carries an element: a thing rolled one (items.ts: a fire axe, a frost wand, a gem, a scroll) or a kind that has one (a fire slime, a frost wolf). */
export const ELEMENTAL = (role: RoleName): Cond => ({ any: ELEMENTS.map((e) => ({ is: { role, sel: { props: { element: e } } } })) })

/** An answer that does not read the element, where `when` finds one: undefined there, the answer its default. */
export const unlessElemental = (when: Cond, leaf: Tree): Tree => ({ if: when, then: { undefined: true, default: (leaf as { do: Effect[] }).do }, else: leaf })
