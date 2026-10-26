import { test, expect } from '@playwright/test'

for (const [lang, title] of [['en', 'Down from the Mountain'], ['zh', '下山']] as const) {
  test(`bundled Fusion Pixel renders the ${lang} quest title and body`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Actual rendered fonts are inspected through Chromium CDP.')
    const fontResponse = page.waitForResponse(response => response.url().includes('fusion-pixel-12px-proportional-zh_hans') && response.url().endsWith('.woff2'))
    await page.goto(`/ui-lab.html?lang=${lang}&sample=quests`)
    const response = await fontResponse
    expect(response.ok()).toBe(true)
    expect(new URL(response.url()).origin).toBe(new URL(page.url()).origin)
    expect(response.headers()['content-type']).toContain('font/woff2')

    const loaded = await page.evaluate(async () => {
      const faces = await document.fonts.load('24px "Fusion Pixel"', '下山 Down from the Mountain')
      await document.fonts.ready
      return faces.map(face => ({ family: face.family, status: face.status }))
    })
    expect(loaded).toContainEqual({ family: 'Fusion Pixel', status: 'loaded' })
    await expect(page.locator('.ql-title')).toHaveText(title)
    await expect(page.locator('.ql-sum')).not.toBeEmpty()

    // A declared font-family or FontFaceSet.check alone can pass while glyphs use a fallback.
    // Inspect the fonts Chromium actually used to draw both the heading and the prose.
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument')
    for (const selector of ['.ql-title', '.ql-sum']) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector })
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
      expect(fonts.length, `${selector} must render text`).toBeGreaterThan(0)
      for (const font of fonts) {
        expect(font.familyName, `${selector} must not fall back to a system font`).toMatch(/^Fusion Pixel/)
        expect(font.isCustomFont).toBe(true)
        expect(font.glyphCount).toBeGreaterThan(0)
      }
    }
    await cdp.detach()
  })
}
