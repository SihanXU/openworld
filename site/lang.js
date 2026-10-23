// The language a piece is read in: ?lang=zh|en, else its page's own (<html lang>). L(en, zh) picks the words; an
// element's own words for Chinese ride on data-zh and are swapped in as the page loads.
const asked = new URLSearchParams(location.search).get('lang')
export const LANG = asked === 'zh' || asked === 'en' ? asked : document.documentElement.lang.startsWith('zh') ? 'zh' : 'en'
export const L = (en, zh) => (LANG === 'zh' ? zh : en)
if (LANG === 'zh') {
  document.documentElement.lang = 'zh'
  document.querySelectorAll('[data-zh]').forEach((el) => (el.textContent = el.dataset.zh))
}
