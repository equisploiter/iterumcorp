#!/usr/bin/env node
/*
  i18n · iterumcorp.org
  ---------------------------------------------------------------------------
  Zero-dependency translation pipeline for the static site.

  Source of truth: the Spanish HTML files in the repo root (index.html, ...).
  Dictionary:      i18n/en.json  →  { "<texto en español>": "<English text>" }
  Output:          en/*.html + sitemap.xml   (never edit en/ by hand)

  Commands
    node scripts/i18n.js extract   Scan the Spanish pages, add every new string
                                   to i18n/en.json (value ""), move strings that
                                   no longer exist to i18n/obsolete.en.json.
    node scripts/i18n.js build     Generate en/*.html and sitemap.xml. Strings
                                   without translation fall back to Spanish and
                                   are reported.
    node scripts/i18n.js check     Exit 1 if any string is untranslated or if
                                   en/ is out of date. Meant for CI.

  How a "string" is found (no markup needed in the HTML):
    · An element that contains text directly (not only child elements) is one
      unit; its whole innerHTML is the key. So
        <p>La <span class="blood">sangre</span> es tu único recurso.</p>
      yields the key  «La <span class="blood">sangre</span> es tu único recurso.»
      and the translation keeps the inline markup.
    · Elements with no direct text (lists, divs, nav…) are recursed into.
    · Attributes: title/alt/aria-label/placeholder/data-label, <meta> content
      for description / og:* / twitter:*, and value of hidden/submit inputs.
    · <script>, <style> and anything with translate="no" are skipped.
    · Whitespace is normalised, except blank lines (kept as \n\n) so that
      pre-wrap blocks such as .copy survive.
  ---------------------------------------------------------------------------
*/
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = {
  site: 'https://iterumcorp.org',
  sourceLang: 'es',
  targetLang: 'en',
  outDir: 'en',
  dictionary: path.join('i18n', 'en.json'),
  obsolete: path.join('i18n', 'obsolete.en.json'),
  pages: ['index.html', 'singularity.html', 'proposito.html', 'press.html', 'contacto.html', 'legal.html'],
  locale: { es: 'es_ES', en: 'en_US' },
  // Text shown by the language switcher (data-lang-switch) in each output.
  switcher: { es: { text: 'EN', label: 'Read this site in English' }, en: { text: 'ES', label: 'Leer este sitio en español' } },
};

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);
const TRANSLATABLE_ATTRS = new Set(['alt', 'title', 'aria-label', 'placeholder', 'data-label']);
const META_TRANSLATABLE = /^(description|og:title|og:description|twitter:title|twitter:description)$/;

/* --------------------------------------------------------------------------
   Minimal HTML tree over the raw source. Keeps offsets so we can splice.
   -------------------------------------------------------------------------- */
function parse(src) {
  const root = { type: 'el', tag: '#root', attrs: [], start: 0, openEnd: 0, closeStart: src.length, end: src.length, children: [], parent: null };
  const stack = [root];
  let i = 0;
  const top = () => stack[stack.length - 1];
  const pushText = (s, e) => { if (e > s) top().children.push({ type: 'text', start: s, end: e }); };

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) { pushText(i, src.length); break; }
    pushText(i, lt);

    if (src.startsWith('<!--', lt)) {
      const e = src.indexOf('-->', lt + 4);
      i = e === -1 ? src.length : e + 3;
      continue;
    }
    if (src[lt + 1] === '!' || src[lt + 1] === '?') {
      const e = src.indexOf('>', lt);
      i = e === -1 ? src.length : e + 1;
      continue;
    }
    if (src[lt + 1] === '/') {
      const e = src.indexOf('>', lt);
      const tag = src.slice(lt + 2, e).trim().toLowerCase();
      // Pop to the matching open element (tolerant of stray closers).
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag === tag) {
          for (let m = stack.length - 1; m >= k; m--) { const n = stack[m]; n.closeStart = m === k ? lt : lt; n.end = m === k ? e + 1 : lt; }
          stack.length = k;
          break;
        }
      }
      i = e + 1;
      continue;
    }
    // Open tag
    const m = /^<([a-zA-Z][\w:-]*)/.exec(src.slice(lt, lt + 40));
    if (!m) { pushText(lt, lt + 1); i = lt + 1; continue; }
    const tag = m[1].toLowerCase();
    let p = lt + m[0].length;
    const attrs = [];
    const attrRe = /\s+([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;
    for (;;) {
      attrRe.lastIndex = p;
      const a = attrRe.exec(src);
      if (!a) break;
      const name = a[1].toLowerCase();
      let value = null, valStart = -1, valEnd = -1, quote = '';
      if (a[2] !== undefined || a[3] !== undefined || a[4] !== undefined) {
        value = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4];
        quote = a[2] !== undefined ? '"' : a[3] !== undefined ? "'" : '';
        valEnd = a.index + a[0].length - (quote ? 1 : 0);
        valStart = valEnd - value.length;
      }
      attrs.push({ name, value, valStart, valEnd, quote });
      p = a.index + a[0].length;
    }
    const gt = src.indexOf('>', p);
    const selfClose = src[gt - 1] === '/';
    const node = { type: 'el', tag, attrs, start: lt, openEnd: gt + 1, closeStart: gt + 1, end: gt + 1, children: [], parent: top() };
    top().children.push(node);
    i = gt + 1;
    if (VOID.has(tag) || selfClose) continue;
    if (RAW.has(tag)) {
      const closeRe = new RegExp('</' + tag + '\\s*>', 'ig');
      closeRe.lastIndex = i;
      const c = closeRe.exec(src);
      node.closeStart = c ? c.index : src.length;
      node.end = c ? c.index + c[0].length : src.length;
      node.raw = true;
      i = node.end;
      continue;
    }
    stack.push(node);
  }
  return root;
}

const attr = (node, name) => { const a = node.attrs.find(x => x.name === name); return a ? a.value : null; };

/* --------------------------------------------------------------------------
   Strings
   -------------------------------------------------------------------------- */
function normalize(s) {
  return s.trim()
    .replace(/\s*\n[^\S\n]*\n\s*/g, '\u0001')   // blank line(s) → paragraph break
    .replace(/\s+/g, ' ')
    .replace(/\u0001/g, '\n\n');
}
const hasLetters = s => /\p{L}/u.test(s.replace(/<[^>]*>/g, '').replace(/&[a-z]+;|&#\d+;/gi, ''));
const escAttr = s => s.replace(/"/g, '&quot;');

/* Walk a page and collect every translatable unit with its offsets. */
function collect(src) {
  const units = []; // { kind: 'text'|'attr', key, start, end, node, attrName }
  const walk = (node) => {
    if (node.tag === 'script' && attr(node, 'type') === 'application/ld+json') {
      // JSON-LD: translate "description" values only.
      const re = /"description"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
      let m;
      while ((m = re.exec(src.slice(node.openEnd, node.closeStart)))) {
        const start = node.openEnd + m.index + m[0].length - 1 - m[1].length;
        units.push({ kind: 'attr', key: m[1], start, end: start + m[1].length, node, attrName: 'ld:description' });
      }
      return;
    }
    if (node.raw || RAW.has(node.tag)) return;
    if (attr(node, 'translate') === 'no') return;
    if (node.attrs.some(x => x.name === 'data-lang-switch')) return; // handled by CONFIG.switcher

    if (node.tag === 'meta') {
      const key = attr(node, 'name') || attr(node, 'property') || '';
      if (META_TRANSLATABLE.test(key)) {
        const a = node.attrs.find(x => x.name === 'content');
        if (a && a.value && hasLetters(a.value)) units.push({ kind: 'attr', key: normalize(a.value), start: a.valStart, end: a.valEnd, node, attrName: 'content' });
      }
    } else {
      for (const a of node.attrs) {
        const ok = TRANSLATABLE_ATTRS.has(a.name) ||
          (a.name === 'value' && node.tag === 'input' && /^(hidden|submit|button|reset)$/i.test(attr(node, 'type') || 'text'));
        if (ok && a.value && hasLetters(a.value)) units.push({ kind: 'attr', key: normalize(a.value), start: a.valStart, end: a.valEnd, node, attrName: a.name });
      }
    }

    const directText = node.children.some(c => c.type === 'text' && /\S/.test(src.slice(c.start, c.end)));
    if (directText && node.tag !== '#root') {
      const raw = src.slice(node.openEnd, node.closeStart);
      const key = normalize(raw);
      if (key && hasLetters(key)) units.push({ kind: 'text', key, start: node.openEnd, end: node.closeStart, node });
      // Attributes of inline descendants (e.g. title=) belong to the key itself.
      return;
    }
    for (const c of node.children) if (c.type === 'el') walk(c);
  };
  walk(parse(src));
  return units;
}

/* --------------------------------------------------------------------------
   Build one page
   -------------------------------------------------------------------------- */
function rewriteUrl(url, page, ctx) {
  if (!url) return url;
  if (ctx.isCanonical) {
    return url.replace(CONFIG.site + '/', CONFIG.site + '/' + CONFIG.outDir + '/');
  }
  if (/^(#|mailto:|tel:|data:|https?:|\/\/)/i.test(url)) return url;
  if (url === '/') return '/' + CONFIG.outDir + '/';
  if (url.startsWith('/')) return url;
  if (/^[^\/]+\.html(#.*)?$/.test(url)) return url;        // sibling page inside en/
  return '../' + url;                                        // assets, css, js
}

function buildPage(page, dict, report) {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const tree = parse(src);
  const edits = []; // { start, end, text }

  // 1. Translations
  for (const u of collect(src)) {
    let tr = dict[u.key];
    if (tr === undefined) { report.missing.push({ page, key: u.key, reason: 'not in dictionary (run extract)' }); continue; }
    if (tr === '') { report.missing.push({ page, key: u.key, reason: 'empty translation' }); continue; }
    if (tr === u.key) continue;
    if (u.kind === 'attr') {
      edits.push({ start: u.start, end: u.end, text: u.attrName === 'ld:description' ? JSON.stringify(tr).slice(1, -1) : escAttr(tr) });
    } else {
      const raw = src.slice(u.start, u.end);
      const lead = /^\s*/.exec(raw)[0], tail = /\s*$/.exec(raw)[0];
      edits.push({ start: u.start, end: u.end, text: lead + tr + tail });
    }
  }

  // 2. Structural rewrites: lang, urls, locale, switcher
  const walk = (node) => {
    if (node.tag === 'html') {
      const a = node.attrs.find(x => x.name === 'lang');
      if (a) edits.push({ start: a.valStart, end: a.valEnd, text: CONFIG.targetLang });
    }
    if (node.tag === 'meta' && attr(node, 'property') === 'og:locale') {
      const a = node.attrs.find(x => x.name === 'content');
      if (a) edits.push({ start: a.valStart, end: a.valEnd, text: CONFIG.locale[CONFIG.targetLang] });
    }
    if (node.tag === 'meta' && attr(node, 'property') === 'og:locale:alternate') {
      const a = node.attrs.find(x => x.name === 'content');
      if (a) edits.push({ start: a.valStart, end: a.valEnd, text: CONFIG.locale[CONFIG.sourceLang] });
    }
    if (node.tag === 'meta' && attr(node, 'property') === 'og:url') {
      const a = node.attrs.find(x => x.name === 'content');
      if (a) edits.push({ start: a.valStart, end: a.valEnd, text: rewriteUrl(a.value, page, { isCanonical: true }) });
    }
    if (node.tag === 'link' && attr(node, 'rel') === 'canonical') {
      const a = node.attrs.find(x => x.name === 'href');
      if (a) edits.push({ start: a.valStart, end: a.valEnd, text: rewriteUrl(a.value, page, { isCanonical: true }) });
    } else if (node.attrs.some(x => x.name === 'data-lang-switch')) {
      const sw = CONFIG.switcher[CONFIG.targetLang];
      for (const a of node.attrs) {
        if (a.name === 'href') edits.push({ start: a.valStart, end: a.valEnd, text: '../' + page });
        if (a.name === 'hreflang' || a.name === 'lang') edits.push({ start: a.valStart, end: a.valEnd, text: CONFIG.sourceLang });
        if (a.name === 'aria-label') edits.push({ start: a.valStart, end: a.valEnd, text: escAttr(sw.label) });
      }
      // Replace the visible text (drop any translation edit already queued for it).
      const idx = edits.findIndex(e => e.start === node.openEnd && e.end === node.closeStart);
      if (idx !== -1) edits.splice(idx, 1);
      edits.push({ start: node.openEnd, end: node.closeStart, text: sw.text });
    } else if (!(node.tag === 'link' && attr(node, 'rel') === 'alternate')) {
      for (const a of node.attrs) {
        if ((a.name === 'href' || a.name === 'src' || a.name === 'poster') && a.value !== null) {
          const nu = rewriteUrl(a.value, page, {});
          if (nu !== a.value) edits.push({ start: a.valStart, end: a.valEnd, text: nu });
        }
        if (a.name === 'srcset' && a.value) {
          const nu = a.value.split(',').map(s => s.trim().replace(/^(\S+)/, m => rewriteUrl(m, page, {}))).join(', ');
          if (nu !== a.value) edits.push({ start: a.valStart, end: a.valEnd, text: nu });
        }
      }
    }
    for (const c of node.children) if (c.type === 'el') walk(c);
  };
  walk(tree);

  // 3. Apply edits back-to-front. Guard against overlaps.
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = src, lastStart = Infinity;
  for (const e of edits) {
    if (e.end > lastStart) { report.warnings.push(`${page}: overlapping edit at ${e.start}-${e.end} skipped`); continue; }
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    lastStart = e.start;
  }
  const banner = `<!-- Generated from ${page} by scripts/i18n.js — do not edit; edit the Spanish page and i18n/en.json, then run \`npm run build\`. -->\n`;
  out = out.replace(/^(<!DOCTYPE[^>]*>\s*)/i, (m) => m + banner);
  return out;
}

/* --------------------------------------------------------------------------
   Sitemap with hreflang alternates
   -------------------------------------------------------------------------- */
function sitemap() {
  const url = (page, lang) => CONFIG.site + '/' + (lang === CONFIG.sourceLang ? '' : CONFIG.outDir + '/') + (page === 'index.html' ? '' : page);
  const items = [];
  for (const page of CONFIG.pages) {
    const alts = [CONFIG.sourceLang, CONFIG.targetLang].map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${url(page, l)}"/>`).join('\n') +
      `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${url(page, CONFIG.sourceLang)}"/>`;
    for (const l of [CONFIG.sourceLang, CONFIG.targetLang]) items.push(`  <url>\n    <loc>${url(page, l)}</loc>\n${alts}\n  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${items.join('\n')}\n</urlset>\n`;
}

/* --------------------------------------------------------------------------
   Commands
   -------------------------------------------------------------------------- */
function readJson(p, fallback) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return fallback; } }
function writeJson(p, obj) { fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true }); fs.writeFileSync(path.join(ROOT, p), JSON.stringify(obj, null, 2) + '\n'); }

function extract() {
  const dict = readJson(CONFIG.dictionary, {});
  const obsolete = readJson(CONFIG.obsolete, {});
  const seen = new Set();
  const next = {};
  let added = 0;
  for (const page of CONFIG.pages) {
    const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
    for (const u of collect(src)) {
      if (seen.has(u.key)) continue;
      seen.add(u.key);
      if (u.key in dict) next[u.key] = dict[u.key];
      else if (u.key in obsolete && obsolete[u.key]) { next[u.key] = obsolete[u.key]; delete obsolete[u.key]; }
      else { next[u.key] = ''; added++; console.log(`  + [${page}] ${u.key.slice(0, 90)}${u.key.length > 90 ? '…' : ''}`); }
    }
  }
  let removed = 0;
  for (const k of Object.keys(dict)) if (!seen.has(k)) { if (dict[k]) obsolete[k] = dict[k]; removed++; }
  writeJson(CONFIG.dictionary, next);
  if (Object.keys(obsolete).length) writeJson(CONFIG.obsolete, obsolete);
  else if (fs.existsSync(path.join(ROOT, CONFIG.obsolete))) fs.unlinkSync(path.join(ROOT, CONFIG.obsolete));
  const empty = Object.values(next).filter(v => v === '').length;
  console.log(`extract: ${seen.size} strings · ${added} new · ${removed} moved to obsolete · ${empty} untranslated`);
  return empty;
}

function build({ write = true } = {}) {
  const dict = readJson(CONFIG.dictionary, null);
  if (!dict) { console.error(`build: ${CONFIG.dictionary} not found. Run "extract" first.`); process.exit(1); }
  const report = { missing: [], warnings: [] };
  const outputs = {};
  for (const page of CONFIG.pages) outputs[path.join(CONFIG.outDir, page)] = buildPage(page, dict, report);
  outputs['sitemap.xml'] = sitemap();
  let stale = [];
  for (const [rel, content] of Object.entries(outputs)) {
    const abs = path.join(ROOT, rel);
    const prev = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    if (prev !== content) stale.push(rel);
    if (write) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, content); }
  }
  for (const w of report.warnings) console.warn('  ! ' + w);
  if (report.missing.length) {
    const uniq = new Map(); for (const m of report.missing) if (!uniq.has(m.key)) uniq.set(m.key, m);
    console.warn(`build: ${uniq.size} string(s) still in Spanish:`);
    for (const m of uniq.values()) console.warn(`  - [${m.page}] ${m.key.slice(0, 90)}${m.key.length > 90 ? '…' : ''}  (${m.reason})`);
  }
  console.log(write ? `build: wrote ${Object.keys(outputs).length} files (${stale.length} changed)` : `build --dry: ${stale.length} file(s) out of date${stale.length ? ': ' + stale.join(', ') : ''}`);
  return { missing: report.missing.length, stale };
}

function check() {
  const dict = readJson(CONFIG.dictionary, {});
  const seen = new Set();
  let problems = 0;
  for (const page of CONFIG.pages) for (const u of collect(fs.readFileSync(path.join(ROOT, page), 'utf8'))) {
    if (seen.has(u.key)) continue; seen.add(u.key);
    if (!(u.key in dict)) { console.error(`  ✗ [${page}] not extracted: ${u.key.slice(0, 90)}`); problems++; }
    else if (dict[u.key] === '') { console.error(`  ✗ [${page}] untranslated: ${u.key.slice(0, 90)}`); problems++; }
  }
  const { stale } = build({ write: false });
  if (stale.length) { console.error(`  ✗ generated files out of date: ${stale.join(', ')} — run "npm run build"`); problems += stale.length; }
  console.log(problems ? `check: ${problems} problem(s)` : 'check: ok');
  process.exit(problems ? 1 : 0);
}

const cmd = process.argv[2];
if (cmd === 'extract') extract();
else if (cmd === 'build') build();
else if (cmd === 'check') check();
else { console.log('usage: node scripts/i18n.js <extract|build|check>'); process.exit(cmd ? 1 : 0); }
