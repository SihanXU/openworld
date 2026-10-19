// The world filter (docs/looks.md §8): one shader pass over the world camera that brings the pixel-art map into the
// portraits' style — the colours graded toward the game's duotone (its ink in the shadows, its paper in the lights,
// the bright greens taken toward a sage), the art's own dark outlines turned to the ink, a paper's grain and a
// vignette, and hatching where it is dark (stronger at night). What a game's look is comes from the game
// (`ClientGame.worldFilter`); how strong is the player's (the options: off, light, full).
//
// The pass runs at the screen's pixels, but the outlines and the hatching are judged at the world's own pixels (the
// camera's zoom), and the paper and the hatching are anchored to the world, so they move with it and never swim.
// What must be read in a fight — the cells a blow is about to fall on — is drawn by a second camera above the pass
// (`signalCamera`), never filtered.

import Phaser from 'phaser'
import type { WorldFilterDef, WorldFilterParams } from '../game.ts'

const NODE = 'FilterWorldLook'

const FRAG = `#pragma phaserTemplate(shaderName)
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uZoom;
uniform vec2 uView;
uniform vec3 uInk;
uniform vec3 uCream;
uniform vec4 uGrade;
uniform vec4 uLook;
uniform vec2 uDark;
varying vec2 outTexCoord;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec4 src = texture2D(uMainSampler, outTexCoord);
  vec3 c = src.rgb;
  float l = luma(c);

  // the grade: desaturated (the yellow-greens further, toward a sage), a little warmer, the colour toned toward the
  // duotone (not the lightness), an S-curve so it stays crisp, and nothing darker than the ink
  float greenish = clamp((c.g - max(c.r, c.b)) * 255.0 / 60.0, 0.0, 1.0) * step(c.b, c.g);
  vec3 g = mix(c, vec3(l), clamp(uGrade.x + uGrade.y * greenish, 0.0, 1.0));
  g *= 1.0 + uGrade.w * vec3(0.02, 0.0, -0.05);
  vec3 duo = mix(uInk, uCream, clamp(l, 0.0, 1.0));
  g *= mix(vec3(1.0), duo / max(luma(duo), 1.0 / 255.0), uGrade.z);
  g = clamp(g, 0.0, 1.0);
  g = mix(g, g * g * (3.0 - 2.0 * g), uLook.x);
  g = max(g, uInk * 0.7);

  // the ink: the art's dark outlines, judged against the world pixels round them
  vec2 px = uZoom / uResolution;
  float n = max(
    max(luma(texture2D(uMainSampler, outTexCoord + vec2(px.x, 0.0)).rgb), luma(texture2D(uMainSampler, outTexCoord - vec2(px.x, 0.0)).rgb)),
    max(luma(texture2D(uMainSampler, outTexCoord + vec2(0.0, px.y)).rgb), luma(texture2D(uMainSampler, outTexCoord - vec2(0.0, px.y)).rgb)));
  if (l < 0.32 && n - l > 0.18) g = mix(g, uInk, uLook.y);

  // where on the world this is (the texture's y runs up, the world's down)
  vec2 screen = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * uResolution;
  vec2 world = uView + screen / uZoom;
  vec2 cell = floor(world + 0.001);

  // hatching where it is dark: a diagonal line on every third world pixel, more of it at night
  float dark = clamp((0.42 - luma(g)) / 0.25, 0.0, 1.0) * mix(0.55, 1.0, uDark.y);
  float line = step(mod(cell.x + cell.y, 3.0), 0.5);
  g = mix(g, uInk, line * dark * 0.35 * uDark.x);

  // the paper: mottling and fibres, anchored to the world at the screen's scale
  vec2 wp = world * uZoom;
  float mott = noise(wp / 36.0) * 2.0 - 1.0;
  float fib = noise(vec2(wp.x / 1.2, wp.y / 6.0)) * 2.0 - 1.0;
  g *= 1.0 + uLook.z * (0.035 * mott + 0.02 * fib);

  // the vignette, toward the ink
  vec2 q = (screen / uResolution - 0.5) * 2.0;
  g = mix(g, uInk, clamp((length(q) - 0.55) / 0.6, 0.0, 1.0) * uLook.w);

  gl_FragColor = vec4(g, src.a);
}
`

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** The filter on a camera: its look (the game's), its strength (the player's) and where the camera is (the scene's). */
export interface WorldFilter extends Phaser.Filters.Controller {
  params: WorldFilterParams
  ink: [number, number, number]
  cream: [number, number, number]
  zoom: number
  view: { x: number; y: number }
  /** How dark the hour is (0 day, 1 deep night): the hatching grows with it. */
  dark: number
}

// the controller and its render node, made the first time a filter is installed (a page with no WebGL, and the
// tests' stand-in for Phaser, never make them)
let made: { Controller: new (camera: Phaser.Cameras.Scene2D.Camera, def: WorldFilterDef, params: WorldFilterParams) => WorldFilter; Node: Function } | undefined
function classes(): NonNullable<typeof made> {
  if (made) return made
  class Controller extends Phaser.Filters.Controller {
    params: WorldFilterParams
    ink: [number, number, number]
    cream: [number, number, number]
    zoom = 1
    view = { x: 0, y: 0 }
    dark = 0
    constructor(camera: Phaser.Cameras.Scene2D.Camera, def: WorldFilterDef, params: WorldFilterParams) {
      super(camera, NODE)
      this.params = params
      this.ink = rgb(def.ink)
      this.cream = rgb(def.paper)
    }
  }
  class Node extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
    constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
      super(NODE, manager, undefined, FRAG)
    }

    setupUniforms(controller: Phaser.Filters.Controller, ctx: Phaser.Renderer.WebGL.DrawingContext): void {
      const f = controller as WorldFilter
      const p = f.params
      const pm = this.programManager
      pm.setUniform('uResolution', [ctx.width, ctx.height])
      pm.setUniform('uZoom', f.zoom)
      pm.setUniform('uView', [f.view.x, f.view.y])
      pm.setUniform('uInk', f.ink)
      pm.setUniform('uCream', f.cream)
      pm.setUniform('uGrade', [p.desat, p.sage, p.tone, p.warm])
      pm.setUniform('uLook', [p.contrast, p.ink, p.paper, p.vignette])
      pm.setUniform('uDark', [p.hatch, f.dark])
    }
  }
  made = { Controller, Node }
  return made
}

/** The filter on a scene's main camera (a WebGL renderer only: the canvas renderer draws the art as it is). */
export function installWorldFilter(scene: Phaser.Scene, def: WorldFilterDef, params: WorldFilterParams): WorldFilter | undefined {
  const r = scene.renderer
  if (!(r instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return undefined
  const { Controller, Node } = classes()
  const nodes = r.renderNodes as unknown as { _nodeConstructors: Record<string, unknown> }
  if (!nodes._nodeConstructors[NODE]) r.renderNodes.addNodeConstructor(NODE, Node)
  const cam = scene.cameras.main
  const f = new Controller(cam, def, params)
  cam.filters.internal.add(f)
  return f
}

/**
 * A camera over the main one that draws only what must stay legible under the filter (the cells a blow will fall
 * on): every object the scene adds is ignored by it unless marked, and it follows the main camera exactly (copied
 * after the main camera has moved, each frame; `onMoved` is told then too, so the filter knows where the camera is).
 */
export function signalCamera(scene: Phaser.Scene, onMoved?: (main: Phaser.Cameras.Scene2D.Camera) => void): { camera: Phaser.Cameras.Scene2D.Camera; mark(o: Phaser.GameObjects.GameObject): void } {
  const main = scene.cameras.main
  const cam = scene.cameras.add(0, 0, main.width, main.height).setName('signals').setRoundPixels(true)
  const marked = new Set<Phaser.GameObjects.GameObject>()
  for (const o of scene.children.list) cam.ignore(o)
  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, (o: Phaser.GameObjects.GameObject) => {
    if (!marked.has(o)) cam.ignore(o)
  })
  const pre = main.preRender.bind(main)
  main.preRender = () => {
    pre()
    if (cam.width !== main.width || cam.height !== main.height) cam.setSize(main.width, main.height)
    cam.zoom = main.zoom
    cam.scrollX = main.scrollX
    cam.scrollY = main.scrollY
    onMoved?.(main)
  }
  return {
    camera: cam,
    mark(o) {
      marked.add(o)
      // drawn by the signal camera only (a bit set is a camera that ignores it)
      ;(o as unknown as { cameraFilter: number }).cameraFilter = (o as unknown as { cameraFilter: number }).cameraFilter & ~cam.id
      main.ignore(o)
    },
  }
}
