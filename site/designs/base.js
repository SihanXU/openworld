// touch has no hover: a tap turns a card over
document.querySelectorAll('.flip-container').forEach((card) => {
    card.addEventListener('click', () => {
        if (window.matchMedia('(hover: none)').matches || card.dataset.tap !== undefined) card.classList.toggle('is-flipped')
    })
})

// the waitlist (a mock here: the real form posts to the mailing list's own endpoint)
document.querySelectorAll('form.wl').forEach((form) => {
    form.addEventListener('submit', (e) => {
        e.preventDefault()
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
