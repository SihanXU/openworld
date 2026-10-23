// The project page: the pieces' films playing round and round while they are in view, the steps a chapter of their
// film, the waitlist, the bar's look over what it is on.
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
    for (const e of entries) if (e.isIntersecting && !e.target.src) { e.target.src = e.target.dataset.src; near.unobserve(e.target) }
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
        if (!explain.src) explain.src = explain.dataset.src
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
