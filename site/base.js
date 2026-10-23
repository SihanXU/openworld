// touch has no hover: a tap turns a card over
document.querySelectorAll('.flip-container').forEach((card) => {
    card.addEventListener('click', () => {
        if (window.matchMedia('(hover: none)').matches || card.dataset.tap !== undefined) card.classList.toggle('is-flipped')
    })
})

// the waitlist: sent to the mailing list, thanked in place
document.querySelectorAll('form.wl').forEach((form) => {
    form.addEventListener('submit', (e) => {
        e.preventDefault()
        // the mailing list's subscribe address goes in data-endpoint once the list exists
        if (form.dataset.endpoint) fetch(form.dataset.endpoint, { method: 'POST', body: new FormData(form), mode: 'no-cors' }).catch(() => {})
        form.classList.add('sent')
    })
})

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

// the pieces' films (?embed) run only while they are seen
const pieces = [...document.querySelectorAll('iframe[src*="?embed"]')]
const seenPiece = new IntersectionObserver((entries) => {
    for (const e of entries) { e.target.dataset.seen = e.isIntersecting ? '1' : ''; e.target.contentWindow?.postMessage({ run: e.isIntersecting }, '*') }
}, { threshold: 0.15 })
pieces.forEach((f) => { seenPiece.observe(f); f.addEventListener('load', () => f.contentWindow?.postMessage({ run: f.dataset.seen === '1' }, '*')) })
