// Translates the static parts of index.html: elements marked data-i18n="path"
// get that text, data-i18n="attr:path" sets an attribute instead.

import { ui } from './strings.js';

const lookup = (text, path) => path.split('.').reduce((node, part) => node?.[part], text);

export function translatePage(lang) {
  const text = ui(lang);
  document.documentElement.lang = lang;
  document.title = text.siteTitle;
  document.querySelector('meta[name=description]')?.setAttribute('content', text.description);
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const [attr, path] = el.dataset.i18n.includes(':') ? el.dataset.i18n.split(':') : [null, el.dataset.i18n];
    if (attr) el.setAttribute(attr, lookup(text, path));
    else el.textContent = lookup(text, path);
  }
}

/** `?lang=fi` wins, then the browser language; English otherwise. */
export function detectLang(supported, search = location.search, languages = navigator.languages ?? []) {
  const asked = new URLSearchParams(search).get('lang');
  if (supported.includes(asked)) return asked;
  const preferred = languages.map((l) => l.slice(0, 2).toLowerCase()).find((l) => supported.includes(l));
  return preferred ?? supported[0];
}
