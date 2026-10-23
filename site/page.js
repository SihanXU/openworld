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
    }
    for (const el of document.querySelectorAll('[data-zh-title]')) {
        if (el.dataset.enTitle === undefined) el.dataset.enTitle = el.title
        el.title = to === 'zh' ? el.dataset.zhTitle : el.dataset.enTitle
    }
    for (const a of document.querySelectorAll('[data-href-zh]')) {
        if (a.dataset.hrefEn === undefined) a.dataset.hrefEn = a.getAttribute('href')
        a.setAttribute('href', to === 'zh' ? a.dataset.hrefZh : a.dataset.hrefEn)
    }
    for (const b of document.querySelectorAll('[data-lang-toggle]')) b.textContent = to === 'zh' ? 'EN' : '中文'
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
const night = [...document.querySelectorAll('section.night')]
function bar() {
    nav.classList.toggle('solid', window.scrollY > window.innerHeight * 0.75)
    nav.classList.toggle('dark', night.some((s) => { const r = s.getBoundingClientRect(); return r.top <= 64 && r.bottom > 64 }))
}
window.addEventListener('scroll', bar, { passive: true }); bar()

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
        if (r.top < 0 || r.bottom > window.innerHeight) explain.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' })
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
