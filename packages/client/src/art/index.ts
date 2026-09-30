// Procedural pixel-art module for Large Symbolic World. No image assets: every texture is
// painted onto canvases here. Pure TypeScript + Canvas 2D (no Phaser dependency); the client
// registers the returned canvases/frames as Phaser textures.
//
//   terrainSheet    16x16 tiles, `${terrainId}#${variant}` (+ `#anim0/#anim1` for liquids),
//                   laid out row-major on a strict 16px grid with each terrain's variants on
//                   consecutive tile indices.
//   characterSheet  16x16, 3 cols (stand, stepA, stepB) x 4 rows (down, left, right, up)
//   creatureSheet   16x16, idle0/idle1 (+ left/right/down/up aliases)
//   fixtureSheet    16x16 or 16x32: base / open / lit
//   iconSheet       16x16 'icon'
//   overlaySheet    16x16 animated f0…
//   particleSheet   ≤8x8 particles

export type { Sheet, Frame } from './core.ts'
export { terrainSheet } from './terrain.ts'
export { characterSheet, SKIN_TONES, HAIR_COLORS, CLOTH_COLORS, HAIR_STYLE_COUNT } from './characters.ts'
export { creatureSheet, CREATURE_KINDS } from './creatures.ts'
export { fixtureSheet, FIXTURE_KEYS } from './fixtures.ts'
export { iconSheet, ICON_KEYS } from './icons.ts'
export { overlaySheet, particleSheet, OVERLAY_KEYS, PARTICLE_KEYS } from './effects.ts'
export { ELEMENT_COLORS } from './core.ts'
