import { test, expect, type Page } from '@playwright/test'

async function fits(page: Page): Promise<void> {
  const bounds = await page.locator('.cv-new').evaluate((surface) => {
    const rect = surface.getBoundingClientRect()
    const body = surface.querySelector<HTMLElement>('.ui-window-body')!
    const withinViewport = (selector: string) => {
      const box = surface.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight
    }
    return {
      windowFits: rect.left >= 7 && rect.top >= 7 && rect.right <= innerWidth - 7 && rect.bottom <= innerHeight - 7,
      contentFits: body.scrollWidth <= body.clientWidth + 1,
      closeVisible: withinViewport('#cvClose'),
      footerVisible: withinViewport('.ui-window-foot'),
      actionVisible: withinViewport('.cv-continue'),
    }
  })
  expect(bounds).toEqual({ windowFits: true, contentFits: true, closeVisible: true, footerVisible: true, actionVisible: true })
}

for (const lang of ['zh', 'en']) {
  test(`${lang}: character creation preserves choices through pages and responsive layouts`, async ({ page }) => {
    // Both pages and all categories in six sizes, with the real world rendering behind them.
    test.setTimeout(240_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      localStorage.setItem('lsw.model.skip', '1')
      localStorage.setItem('lsw.muted', '1')
    })
    await page.goto(`/?lang=${lang}&modder=off`)
    await page.locator('[data-item=new]').click()
    await page.evaluate(() => document.fonts.ready)

    const hair = page.locator('.cr-row').filter({ has: page.locator('[data-step=hair]') })
    const before = await hair.locator('.cr-val').textContent()
    await hair.locator('[data-by="1"]').click()
    await expect(hair.locator('.cr-val')).not.toHaveText(before!)
    const selectedHair = await hair.locator('.cr-val').textContent()
    await expect(hair.locator('[data-by="1"]')).toBeFocused()
    await page.locator('[data-cr-tab=appearance]').focus()
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-body]').first()).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(page.locator('[data-cr-tab=appearance]')).toBeFocused()
    await page.keyboard.press('End')
    await expect(page.locator('[data-cr-tab=palette]')).toBeFocused()
    await expect(page.locator('[data-cr-tab=palette]')).toHaveAttribute('aria-selected', 'true')
    const colour = page.locator('[data-key=hair]:not(.on)').first()
    const colourId = await colour.getAttribute('data-colour')
    await colour.click()
    await expect(page.locator(`[data-key=hair][data-colour="${colourId}"]`)).toHaveAttribute('aria-pressed', 'true')

    await page.locator('#cvNext').click()
    await expect(page.locator('[data-new-step=journey]')).toBeFocused()
    await page.locator('[data-diff=easy]').click()
    await page.locator('[data-pick-slot="2"]').click()
    await expect(page.locator('[data-act=new]')).toHaveAttribute('data-slot', '2')
    await page.locator('#cvBack').click()
    await expect(hair.locator('.cr-val')).toHaveText(selectedHair!)
    await page.locator('[data-cr-tab=palette]').click()
    await expect(page.locator(`[data-key=hair][data-colour="${colourId}"]`)).toHaveAttribute('aria-pressed', 'true')

    for (const [width, height] of [[1366, 768], [1024, 768], [800, 600], [390, 844], [360, 640], [844, 390]]) {
      await page.setViewportSize({ width, height })
      for (const category of ['appearance', 'clothing', 'palette']) {
        await page.locator(`[data-cr-tab=${category}]`).click()
        await fits(page)
      }
      await page.locator('#cvNext').click()
      await fits(page)
      await expect(page.locator('[data-diff=easy]')).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('[data-pick-slot="2"]')).toHaveAttribute('aria-pressed', 'true')
      await page.locator('#cvBack').click()
      await expect(hair.locator('.cr-val')).toHaveText(selectedHair!)
    }
    await page.keyboard.press('Escape')
    await expect(page.locator('.cv-new')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
