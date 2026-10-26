// Shared Material motion for authored navigation; wheel and touch scrolling stay native.
// Curves: https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-motion.scss
(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    function cancel() { cancelAnimationFrame(frame); frame = 0 }
    function position(top) {
        window.scrollTo({ top, behavior: 'instant' })
        // Scroll events arrive in the next rendering cycle; update scroll-linked chrome before this paint.
        document.dispatchEvent(new Event('site-motion-scroll'))
    }

    // CSS bezier curves describe y at an x (elapsed time), rather than at the curve parameter.
    function easing(value) {
        const [x1, y1, x2, y2] = value.match(/[\d.]+/g).map(Number)
        const at = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3
        return x => {
            if (x <= 0 || x >= 1) return Math.max(0, Math.min(1, x))
            let lo = 0, hi = 1
            for (let i = 0; i < 20; i++) {
                const t = (lo + hi) / 2
                if (at(t, x1, x2) < x) lo = t
                else hi = t
            }
            return at((lo + hi) / 2, y1, y2)
        }
    }

    function scrollTo(top, done) {
        cancel()
        const start = scrollY
        const end = Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight))
        const distance = end - start
        if (reduced.matches || Math.abs(distance) < 2) {
            position(end)
            done?.()
            return
        }
        const tokens = getComputedStyle(document.documentElement)
        const curve = easing(tokens.getPropertyValue('--motion-ease-standard'))
        const duration = parseFloat(tokens.getPropertyValue('--motion-duration-long')) + Math.min(200, Math.abs(distance) / 8)
        const began = performance.now()
        function tick(now) {
            const progress = Math.min(1, (now - began) / duration)
            position(progress === 1 ? end : start + distance * curve(progress))
            if (progress < 1) frame = requestAnimationFrame(tick)
            else { frame = 0; done?.() }
        }
        frame = requestAnimationFrame(tick)
    }
    window.siteMotion = { scrollTo, easing }

    document.addEventListener('click', event => {
        const link = event.target.closest('a[href^="#"]')
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return
        let target
        try { target = document.getElementById(decodeURIComponent(link.hash.slice(1))) } catch { return }
        if (!target) return
        event.preventDefault()
        const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
        const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0
        const top = target.getBoundingClientRect().top + scrollY - padding - margin
        if (location.hash !== link.hash) history.pushState(null, '', link.hash)
        scrollTo(top, () => {
            // Preserve keyboard navigation into a section, including headings without a native tab stop.
            const temporary = !target.hasAttribute('tabindex') && !target.matches('a[href],button,input,select,textarea')
            if (temporary) target.setAttribute('tabindex', '-1')
            target.focus({ preventScroll: true })
            if (temporary) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true })
        })
    })

    // A new gesture takes control immediately, including a reversal during an animated jump.
    for (const type of ['wheel', 'touchstart', 'pointerdown']) window.addEventListener(type, cancel, { passive: true })
    window.addEventListener('keydown', event => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Escape', 'Tab'].includes(event.key)) cancel()
    })
    window.addEventListener('resize', cancel)
    window.addEventListener('popstate', cancel)
    reduced.addEventListener('change', cancel)
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancel() })
})()
