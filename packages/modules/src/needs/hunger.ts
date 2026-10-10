// Hunger (Minecraft's food bar) is data: any actor carrying `maxHunger` is a host of the
// `hunger` period (it grows hungrier) and of the `vitals` period (well fed, 90 % and up, it heals;
// starving, at 0, it loses health but never the last point). The base rules answer both; food
// restores hunger through the `restore` impulse. These are the clocks' paces.
//
// It falls in two paces, as a body does: fed, the bar drops from full to six tenths between meals
// (a meal, 8, fills it again: two or three a day); under six tenths one is `hungry` and it falls
// slowly — a body goes days without food — so full to empty takes about three days.

/** Fed, one point every 480 ticks (48 game minutes): full (20) to six tenths (12) in about six and a half game hours, a meal's span. */
export const HUNGER_EVERY = 480
/** Hungry (under six tenths), the hunger period comes this many times slower: a point every six game hours, six tenths to none in three days. */
export const HUNGRY_PACE = 7.5
/** The line under which one is hungry: this share of maxHunger. */
export const HUNGRY_BELOW = 0.6
/** Healing when well fed, and harm when starving, every this many ticks. */
export const HUNGER_EFFECT_EVERY = 80
