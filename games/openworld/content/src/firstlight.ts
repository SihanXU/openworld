// Shared authored coordinates. Keep the old meadow map id for portals and saves.
export const FIRSTLIGHT = {
  map: 'meadow',
  name: { en: 'Firstlight Village', zh: '初原村' },
  cart: [30, 15] as const,
  cartStand: [31, 15] as const,
  tobinStand: [30, 17] as const,
  fire: [22, 17] as const,
  well: [21, 14] as const,
  /** the warm spring west of the pond: soaking in it mends */
  spring: [9, 21] as const,
  garden: { map: 'meadow', x: 26, y: 22, width: 4, height: 4, supplies: [31, 23] as const },
  /**
   * The grounds where the fairy's guides begin (quests/guides.ts): the pond's banks south of the square, and the garden
   * with its supplies crate — regions of the map (`meadow:pond`, `meadow:garden`), as [x, y, width, height].
   */
  regions: { pond: [13, 19, 8, 6] as const, garden: [25, 21, 8, 6] as const },
}

export const FIRSTLIGHT_LAYOUT = 'content.firstlight-layout-v1'
