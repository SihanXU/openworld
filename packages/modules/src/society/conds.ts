// The society module's conditions (docs/npc-sandbox.md): regard, a grudge, whose a thing is, whom one knows, a
// deed seen, a sway, and the watch's ledger where the host is. Each reads the world's social mechanisms.

import { cmp, type CondImpl, type Roles, type View, type World } from '@openworld/engine'
import { socialIn } from './state.ts'

/** The watch of where the host is (a resident host: where the role is). */
const lawFor = (world: World, roles: Roles, role: View | undefined) => socialIn(world)?.lawAt(world.posOf(roles.host?.entity)?.map ?? world.posOf(role?.entity)?.map)

export const SOCIAL_CONDS: Record<string, CondImpl> = {
  regard: (c, roles, world) => {
    const social = socialIn(world)
    const of = roles[c.regard.of as keyof Roles]?.entity
    const to = roles[c.regard.toward as keyof Roles]
    return !!social && !!of && !!to && cmp(social.regard(of, to.ref.e), c.regard.cmp)
  },
  grudge: (c, roles, world) => {
    const social = socialIn(world)
    const to = roles[c.grudge.toward as keyof Roles]
    return !!social && !!to && !!social.grudge(roles[c.grudge.of as keyof Roles]?.entity, to.ref.e, c.grudge.deed)
  },
  owns: (c, roles, world) => {
    const social = socialIn(world)
    const [a, b] = (c.owns as string[]).map((r) => roles[r as keyof Roles]?.entity)
    return !!social && !!a && !!b && social.owns(a, b)
  },
  knows: (c, roles, world) => {
    const social = socialIn(world)
    const [a, b] = (c.knows as string[]).map((r) => roles[r as keyof Roles])
    return !!social && !!a?.entity && !!b && social.knows(a.entity, b.ref.e)
  },
  deed: (c, _roles, world, ev) => {
    const social = socialIn(world)
    const d = social && ev?.kind === 'seen' ? social.deedIn(ev) : undefined
    return !!d && (c.deed === true || d.id === c.deed)
  },
  sway: (c, roles, world) => {
    const social = socialIn(world)
    const of = roles[c.sway.of as keyof Roles]?.entity
    const by = roles[c.sway.by as keyof Roles]?.entity
    return !!social && !!of && !!by && social.sway(of, by, c.sway.how, c.sway.bonus ?? 0)
  },
  bounty: (c, roles, world) => {
    const social = socialIn(world)
    const v = roles[c.bounty.role as keyof Roles]
    return !!social && !!v && cmp(social.bounty(lawFor(world, roles, v)?.id, v.ref.e), c.bounty.cmp)
  },
  canPay: (c, roles, world) => {
    const social = socialIn(world)
    const v = roles[c.canPay.role as keyof Roles]
    const b = social && v ? social.bounty(lawFor(world, roles, v)?.id, v.ref.e) : 0
    return !!social && !!v?.entity && b > 0 && social.purse(v.entity) >= Math.round(b * (c.canPay.mul ?? 1))
  },
  unpardonable: (c, roles, world) => {
    const social = socialIn(world)
    const v = roles[c.unpardonable as keyof Roles]
    const law = lawFor(world, roles, v)
    return !!social && !!v && social.unpardonable(law, social.bounty(law?.id, v.ref.e))
  },
}
