import { test, expect, type Page } from '@playwright/test'

const sizes = [[1920,1080],[1366,768],[1024,768],[800,600],[844,390],[390,844],[360,640]] as const
const samples = ['bag','quests','settings','trade','components']

async function fonts(page: Page): Promise<void> { await page.evaluate(() => document.fonts.ready) }
async function fits(page: Page): Promise<void> {
  const dimensions = await page.locator('#sample-window').evaluate((node) => {
    const box = node.getBoundingClientRect()
    const body = node.querySelector<HTMLElement>('.ui-window-body')!
    const close = node.querySelector<HTMLElement>('.ui-window-head button')!.getBoundingClientRect()
    const foot = node.querySelector<HTMLElement>('.ui-window-foot')!
    const footer = foot.children.length ? foot.getBoundingClientRect() : undefined
    return { x:box.x, y:box.y, right:box.right, bottom:box.bottom, width:innerWidth,height:innerHeight, pageWidth:document.documentElement.scrollWidth, bodyWidth:body.clientWidth,bodyScrollWidth:body.scrollWidth, closeBottom:close.bottom, footerBottom:footer?.bottom }
  })
  expect(dimensions.x).toBeGreaterThanOrEqual(7)
  expect(dimensions.y).toBeGreaterThanOrEqual(7)
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.width - 7)
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.height - 7)
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.width)
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.bodyWidth + 1)
  expect(dimensions.closeBottom).toBeLessThan(dimensions.height)
  if (dimensions.footerBottom) expect(dimensions.footerBottom).toBeLessThan(dimensions.height)
}

for (const [width,height] of sizes) for (const lang of ['zh','en']) {
  test(`${lang}: all sample windows at ${width}×${height}`, async ({page}) => {
    await page.setViewportSize({width,height})
    await page.goto(`/ui-lab.html?lang=${lang}`)
    await fonts(page)
    for (const sample of samples) {
      await page.locator(`[data-sample='${sample}']`).click()
      await expect(page.locator('#sample-window')).toBeVisible()
      await fits(page)
      await page.locator('.ui-window-body').evaluate((node) => { node.scrollTop = node.scrollHeight })
      await fits(page)
      await page.keyboard.press('Escape')
      await expect(page.locator('#sample-window')).toHaveCount(0)
      await expect(page.locator(`[data-sample='${sample}']`)).toBeFocused()
    }
  })
}

test('confirmation and context menu consume Escape before their owner; focus returns', async ({page}) => {
  await page.goto('/ui-lab.html?lang=en')
  await page.getByRole('button',{name:'Components',exact:false}).click()
  await page.getByRole('button',{name:'Open a confirmation',exact:true}).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.locator('#sample-window')).toBeVisible()
  await expect(page.getByRole('button',{name:'Open a confirmation',exact:true})).toBeFocused()
  await page.getByRole('button',{name:'Open an edge menu'}).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const box = await menu.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(8)
  expect(box!.y+box!.height).toBeLessThanOrEqual(720-7)
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('button').nth(1)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(page.locator('#sample-window')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#sample-window')).toHaveCount(0)
})

test('real resize preserves text, selection, scroll access and slot order', async ({page}) => {
  await page.goto('/ui-lab.html?lang=en&sample=settings')
  await page.getByLabel('Traveller’s name',{exact:true}).fill('A long name that must survive resize')
  for (const width of [1200,1024,881,880,879,721,720,719,480,390,360]) {
    await page.setViewportSize({width,height:640})
    await fonts(page)
    await fits(page)
    await expect(page.getByLabel('Traveller’s name',{exact:true})).toHaveValue('A long name that must survive resize')
  }
  await page.keyboard.press('Escape')
  await page.locator('[data-sample=bag]').click()
  await page.locator('.ui-slot').nth(7).click()
  await page.setViewportSize({width:1366,height:768})
  await expect(page.locator('.ui-slot.sel')).toHaveAttribute('data-index','7')
  expect(await page.locator('.ui-slot').evaluateAll((nodes) => nodes.map((n)=>(n as HTMLElement).dataset.index))).toEqual(Array.from({length:30},(_,i)=>String(i)))
})

test('confirmation traps focus above visible game tabs and restores its owner', async ({page}) => {
  await page.goto('/ui-lab.html?lang=en&sample=components')
  await page.evaluate(() => {
    const tabs = document.createElement('div')
    tabs.className = 'panel-tabs'
    const button = document.createElement('button')
    button.id = 'underlying-panel-tab'
    button.textContent = 'Switch underlying panel'
    button.onclick = () => { tabs.dataset.activated = 'true' }
    tabs.append(button)
    document.body.append(tabs)
  })
  await page.locator('#underlying-panel-tab').focus()
  await page.getByRole('button',{name:'Open a confirmation',exact:true}).evaluate(button => button.click())
  const confirmation = page.getByRole('alertdialog')
  await expect(confirmation).toBeVisible()
  expect(await confirmation.evaluate(node => node.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(confirmation).toHaveCount(0)
  await expect(page.locator('#sample-window button').first()).toBeFocused()

  await page.getByRole('button',{name:'Open a confirmation',exact:true}).click()
  for (const key of ['Tab','Tab','Tab','Tab','Shift+Tab','Shift+Tab','Shift+Tab','Shift+Tab']) {
    await page.keyboard.press(key)
    expect(await confirmation.evaluate(node => node.contains(document.activeElement))).toBe(true)
  }
  await expect(page.locator('.panel-tabs')).not.toHaveAttribute('data-activated','true')
  await expect(page.locator('#sample-window')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(confirmation).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Open a confirmation',exact:true})).toBeFocused()

  // Ordinary game windows still include the navigation tabs in their keyboard cycle.
  await page.locator('#sample-window').evaluate(node => {
    const controls = [...node.querySelectorAll<HTMLElement>('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
      .filter(control => control.tabIndex >= 0 && control.getClientRects().length > 0)
    controls.at(-1)!.focus({preventScroll:true})
  })
  await page.keyboard.press('Tab')
  await expect(page.locator('#underlying-panel-tab')).toBeFocused()
})

test('keyboard focus stays inside the active window and tab navigation works', async ({page}) => {
  await page.goto('/ui-lab.html?lang=en&sample=components')
  for (let i=0;i<16;i++) {
    await page.keyboard.press(i%3 ? 'Tab' : 'Shift+Tab')
    expect(await page.evaluate(()=>!!document.activeElement?.closest('#sample-window'))).toBe(true)
  }
  await page.getByRole('tab',{name:'All',exact:true}).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab',{name:'Available',exact:true})).toHaveAttribute('aria-selected','true')
})

test('font fallback and 200% effective zoom retain usable layout', async ({page}) => {
  await page.route('**/*.woff2',route=>route.abort())
  await page.setViewportSize({width:683,height:384})
  await page.goto('/ui-lab.html?lang=zh&sample=quests')
  await fits(page)
  await page.locator('.ui-window-body').evaluate((node)=>{node.scrollTop=node.scrollHeight})
  await expect(page.locator('.ui-window-head button')).toBeInViewport()
})
