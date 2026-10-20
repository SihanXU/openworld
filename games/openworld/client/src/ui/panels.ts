// OpenWorld's own panels (ClientGame.panels; packages/runtime/src/ui/panels.ts), by the key a rule's `panel` effect
// opens them with: the companion's (E on Lumi: `companion`, on the road; a woken waypoint statue: `boons`, on the
// seals' powers — one panel, opened by either key) and the Held Ground's widenings (its steward's talk: `haven`).
// Each is loaded when it is first opened, its styles with it: the game's worker and its tools, which read this game
// too (gen:world, the wiki), never load a panel's code.

import type { PanelFactory } from '@openworld/runtime/src/ui/panels.ts'

const companion: PanelFactory = async (ctx) => (await import('./companion.ts')).companionPanel(ctx)
const homestead: PanelFactory = async (ctx) => (await import('./homestead.ts')).homesteadPanel(ctx)
const bait: PanelFactory = async (ctx) => (await import('./bait.ts')).baitPanel(ctx)

export const PANELS: Record<string, PanelFactory> = { companion, boons: companion, haven: homestead, bait }
