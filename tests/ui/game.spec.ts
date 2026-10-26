import { test, expect, type Page } from '@playwright/test'

type DevGame = { lsw: { frame?: { player: unknown }; menu: { close():void; open(tab:string):void; openPanel(key:string,by?:string):boolean; toggleQuests():void; openJournal():void; toggleSkillPanel():void; toggleSkills():void; toggleMap():void } } }
async function start(page:Page):Promise<void> {
  await page.addInitScript(()=>{localStorage.setItem('lsw.model.skip','1');localStorage.setItem('lsw.muted','1')})
  await page.goto('/?lang=zh&modder=off')
  await page.locator('[data-item=new]').click()
  await page.locator('#cvNext').click()
  await page.locator('[data-act=new]').first().click()
  await page.waitForFunction(()=>!!(window as unknown as DevGame).lsw?.frame?.player)
}

test('real game windows, navigation and HUD fit desktop, narrow and short viewports',async({page})=>{
  test.setTimeout(120_000)
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await start(page)
  for(const [width,height] of [[1366,768],[390,844],[844,390]]){
    await page.setViewportSize({width,height})
    for(const name of ['inventory','craft','options','quests','journal','skillPanel','skills','map']){
      await page.evaluate((name)=>{
        const menu=(window as unknown as DevGame).lsw.menu
        menu.close()
        if(['inventory','craft','options'].includes(name))menu.open(name)
        else if(name==='quests')menu.toggleQuests()
        else if(name==='journal')menu.openJournal()
        else if(name==='skillPanel')menu.toggleSkillPanel()
        else if(name==='skills')menu.toggleSkills()
        else menu.toggleMap()
      },name)
      await page.waitForTimeout(150)
      const active=page.locator('.overlay:not(.hidden) .ui-window,.ui-canvas-window:not(.hidden)').first()
      await expect(active).toBeVisible()
      const box=await active.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.x+box!.width).toBeLessThanOrEqual(width+1)
      expect(box!.y+box!.height).toBeLessThanOrEqual(height+1)
      const scroll=active.locator('.ui-window-body')
      if(await scroll.count()){
        expect(await scroll.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true)
        await scroll.evaluate(node=>{node.scrollTop=node.scrollHeight})
        await expect(active.locator('.ui-window-head .x')).toBeInViewport()
      }
      if(name==='skills'||name==='map') await expect(page.locator(name==='skills'?'#skClose':'#wmClose')).toBeInViewport()
      await page.keyboard.press('Escape')
      await expect(active).toBeHidden()
    }
    const bounds=await page.locator('#minimap,#clockbox,#corner,#hotbar').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom}}))
    for(const rect of bounds){expect(rect.x).toBeGreaterThanOrEqual(-1);expect(rect.right).toBeLessThanOrEqual(width+1);expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.bottom).toBeLessThanOrEqual(height+1)}
  }
  expect(errors).toEqual([])
})

test('title settings preserve the close button and text inputs across resize',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('lsw.model.skip','1'))
  await page.goto('/?lang=zh&modder=off')
  await page.locator('[data-item=settings]').click()
  await page.setViewportSize({width:360,height:640})
  const surface=page.locator('.cv-panel')
  await expect(surface).toBeVisible()
  await surface.locator('.ui-window-body').evaluate(n=>{n.scrollTop=n.scrollHeight})
  await expect(page.locator('#cvClose')).toBeInViewport()
  expect(await surface.evaluate(n=>{const b=n.getBoundingClientRect();return b.left>=7&&b.right<=innerWidth-7})).toBe(true)
  await page.keyboard.press('Escape')
  await expect(surface).toHaveCount(0)
})

test('game-owned companion and homestead panels reflow within their content container',async({page})=>{
  test.setTimeout(90_000)
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await start(page)
  for(const [width,height]of [[1366,768],[390,844]]){
    await page.setViewportSize({width,height})
    for(const key of ['companion','haven']){
      await page.evaluate(key=>(window as unknown as DevGame).lsw.menu.openPanel(key,'npc.alberic'),key)
      const surface=page.locator(`.overlay:not(.hidden) .${key==='companion'?'lm':'hs'}-sheet`)
      await expect(surface).toBeVisible()
      const body=surface.locator('.ui-window-body')
      expect(await body.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true)
      const box=await surface.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x+box!.width).toBeLessThanOrEqual(width)
      await body.evaluate(node=>{node.scrollTop=node.scrollHeight})
      await expect(surface.locator('.ui-window-head [data-close]')).toBeInViewport()
      await page.keyboard.press('Escape')
      await expect(surface).toBeHidden()
    }
  }
  expect(errors).toEqual([])
})
