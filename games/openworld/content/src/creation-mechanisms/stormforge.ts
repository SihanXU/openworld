// Stormforge: a fire-thunder fusion blade. Trusted source module; save-local plans stay data.
import type {
  Effect,
  Text,
  WorkshopCapability,
  WorkshopCapabilityBuild,
  WorkshopCapabilityContext,
  WorkshopCapabilityObservation,
  WorkshopMechanismProvider,
} from '@openworld/engine'

const L = (en: string, zh: string): Text => ({ en, zh })

const stormfused = (ctx: { packageId: string; revision: number }): string =>
  `creation_${ctx.packageId}_r${ctx.revision}_stormfused`

const bolt = (element: 'fire' | 'lightning', power: number): Effect => ({
  op: 'emit', impulse: 'strike', to: 'target', params: { power, element, edge: 'magic' },
})

const stormfuseCapability: WorkshopCapability = {
  equipped: true,
  descriptor: {
    id: 'stormfuse',
    version: 1,
    label: L('Fuse fire and thunder', '火雷融合'),
    description: L('Switch this blade between its single-element and fused fire-thunder states.', '让这把剑在单元素与火雷融合状态之间切换。'),
    targets: ['self'],
    params: { mode: { type: 'string', enum: ['fuse', 'split'], default: 'fuse' } },
  },
  compile(ctx: WorkshopCapabilityContext): WorkshopCapabilityBuild {
    const status = stormfused(ctx)
    const fused = String(ctx.params.mode ?? 'fuse') === 'fuse'
    return {
      effects: [{ op: 'emit', impulse: 'coat', to: 'actor', params: { ...ctx.signal } }],
      receiver: {
        host: { type: 'actor' },
        effects: fused
          ? [
              { op: 'addStatus', status, duration: 600 },
              { op: 'vfx', fx: 'burst:arcane:1' },
              { op: 'log', text: L('Fire and thunder fuse within you.', '火与雷在你体内融合。') },
            ]
          : [
              { op: 'removeStatus', status },
              { op: 'vfx', fx: 'burst:arcane:1' },
              { op: 'log', text: L('The elements part again.', '火与雷再度分离。') },
            ],
      },
      ...(fused && { statuses: [{ id: status, name: L('Stormfused', '雷火融合'), overlay: 'spark' }] }),
    }
  },
  verify(o: WorkshopCapabilityObservation): string[] {
    const errors: string[] = []
    const statuses = (o.after.statuses as string[]) ?? []
    const fused = String(o.use.params?.mode ?? 'fuse') === 'fuse'
    const active = statuses.some((s) => String(s).includes('stormfused'))
    if (fused && !active) errors.push('The fire-thunder fusion state did not take effect on the actor')
    if (!fused && active) errors.push('Splitting left the fusion state active')
    return errors
  },
}

const stormstrikeCapability: WorkshopCapability = {
  equipped: true,
  descriptor: {
    id: 'stormstrike',
    version: 1,
    label: L('Storm strike', '雷火斩'),
    description: L('Strike a creature with fire, or fire and lightning together while fused.', '以火攻击目标；融合状态下同时打出火与雷。'),
    targets: ['person', 'creature'],
    params: { power: { type: 'number', min: 1, max: 5, default: 3 } },
  },
  compile(ctx: WorkshopCapabilityContext): WorkshopCapabilityBuild {
    const status = stormfused(ctx)
    const power = Number(ctx.params.power ?? 3)
    return {
      effects: [bolt('fire', power)],
      empowered: { status, effects: [bolt('fire', power), bolt('lightning', power)] },
    }
  },
  verify(o: WorkshopCapabilityObservation): string[] {
    const errors: string[] = []
    if (o.after.targetExists && Number(o.after.hp) >= Number(o.before.hp)) errors.push('The storm strike did not damage its target')
    if (!o.trace.some((t) => t.kind === 'impulse/element' && t.element === 'fire')) errors.push('The single-element strike did not release fire')
    return errors
  },
}

const provider: WorkshopMechanismProvider = {
  id: 'stormforge',
  version: 1,
  capabilities: [stormfuseCapability, stormstrikeCapability],
}

export default provider
