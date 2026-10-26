// The project page: its two languages, the pieces' films playing round and round while they are in view, the steps a
// chapter of their film, the waitlist, the bar's look over what it is on.
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ------------------------------------------------------------------ English or Chinese
// The words are written in English with their Chinese beside them (data-zh, data-zh-title, data-href-zh). The language
// is the one asked (?lang=), else the one chosen here before, else the browser's.
const META = {
    en: { title: 'OpenWorld', description: 'OpenWorld: a world whose rules are code. What the world has never seen, it learns and remembers.' },
    zh: { title: 'OpenWorld · 一个规则即代码的世界', description: 'OpenWorld：一个规则即代码的世界。这个世界从没见过的事，它会学会，并且记住。' },
}
const stored = (() => { try { return localStorage.getItem('openworld.lang') } catch { return null } })()
const asked = new URLSearchParams(location.search).get('lang')
let lang = ['en', 'zh'].includes(asked) ? asked : ['en', 'zh'].includes(stored) ? stored : (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'
/** A piece's address in the page's language. */
const inLang = (src) => `${src}${src.includes('?') ? '&' : '?'}lang=${lang}`
function setLang(to, chosen = false) {
    lang = to
    document.documentElement.lang = to
    document.title = META[to].title
    document.querySelector('meta[name="description"]')?.setAttribute('content', META[to].description)
    for (const el of document.querySelectorAll('[data-zh]')) {
        if (el.dataset.en === undefined) el.dataset.en = el.textContent
        el.textContent = to === 'zh' ? el.dataset.zh : el.dataset.en
        // Only the authored headline phrases are grouped; all other copy stays plain text.
        if (to === 'zh' && el.dataset.zhKeep) {
            let rest = el.dataset.zh
            const parts = []
            for (const phrase of el.dataset.zhKeep.split('|')) {
                const at = rest.indexOf(phrase)
                if (!phrase || at < 0) continue
                parts.push(document.createTextNode(rest.slice(0, at)))
                const unit = document.createElement('span')
                unit.className = 'zh-unit'
                unit.textContent = phrase
                parts.push(unit)
                rest = rest.slice(at + phrase.length)
            }
            el.replaceChildren(...parts, document.createTextNode(rest))
        }
    }
    for (const el of document.querySelectorAll('[data-zh-title]')) {
        if (el.dataset.enTitle === undefined) el.dataset.enTitle = el.title
        el.title = to === 'zh' ? el.dataset.zhTitle : el.dataset.enTitle
    }
    for (const a of document.querySelectorAll('[data-href-zh]')) {
        if (a.dataset.hrefEn === undefined) a.dataset.hrefEn = a.getAttribute('href')
        a.setAttribute('href', to === 'zh' ? a.dataset.hrefZh : a.dataset.hrefEn)
    }
    for (const b of document.querySelectorAll('[data-lang-toggle]')) {
        const label = b.querySelector('[data-lang-label]')
        label.textContent = to === 'zh' ? 'EN' : '中文'
        label.lang = to === 'zh' ? 'en' : 'zh-Hans'
        b.setAttribute('aria-label', to === 'zh' ? '切换为英文' : 'Switch to Chinese')
    }
    // a piece already playing is played again in the other language
    for (const f of document.querySelectorAll('.stage iframe[data-src]')) if (f.getAttribute('src')) f.src = inLang(f.dataset.src)
    if (!chosen) return
    // a choice is kept, and the address says it, so a link shared reads the same
    try { localStorage.setItem('openworld.lang', to) } catch {}
    const url = new URL(location.href)
    url.searchParams.set('lang', to)
    history.replaceState(null, '', url)
}
document.querySelectorAll('[data-lang-toggle]').forEach((b) => b.addEventListener('click', () => setLang(lang === 'zh' ? 'en' : 'zh', true)))
setLang(lang)

// ------------------------------------------------------------------ the bar: clear over the head, dark over the night band
const nav = document.getElementById('nav')
const navToggle = nav.querySelector('.nav-toggle')
const navLinks = nav.querySelector('.nav-links')
const navTitle = nav.querySelector('.nav-title')
const heroWordmark = document.querySelector('.hero h1')
const heroContent = document.querySelector('.hero-inner')
const hero = heroContent.closest('.hero')
const heroActions = document.querySelector('.hero-actions')
const navActions = nav.querySelector('.nav-actions')
const brandEasing = window.siteMotion.easing(getComputedStyle(document.documentElement).getPropertyValue('--motion-ease-standard'))
const brandReduced = matchMedia('(prefers-reduced-motion: reduce)')
// Row entrances finish after the surface; retain the animation gate until the last row settles.
navLinks.querySelectorAll('a').forEach((link, index) => link.style.setProperty('--menu-row', index))
let menuMotionTimer
function stopMenuMotion() {
    clearTimeout(menuMotionTimer)
    nav.classList.remove('menu-animating')
}
function startMenuMotion() {
    clearTimeout(menuMotionTimer)
    nav.classList.add('menu-animating')
    const duration = parseFloat(getComputedStyle(nav).getPropertyValue('--menu-duration'))
    menuMotionTimer = setTimeout(stopMenuMotion, Math.max(duration, nav.classList.contains('menu-open') ? 450 : 320) + 50)
}
function syncMenuAccess() {
    // (the links are hidden until the header shows them, and in the compact header until its menu opens)
    const hidden = !nav.classList.contains('brand-visible') || (getComputedStyle(navToggle).display !== 'none' && !nav.classList.contains('menu-open'))
    navLinks.inert = hidden
    navLinks.setAttribute('aria-hidden', String(hidden))
}
function closeMenu(animate = true) {
    const wasOpen = nav.classList.contains('menu-open')
    nav.classList.remove('menu-open')
    if (!animate) stopMenuMotion()
    else if (wasOpen) startMenuMotion()
    navToggle.setAttribute('aria-expanded', 'false')
    syncMenuAccess()
}
navToggle.addEventListener('click', () => {
    nav.style.setProperty('--nav-menu-h', `${Math.ceil(navLinks.getBoundingClientRect().height)}px`)
    const open = nav.classList.toggle('menu-open')
    startMenuMotion()
    navToggle.setAttribute('aria-expanded', String(open))
    syncMenuAccess()
    if (open) navLinks.querySelector('a').focus({ preventScroll: true })
})
nav.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', () => closeMenu()))
// Resizing must never play the disclosure animation when crossing a layout breakpoint.
window.addEventListener('resize', () => closeMenu(false))
document.addEventListener('click', (e) => { if (!nav.contains(e.target)) closeMenu() })
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('menu-open')) { closeMenu(); navToggle.focus() }
})
// The header can grow with enlarged text; its measured height also keeps anchor targets clear.
let navHeight = 0
let compactMenu = null
const navSize = new ResizeObserver(() => {
    navHeight = Math.ceil(nav.getBoundingClientRect().height)
    document.documentElement.style.setProperty('--nav-h', `${navHeight}px`)
    nav.style.setProperty('--nav-menu-h', `${Math.ceil(navLinks.getBoundingClientRect().height)}px`)
    const compact = getComputedStyle(navToggle).display !== 'none'
    if (compactMenu !== compact || !compact) closeMenu(false)
    compactMenu = compact
    syncMenuAccess()
    bar()
})
navSize.observe(nav)
navSize.observe(navLinks)
navSize.observe(heroWordmark)
const night = [...document.querySelectorAll('section.night')]
function bar() {
    const wordmarkBox = heroWordmark.getBoundingClientRect()
    const overNight = night.some((s) => { const r = s.getBoundingClientRect(); return r.top <= navHeight && r.bottom > navHeight })
    // The header's title, links and controls show from the start and step aside only while the hero's own title,
    // words and buttons pass under the header, where they would clash: gone as the title comes within reach of the
    // header, back once the buttons have passed above it. Scroll-linked: no timed opacity transition may lag behind a
    // fast reversal or a scrollbar drag.
    const contentTop = wordmarkBox.top
    const contentBottom = heroActions.getBoundingClientRect().bottom
    const before = (contentTop - navHeight - 8) / 48
    const after = (8 - contentBottom) / 48
    const progress = Math.max(0, Math.min(1, Math.max(before, after)))
    // The film stays under a clear header: the surface arrives with the page below it.
    const surfaceProgress = Math.max(0, Math.min(1, (navHeight + 32 - hero.getBoundingClientRect().bottom) / 32))
    const reveal = brandReduced.matches ? Number(progress >= 0.5) : brandEasing(progress)
    const surface = brandReduced.matches ? Number(surfaceProgress >= 0.5) : brandEasing(surfaceProgress)
    const showBrand = reveal > 0
    nav.style.setProperty('--brand-opacity', reveal)
    nav.style.setProperty('--brand-offset', `${(1 - reveal) * 8}px`)
    nav.style.setProperty('--header-opacity', surface)
    nav.classList.toggle('brand-visible', showBrand)
    navTitle.inert = !showBrand
    navTitle.setAttribute('aria-hidden', String(!showBrand))
    navActions.inert = !showBrand
    navActions.setAttribute('aria-hidden', String(!showBrand))
    syncMenuAccess()
    nav.classList.toggle('solid', surface >= 0.5)
    nav.classList.toggle('dark', overNight)
}
window.addEventListener('scroll', bar, { passive: true }); bar()
document.addEventListener('site-motion-scroll', bar)
brandReduced.addEventListener('change', bar)

// the section in view, marked in each [data-spy] list
document.querySelectorAll('[data-spy]').forEach((group) => {
    const links = [...group.querySelectorAll('a[href^="#"]')]
    const targets = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean)
    function spy() {
        let current = null
        targets.forEach((t) => { if (t.getBoundingClientRect().top < window.innerHeight * 0.35) current = t })
        links.forEach((a) => a.classList.toggle('active', !!current && a.getAttribute('href') === '#' + current.id))
    }
    window.addEventListener('scroll', spy, { passive: true })
    spy()
})

// ------------------------------------------------------------------ the films behind (the head, the news, the end)
const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
        if (e.isIntersecting && !still) e.target.play().catch(() => {})
        else e.target.pause()
    }
}, { threshold: 0.2 })
document.querySelectorAll('video[data-auto]').forEach((v) => seen.observe(v))

// ------------------------------------------------------------------ the pieces: loaded as they come near, running while seen
const frames = [...document.querySelectorAll('.stage iframe[data-src]')]
const near = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting && !e.target.getAttribute('src')) { e.target.src = inLang(e.target.dataset.src); near.unobserve(e.target) }
}, { rootMargin: '600px 0px' })
const run = (f, on) => f.contentWindow?.postMessage({ run: on && !still }, '*')
const showing = new IntersectionObserver((entries) => {
    for (const e of entries) { e.target.dataset.seen = e.isIntersecting ? '1' : ''; run(e.target, e.isIntersecting) }
}, { threshold: 0.15 })
for (const f of frames) {
    near.observe(f); showing.observe(f)
    // a piece that loads out of sight waits until it is seen
    f.addEventListener('load', () => run(f, f.dataset.seen === '1'))
}
document.addEventListener('visibilitychange', () => frames.forEach((f) => run(f, !document.hidden && f.dataset.seen === '1')))

// ------------------------------------------------------------------ how it works: a step is a chapter of its film
const explain = document.querySelector('#explain iframe')
const steps = [...document.querySelectorAll('.step[data-at]')]
const mark = (t) => steps.forEach((s, i) => s.classList.toggle('on', t >= Number(s.dataset.at) - 0.7 && (i === steps.length - 1 || t < Number(steps[i + 1].dataset.at) - 0.7)))
if (explain) {
    window.addEventListener('message', (e) => { if (e.source === explain.contentWindow && typeof e.data?.t === 'number') mark(e.data.t) })
    steps.forEach((step) => step.addEventListener('click', () => {
        if (!explain.getAttribute('src')) explain.src = inLang(explain.dataset.src)
        explain.contentWindow?.postMessage({ seek: Number(step.dataset.at), run: true }, '*')
        mark(Number(step.dataset.at))
        const r = explain.getBoundingClientRect()
        if (r.top < 0 || r.bottom > window.innerHeight) window.siteMotion.scrollTo(scrollY + r.top - (window.innerHeight - r.height) / 2)
    }))
}

// ------------------------------------------------------------------ the waitlist: sent to the mailing list, thanked in place
document.querySelectorAll('form.wl').forEach((form) => {
    form.addEventListener('submit', (e) => {
        e.preventDefault()
        // the mailing list's subscribe address goes in data-endpoint once the list exists
        if (form.dataset.endpoint) fetch(form.dataset.endpoint, { method: 'POST', body: new FormData(form), mode: 'no-cors' }).catch(() => {})
        form.classList.add('sent')
    })
})

// ------------------------------------------------------------------ the citation, copied as it is written
document.querySelectorAll('.cite .copy').forEach((b) => b.addEventListener('click', async () => {
    const code = b.closest('.cite').querySelector('code')
    try { await navigator.clipboard.writeText(code.textContent) } catch { const r = document.createRange(); r.selectNodeContents(code); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy'); getSelection().removeAllRanges() }
    b.textContent = lang === 'zh' ? b.dataset.copiedZh : b.dataset.copied
    setTimeout(() => (b.textContent = lang === 'zh' ? b.dataset.zh : b.dataset.en ?? 'Copy'), 1500)
}))
