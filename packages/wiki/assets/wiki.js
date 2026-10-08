// OpenWorld 中文维基: search (suggestions and results), random page, sortable tables, theme, spoilers.
(function () {
  'use strict'
  var INDEX = null
  function load(cb) {
    if (INDEX) return cb(INDEX)
    fetch('/wiki/_/search.json').then(function (r) { return r.json() }).then(function (d) { INDEX = d; cb(d) }).catch(function () { cb([]) })
  }
  var href = function (t) { return '/wiki/' + encodeURIComponent(t.replace(/\//g, '／')) }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }

  function score(p, q) {
    var t = p.t.toLowerCase(), s = 0
    if (t === q) s += 100
    else if (t.indexOf(q) === 0) s += 60
    else if (t.indexOf(q) >= 0) s += 40
    for (var i = 0; i < (p.a || []).length; i++) { var a = p.a[i].toLowerCase(); if (a === q) s += 80; else if (a.indexOf(q) >= 0) s += 30 }
    if (p.x && p.x.toLowerCase().indexOf(q) >= 0) s += 10
    if (p.st) s -= 2
    return s
  }
  function search(q, n) {
    q = q.trim().toLowerCase()
    if (!q) return []
    return INDEX.map(function (p) { return [score(p, q), p] }).filter(function (x) { return x[0] > 0 }).sort(function (a, b) { return b[0] - a[0] }).slice(0, n).map(function (x) { return x[1] })
  }

  // suggestions under the box
  var box = document.getElementById('q'), sug = document.getElementById('suggest'), sel = -1
  if (box && sug) {
    box.addEventListener('input', function () {
      load(function () {
        var r = search(box.value, 8)
        sel = -1
        sug.innerHTML = r.map(function (p) { return '<a href="' + href(p.t) + '">' + esc(p.t) + '<small>' + esc(p.k) + '</small></a>' }).join('')
        sug.style.display = r.length ? 'block' : 'none'
      })
    })
    box.addEventListener('keydown', function (e) {
      var items = sug.querySelectorAll('a')
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items.forEach(function (a, i) { a.classList.toggle('on', i === sel) })
      } else if (e.key === 'Enter' && sel >= 0 && items[sel]) { e.preventDefault(); location.href = items[sel].href }
      else if (e.key === 'Escape') sug.style.display = 'none'
    })
    document.addEventListener('click', function (e) { if (!sug.contains(e.target) && e.target !== box) sug.style.display = 'none' })
    document.addEventListener('keydown', function (e) { if (e.key === '/' && document.activeElement !== box && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); box.focus() } })
  }

  // the search page
  var results = document.getElementById('search-results')
  if (results) {
    var q = new URLSearchParams(location.search).get('q') || ''
    if (box) box.value = q
    load(function () {
      var exact = INDEX.filter(function (p) { return p.t === q || (p.a || []).indexOf(q) >= 0 })[0]
      if (exact && !new URLSearchParams(location.search).get('all')) { location.replace(href(exact.t)); return }
      var r = search(q, 60)
      results.innerHTML = '<p>搜索「' + esc(q) + '」：找到 ' + r.length + ' 页。</p><ol class="search-list">' + r.map(function (p) {
        var i = p.x.toLowerCase().indexOf(q.toLowerCase()), snip = i >= 0 ? p.x.slice(Math.max(0, i - 40), i + 80) : p.s
        return '<li><a href="' + href(p.t) + '"><b>' + esc(p.t) + '</b></a> <small class="muted">' + esc(p.k) + '</small><br><span class="muted">' + esc(snip) + '</span></li>'
      }).join('') + '</ol>'
    })
  }

  // random page
  if (document.getElementById('random-go')) load(function (d) { var ps = d.filter(function (p) { return p.k !== '特殊' }); location.replace(href(ps[Math.floor(Math.random() * ps.length)].t)) })

  // sortable tables
  document.querySelectorAll('table.sortable').forEach(function (t) {
    var ths = t.querySelectorAll('thead th')
    ths.forEach(function (th, col) {
      th.addEventListener('click', function () {
        var asc = !th.classList.contains('sort-asc')
        ths.forEach(function (h) { h.classList.remove('sort-asc', 'sort-desc') })
        th.classList.add(asc ? 'sort-asc' : 'sort-desc')
        var body = t.tBodies[0], rows = Array.prototype.slice.call(body.rows)
        rows.sort(function (a, b) {
          var x = a.cells[col] ? a.cells[col].textContent.trim() : '', y = b.cells[col] ? b.cells[col].textContent.trim() : ''
          var nx = parseFloat(x.replace(/[^\d.\-]/g, '')), ny = parseFloat(y.replace(/[^\d.\-]/g, ''))
          var c = !isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y, 'zh')
          return asc ? c : -c
        })
        rows.forEach(function (r) { body.appendChild(r) })
      })
    })
  })

  // theme
  var theme = document.getElementById('theme')
  if (theme) theme.addEventListener('click', function () {
    var cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    var next = cur === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('wiki.theme', next) } catch (e) {}
  })

  // a stub's "补充" goes to the edit button's target
  var edit = document.getElementById('edit')
  document.querySelectorAll('a.edit-link').forEach(function (a) { if (edit) a.href = edit.href })
})()
