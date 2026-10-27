# Pixel UI components

The game's shared interface: its DOM components, their theme and layout rules, the component workshop and the
browser checks (built in PR #177). New panels are built from these components.

Run the game locally and open `http://127.0.0.1:5173/ui-lab.html` for the interactive component
workshop (`?lang=en` for English). The workshop runs without a world or model service, and is not
included in the production build. It includes inventory, journal, settings and trading examples,
all control states, nested confirmations, keyboard navigation, and screen-edge context menus.

The reusable DOM components live in `packages/runtime/src/ui/components/index.ts`. They receive
content and callbacks; game state and worker messages stay with their callers:

```ts
import { button, createWindow, element } from '@openworld/runtime/src/ui/components/index.ts'

const panel = createWindow({ title: '旅途日志', size: 'md' }, [
  element('p', '', ['渡口的守船人正在等你。']),
])
panel.footer.append(button({ label: '继续旅程', tone: 'primary', onClick: () => panel.hide() }))
panel.show()
// Keep the handle for reuse; call panel.destroy() when its owner is disposed.
```

`mountWindow(surface, { onClose, view, size })` adapts an existing panel without replacing its
business nodes, event handlers or data attributes. It builds fixed header/footer areas around a
scrollable body, remembers focus and scrolling across renders of the same `view`, and integrates
with the shared keyboard manager. Existing `PanelFactory`/`PanelContext` extensions remain valid;
an optional `GamePanel.hide()` releases transient work when a panel closes through any path.
Use `choiceTile({ label, artwork, selected, onClick })` for named item choices. Its separate
art and label rows keep long names aligned; `pixelArtwork()` trims transparent preview padding
and preserves sprite proportions in a 64×48 inset, without modifying the source used in the world.
The building palette in `ui/building.css` arranges these choices into three, two or one column
according to its available width and keeps its header outside the scrolling catalogue.
Use `confirmDialog()` for nested choices and `trackFloating()` for anchored popups; dispose the
tracking callback when its popup closes. `itemSlotHtml()` is the trusted-template adapter for
frame-rendered item grids; pass names and attributes separately, never interpolate player input
into its HTML content.

The theme has one ownership chain: `tokens.css` (palette, font aliases and dimensions),
`components.css` (shared chrome), and `layout.css` (game compositions and responsive behavior).
The honey-coloured wood frame uses an original nine-slice SVG (`ui/assets/window-frame.svg`);
shared icons use a 12×12 pixel grid instead of platform-dependent symbols. `creator.css` and
`cover.css` compose these controls into the portrait dresser and the two-page new-game flow.
Features, clothing and colours have separate tabs; moving between the traveller and journey
pages keeps the chosen appearance, difficulty and save slot. Only starting an occupied slot
asks for overwrite confirmation.
The older content-specific styles are in the lower-priority `legacy` layer. New panels should use
the shared components rather than adding another global override. Use 12px for compact metadata,
24px for window headings, and 48px for the cover title. The journal uses 16px/26px prose,
14px controls/section headings, and 12px metadata; `questlog.css` owns its reading layout.
All sizes use the bundled Fusion Pixel font declared in `styles.css`, without a font CDN.
The workshop renders the actual `QuestLog`, including long bilingual titles and objectives,
progress counts, locations, and completed/failed states.

Windows use 480/800/1120px maximum sizes, constrained by available space, with 24px outer margins
or 8px on narrow/short screens. Inventory reflows below an 880px content width; list/detail and
forms reflow below 720px. Keep item indices stable when columns change. Titles and window-level
actions remain visible while content scrolls. Tab height is measured; maps and skill trees measure
their own toolbars and preserve the point at the viewport centre during resize. Floating UI
uses the visible viewport, including its offset when the on-screen keyboard appears.

```bash
npx playwright install chromium            # once, unless using an existing Chromium
npm run test:ui                            # generates the world, then runs browser checks
```

For an existing browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable. The tests cover
Chinese and English at 1920×1080, 1366×768, 1024×768, 800×600, 844×390, 390×844 and 360×640,
continuous resize, font failure, nested dismissal/focus, and real game windows. The reduced
683×384 viewport also checks the layout space available at 200% zoom on a 1366×768 desktop;
it does not emulate a real browser zoom setting. Full phone gameplay controls are outside this UI change.

Visual references: [previous UI audit](figures/ui-audit/bag.jpg),
[character creation](figures/ui-system/creator-desktop.jpg),
[colour palettes](figures/ui-system/creator-palette.jpg),
[narrow character creation](figures/ui-system/creator-narrow.jpg),
[journey and saves](figures/ui-system/journey-desktop.jpg),
[current inventory](figures/ui-system/inventory-desktop.jpg),
[narrow inventory](figures/ui-system/inventory-narrow.jpg),
[narrow skill tree](figures/ui-system/skills-narrow.jpg),
[building choices](figures/ui-system/building-palette-en.png),
[the in-game journal](figures/ui-system/quest-typography-live-en.png),
and [narrow journal objectives](figures/ui-system/quest-typography-mobile-zh.png).
