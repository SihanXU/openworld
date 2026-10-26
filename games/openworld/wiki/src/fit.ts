// How big a picture is drawn in a box of the page (templates.ts `fit`): kept apart so it is tested without the game.

/**
 * The scale that fits a picture of `w` × `h` into a box of `box` pixels, never past it: a painted one (`smooth`) fills it; pixels go by
 * halves (8 at most) where one fits, so they stay even, and are shrunk to the box only where not even half their size does.
 */
export function fitScale(s: { w: number; h: number; smooth?: boolean }, box: number): number {
  const room = box / Math.max(s.w, s.h)
  if (s.smooth) return room
  const halves = Math.min(8, Math.floor(room * 2) / 2)
  return halves >= 0.5 ? halves : room
}
