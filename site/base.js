// touch has no hover: a tap turns a card over
document.querySelectorAll('.flip-container').forEach((card) => {
    card.addEventListener('click', () => {
        if (window.matchMedia('(hover: none)').matches || card.dataset.tap !== undefined) card.classList.toggle('is-flipped')
    })
})

// the waitlist: sent to the mailing list, thanked in place
document.querySelectorAll('form.wl').forEach((form) => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault()
        if (!form.dataset.endpoint) return
        const button = form.querySelector('button[type=submit]')
        button.disabled = true
        form.classList.remove('failed')
        // Kit answers in JSON when asked to: { status: 'success' | 'failed', errors }
        let ok = false
        try {
            const r = await fetch(form.dataset.endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
            ok = r.ok && (await r.json()).status !== 'failed'
        } catch {}
        button.disabled = false
        form.classList.add(ok ? 'sent' : 'failed')
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

// a citation copied as it is written
document.querySelectorAll('.cite .copy').forEach((b) => b.addEventListener('click', async () => {
    const code = b.closest('.cite').querySelector('code')
    try { await navigator.clipboard.writeText(code.textContent) } catch { const r = document.createRange(); r.selectNodeContents(code); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy'); getSelection().removeAllRanges() }
    const was = b.textContent
    b.textContent = b.dataset.copied
    setTimeout(() => (b.textContent = was), 1500)
}))
