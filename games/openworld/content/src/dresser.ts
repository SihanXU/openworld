// The dresser (docs/looks.md §5): a person tagged `dresser` who changes how the traveller looks, for a price
// (`params.restyle`: coin and wildflowers), and her standing mirror. Asked (the talk verb `restyle`), or a hand
// on the mirror, she opens the restyle panel — the character creator over one's own look; the runtime takes the
// price and sets the look (`own`), so the world's design never replaces it again.

import type { Effect, Rule, Text, Tree } from '@openworld/engine'

const L = (en: string, zh: string): Text => ({ en, zh })
const say = (en: string, zh: string): Effect => ({ op: 'say', text: { en, zh } })
const rule = (r: Rule): Rule => r

/** The talk verb that opens her panel. */
export const RESTYLE_VERB = 'restyle'

const DRESSER_TALK: Tree = {
  if: { same: ['host', 'actor'] },
  then: 'inherit',
  else: {
    if: { param: { key: 'say', cmp: RESTYLE_VERB } },
    then: { do: [say("Sit down, then. Let's see what we can do with you.", '坐下吧。让我看看能给你做点什么。'), { op: 'panel', panel: 'restyle' }] },
    else: 'inherit',
  },
}

export const DRESSER_RULES: Rule[] = [
  rule({
    id: 'dresser/talk',
    label: L('Talk to {target}', '和{target}说话'),
    doc: 'The dresser (a person tagged dresser), asked to change one\'s look (the talk verb restyle): her panel opens — the character creator over one\'s own look, for the price params.restyle names (coin and wildflowers), taken when the new look is kept. Anything else said, as to anyone.',
    host: { type: 'actor/person', tags: ['dresser'] },
    on: 'impulse/handle',
    tree: DRESSER_TALK,
  }),
  rule({
    id: 'dresser/mirror',
    label: L('Look in {target}', '照{target}'),
    doc: 'A hand on a standing mirror: one looks oneself over, and the restyle panel opens (the dresser\'s price holds, whether she is beside it or not).',
    host: { type: 'fixture/furniture/mirror' },
    on: 'impulse/handle',
    tree: { do: [{ op: 'log', text: L('You look yourself over in the glass.', '你对着镜子打量自己。') }, { op: 'panel', panel: 'restyle' }] },
  }),
]
