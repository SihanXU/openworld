// The words of the seat's inputs for an agent that reads them (the `welcome` of the protocol, docs/agent-players.md):
// keyed by the input's name, so that an input added to `SeatInput` without its words does not compile.

import type { SeatInput } from './seat.ts'

export interface InputDoc {
  t: SeatInput['t']
  doc: string
  args?: Record<string, string>
}

const KEY = 'hands | take | put | use | self | primary | secondary'

const DOCS: Record<SeatInput['t'], Omit<InputDoc, 't'>> = {
  move: { doc: 'Walk. With `steps` you walk exactly that many tiles and stop (or stop short at a wall): use it, calls are slow. Without it the direction is held until you send dir null. You walk about five tiles a second.', args: { dir: 'up | down | left | right | null', 'steps?': 'number of tiles (1 to 64)', walk: 'boolean, slower', run: 'boolean, quicker' } },
  dash: { doc: 'Dash ahead, if you have the skill.' },
  attack: { doc: 'The attack key, held (on true) or let go: a blow ahead of you, again each swing.', args: { on: 'boolean' } },
  primary: { doc: 'The left click: the held thing used on the aim, held to go on.', args: { on: 'boolean', 'tile?': '{x,y}: the cell aimed at; none is the cell in front' } },
  key: { doc: 'One press of a key at the aim: E is hands (take or handle what is there), G puts down, the right click (secondary) uses the held thing there.', args: { key: KEY, 'tile?': '{x,y}', 'layer?': 'number' } },
  keyOnItem: { doc: 'A key pressed on an item in the bag.', args: { key: KEY, item: 'item id' } },
  useItemOnHeldItem: { doc: 'Use an item of the bag on the held thing.', args: { instrument: 'item id', target: 'item id' } },
  select: { doc: 'Take the toolbar slot (0 to 9) into the hand.', args: { slot: 'number' } },
  cycle: { doc: 'The next (1) or previous (-1) occupied toolbar slot.', args: { dir: '1 | -1' } },
  row: { doc: 'The next (1) or previous (-1) row of the bag becomes the toolbar.', args: { dir: '1 | -1' } },
  swap: { doc: 'Swap two bag slots.', args: { a: 'number', b: 'number' } },
  quickMove: { doc: 'Move a stack between the toolbar and the rest of the bag.', args: { slot: 'number' } },
  drop: { doc: 'Drop a slot (all of it unless all is false).', args: { slot: 'number', 'all?': 'boolean' } },
  wear: { doc: 'Put on the item (from the bag), or take off the one in the slot named; none takes off the held thing.', args: { 'item?': 'item id', 'putOn?': 'boolean' } },
  craft: { doc: 'Make a recipe from what is carried (at a station if it needs one).', args: { id: 'recipe id', 'at?': 'station id' } },
  cast: { doc: 'Cast the skill in a slot of the skill bar (0 to 5).', args: { slot: 'number' } },
  toggle: { doc: 'Draw or sheathe the weapon, or sneak or stand.', args: { what: 'drawn | sneaking' } },
  transfer: { doc: 'With a container open: move one (or all of) an item between it and the bag.', args: { from: 'chest | bag', item: 'item id', 'all?': 'boolean' } },
  closePanel: { doc: 'Close the open container.' },
}

export const INPUT_DOCS: InputDoc[] = (Object.entries(DOCS) as [SeatInput['t'], Omit<InputDoc, 't'>][]).map(([t, d]) => ({ t, ...d }))
