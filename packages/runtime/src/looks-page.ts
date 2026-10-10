// The look maker (looks.html, dev): every person of the world in the character creator — their look as the game
// draws it, changed by hand, and copied as the pins for their file (tools/src/demo/people/<id>.ts).

import type { Look, WorldIndex } from '@lsw/engine'
import { PLAYER_LOOK } from '@lsw/content'
import { Creator } from './ui/creator.ts'
import { tx } from './ui/common.ts'
import './styles.css'
import './ui/game.css'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T

/** A look as the pins a person's file holds: every part (an empty slot as null) and every colour. */
function pins(look: Look): string {
  const slots = ['hair', 'face', 'beard', 'age', 'mark', 'glasses', 'hat', 'outfit']
  const parts = slots.map((s) => `${s}: ${look.parts[s] ? `'${look.parts[s]}'` : 'null'}`).join(', ')
  const colors = Object.entries(look.colors).map(([k, v]) => `${/^\w+$/.test(k) ? k : `'${k}'`}: '${v}'`).join(', ')
  return `look: { ${look.body === 'woman' || look.body === 'man' ? '' : `body: '${look.body}', `}parts: { ${parts} }, colors: { ${colors} } },`
}

async function main(): Promise<void> {
  const index = (await (await fetch('world/index.json')).json()) as WorldIndex
  const people: { id: string; name: string; look: Look }[] = [
    { id: 'player', name: 'player', look: PLAYER_LOOK },
    ...index.npcs.filter((n) => typeof n.look === 'object').map((n) => ({ id: n.id, name: `${tx(n.name ?? n.id)} (${n.id})`, look: n.look as Look })),
  ]
  const who = $<HTMLSelectElement>('lkWho')
  who.innerHTML = people.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')
  let creator: Creator | undefined
  const show = (look: Look) => ($('lkCode').textContent = pins(look))
  const pick = () => {
    creator?.dispose()
    const p = people[Number(who.value)]
    creator = new Creator($('lkCreator'), structuredClone(p.look), show)
    show(p.look)
  }
  who.onchange = pick
  $('lkCopy').onclick = async () => {
    await navigator.clipboard.writeText($('lkCode').textContent ?? '')
    $('lkOut').textContent = 'copied'
  }
  pick()
}

void main()
