// Supplies a finite experimentation kit only in the explicitly selected creator start.
import type { Game, Recipe } from '@openworld/engine'
export function prepareCreator(game: Game, recipes: Recipe[]): void {
  const eng = game.engine, w = eng.world, p = w.player
  if (w.prop(p, 'creativeWorkshop') !== true) return
  eng.author(() => {
    const kinds = ['item/material/stone', 'item/material/log', 'item/material/stick', 'item/material/plank', 'item/material/grass', 'item/material/cloth', 'item/material/leather', 'item/material/iron_ingot', 'item/material/steel_bar', 'item/food/berries', 'item/food/bread', 'item/tool/smith_hammer', 'item/weapon/blade/axe']
    for (const type of kinds) if (w.onto.data.types[type]) for (let n = 0; n < (type.startsWith('item/material/') || type.endsWith('berries') ? 20 : 3); n++) w.add({ id: `creator.${type.replaceAll('/', '_')}.${n}`, type, place: { on: 'inside', holder: p.id } })
    for (const r of recipes) {
      if (r.skill) w.addTag(p, `skill:${r.skill}`)
      if (r.unlockedBy && w.story) w.setProp(w.story, r.unlockedBy.fact, Math.max(w.num(w.story, r.unlockedBy.fact, 0), r.unlockedBy.level ?? 1))
    }
  })
}
