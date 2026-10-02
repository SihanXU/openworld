// Hunger (Minecraft's food bar) is data: any actor carrying `maxHunger` is a host of the
// `hunger` period (it grows hungrier) and of the `vitals` period (well fed, 90 % and up, it heals;
// starving, at 0, it loses health but never the last point). The base rules answer both; food
// restores hunger through the `restore` impulse. These are the clocks' paces.

/** One point of hunger every 300 ticks: a full bar (20) lasts ten game hours, ten minutes of play. */
export const HUNGER_EVERY = 300
/** Healing when well fed, and harm when starving, every this many ticks. */
export const HUNGER_EFFECT_EVERY = 80
