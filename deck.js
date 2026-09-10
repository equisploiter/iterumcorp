/*
  deck.js · iterumcorp.org
  ---------------------------------------------------------------------------
  The pitch deck (pitch.html) as a presentation. pdf.js (vendored in
  assets/vendor/pdfjs) draws the PDF one slide at a time onto a canvas; this
  file adds what a deck needs around it: arrows, keys, swipe, thumbnails,
  fullscreen, and a #s<N> hash so a single slide can be linked.

  Clips. PowerPoint exports an embedded video or gif as its first frame, so
  the PDF only carries a still. Every <figure> in the clips section that has
  data-deck-page and data-deck-box ("x y w h", percentages of the page) is
  laid over that slide while it is on screen, so the still plays. When the
  PDF changes, `python scripts/deck-boxes.py <pdf>` prints the boxes again.

  Nothing here is needed to read the deck: without JS, or if the PDF cannot
  be drawn, the stage keeps the download link and the clips section stands.
  ---------------------------------------------------------------------------
*/
import * as pdfjs from './assets/vendor/pdfjs/pdf.min.js';

const viewer = document.querySelector('[data-deck]');
if (viewer) boot(viewer).catch(function (err) { fail(viewer, err); });

function fail(viewer, err) {
  console.error('deck:', err);
  viewer.classList.add('is-error');
  var status = viewer.querySelector('.deck__status');
  var error = viewer.querySelector('.deck__error');
  if (status && error) { status.textContent = ''; error.hidden = false; status.appendChild(error); }
}

async function boot(viewer) {
  var $ = function (s, r) { return (r || viewer).querySelector(s); };
  var stage = $('.deck__stage'), slide = $('[data-slide]'), media = $('.deck__media');
  var bar = $('.deck__status i');
  var pageEl = $('[data-deck-page-n]'), totalEl = $('[data-deck-total]');
  var progress = $('.deck__progress i');
  // Arrows over the slide (pointer devices) and step buttons in the bar (touch): same job.
  var prevBtns = viewer.querySelectorAll('[data-deck-prev]'), nextBtns = viewer.querySelectorAll('[data-deck-next]'), fsBtn = $('[data-deck-fs]');
  var thumbs = $('.deck__thumbs'), thumbTpl = $('template');
  var url = $('[data-deck-src]').href;   // the download link, already rewritten for /es/
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };
  var dpr = function () { return Math.min(window.devicePixelRatio || 1, 2.5); };

  // The clips, grouped by the slide they belong to.
  var clips = {};
  document.querySelectorAll('[data-deck-page][data-deck-box]').forEach(function (f) {
    var n = +f.dataset.deckPage;
    (clips[n] = clips[n] || []).push(f);
  });

  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./assets/vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
  var task = pdfjs.getDocument({ url: url, isEvalSupported: false });
  task.onProgress = function (p) { if (p.total && bar) bar.style.setProperty('--p', Math.min(1, p.loaded / p.total).toFixed(3)); };
  var doc = await task.promise;
  // data-deck-last caps the deck (e.g. to hide backup slides exported after "Thank you").
  var last = clamp(+viewer.dataset.deckLast || doc.numPages, 1, doc.numPages);

  var first = await doc.getPage(1);
  var v0 = first.getViewport({ scale: 1 });
  viewer.style.setProperty('--arn', (v0.width / v0.height).toFixed(4));
  totalEl.textContent = pad(last);

  // ---- Rendering. One canvas per slide, cached for the stage's current width. ----
  var cache = new Map(), pending = new Map(), cacheW = 0;
  function render(n, cssW) {
    if (cssW !== cacheW) { cache.clear(); pending.clear(); cacheW = cssW; }
    if (cache.has(n)) return Promise.resolve(cache.get(n));
    if (pending.has(n)) return pending.get(n);
    var job = draw(n, cssW).then(function (c) {
      if (pending.get(n) !== job) return c;        // the stage was resized meanwhile: not worth keeping
      pending.delete(n);
      cache.set(n, c);
      if (cache.size > 9) cache.delete(cache.keys().next().value);
      return c;
    });
    pending.set(n, job);
    return job;
  }
  async function draw(n, cssW) {
    var page = await doc.getPage(n);
    var base = page.getViewport({ scale: 1 });
    var vp = page.getViewport({ scale: (cssW / base.width) * dpr() });
    var c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await page.render({ canvas: c, canvasContext: c.getContext('2d', { alpha: false }), viewport: vp }).promise;
    return c;
  }
  function prefetch(n) {
    var w = cacheW;
    [n + 1, n - 1, n + 2].filter(function (k) { return k >= 1 && k <= last; }).reduce(function (p, k) {
      return p.then(function () { return render(k, w).catch(function () {}); });
    }, Promise.resolve());
  }

  // ---- Showing a slide ----
  var cur = 0, token = 0;
  async function show(n, dir) {
    n = clamp(n, 1, last);
    if (n === cur) return;
    var from = cur; cur = n;
    chrome();
    if (from) { try { history.replaceState(null, '', '#s' + n); } catch (e) {} }
    var t = ++token, c;
    try { c = await render(n, stage.clientWidth); } catch (e) { fail(viewer, e); return; }
    if (t !== token) return;
    place(c);
    if (from && !reduce) {
      slide.style.setProperty('--dir', ((dir || (n > from ? 1 : -1)) * 14) + 'px');
      slide.classList.remove('is-in'); void slide.offsetWidth; slide.classList.add('is-in');
    }
    mount(n);
    viewer.classList.add('is-ready');
    prefetch(n);
  }
  function place(c) {
    var old = slide.querySelector('canvas');
    if (old === c) return;
    if (old) old.remove();
    slide.insertBefore(c, media);
  }
  function chrome() {
    pageEl.textContent = pad(cur);
    progress.style.setProperty('--p', (cur / last).toFixed(4));
    prevBtns.forEach(function (b) { b.disabled = cur <= 1; });
    nextBtns.forEach(function (b) { b.disabled = cur >= last; });
    thumbBtns.forEach(function (b, i) { b.setAttribute('aria-selected', i + 1 === cur ? 'true' : 'false'); });
    var b = thumbBtns[cur - 1];
    if (b) thumbs.scrollTo({ left: b.offsetLeft - (thumbs.clientWidth - b.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  }
  var next = function () { show(cur + 1, 1); };
  var prev = function () { show(cur - 1, -1); };

  // ---- Clips over their stills ----
  function mount(n) {
    media.querySelectorAll('video').forEach(function (v) { v.pause(); v.removeAttribute('src'); v.textContent = ''; v.load(); });
    media.textContent = '';
    (clips[n] || []).forEach(function (fig) {
      var box = fig.dataset.deckBox.trim().split(/[\s,]+/).map(Number);
      var src = fig.querySelector('video, img');
      if (!src || box.length !== 4 || box.some(isNaN)) return;
      var el;
      if (src.tagName === 'VIDEO') {
        el = document.createElement('video');
        el.muted = true; el.loop = true; el.playsInline = true; el.preload = 'auto';
        el.setAttribute('muted', ''); el.setAttribute('playsinline', '');
        el.disablePictureInPicture = true; el.setAttribute('disableremoteplayback', '');
        if (src.poster) el.poster = src.poster;
        if (src.getAttribute('aria-label')) el.setAttribute('aria-label', src.getAttribute('aria-label'));
        src.querySelectorAll('source').forEach(function (s) { var c = document.createElement('source'); c.src = s.src; if (s.type) c.type = s.type; el.appendChild(c); });
        if (reduce) el.controls = true; else el.autoplay = true;
      } else {
        el = document.createElement('img');
        el.src = src.currentSrc || src.src; el.alt = src.alt || ''; el.decoding = 'async';
      }
      el.style.setProperty('--x', box[0] + '%'); el.style.setProperty('--y', box[1] + '%');
      el.style.setProperty('--w', box[2] + '%'); el.style.setProperty('--h', box[3] + '%');
      media.appendChild(el);
      if (el.tagName === 'VIDEO' && !reduce) {
        var p = el.play();
        if (p && p.catch) p.catch(function () { el.controls = true; });   // autoplay refused: hand over the controls
      }
    });
  }

  // ---- Thumbnails, drawn as they scroll into view ----
  var thumbBtns = [];
  var tio = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { tio.unobserve(en.target); thumbDraw(en.target); } });
  }, { root: thumbs, rootMargin: '0px 320px' }) : null;
  for (var n = 1; n <= last; n++) (function (n) {
    var b = thumbTpl.content.firstElementChild.cloneNode(true);
    b.dataset.n = n;
    b.setAttribute('aria-label', (b.getAttribute('aria-label') || '') + ' ' + n);
    b.querySelector('span').textContent = pad(n);
    if (clips[n]) b.classList.add('has-clip');
    b.addEventListener('click', function () { show(n); });
    thumbs.appendChild(b); thumbBtns.push(b);
    if (tio) tio.observe(b); else thumbDraw(b);
  })(n);
  async function thumbDraw(b) {
    try {
      var page = await doc.getPage(+b.dataset.n);
      var base = page.getViewport({ scale: 1 });
      var vp = page.getViewport({ scale: ((b.clientWidth || 144) / base.width) * dpr() });
      var c = b.querySelector('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await page.render({ canvas: c, canvasContext: c.getContext('2d', { alpha: false }), viewport: vp }).promise;
    } catch (e) { /* a thumbnail is decoration */ }
  }

  // ---- Controls ----
  prevBtns.forEach(function (b) { b.addEventListener('click', prev); });
  nextBtns.forEach(function (b) { b.addEventListener('click', next); });

  // Keys work while the deck is on screen (or in fullscreen), never while typing.
  var inView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { entries.forEach(function (en) { inView = en.isIntersecting; }); }, { threshold: .3 }).observe(stage);
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
    var fs = isFs();
    if (e.key === 'Escape' && viewer.classList.contains('is-theatre')) { theatre(false); return; }
    if (!inView && !fs) return;
    switch (e.key) {
      case 'ArrowRight': next(); break;
      case 'ArrowLeft': prev(); break;
      case 'Home': show(1, -1); break;
      case 'End': show(last, 1); break;
      case 'PageDown': if (fs) next(); else return; break;
      case 'PageUp': if (fs) prev(); else return; break;
      case 'f': case 'F': toggleFs(); break;
      default: return;
    }
    e.preventDefault();
  });

  // Swipe: a horizontal drag on the stage turns the slide; vertical scrolling is left to the page.
  // On a phone held upright in the theatre the body is turned on its side (see the CSS), so the
  // axes swap. A plain tap on a touch screen opens the theatre: the slide is too small to read.
  var turned = function () { return isFs() && matchMedia('(max-width: 47.99em) and (orientation: portrait)').matches; };
  var px = null, py = 0, dx = 0, dragging = false;
  stage.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.tagName === 'VIDEO' && e.target.controls) return;
    if (e.target.closest('button')) return;
    px = e.clientX; py = e.clientY; dx = 0; dragging = false;
  });
  stage.addEventListener('pointermove', function (e) {
    if (px === null) return;
    var ex = e.clientX - px, ey = e.clientY - py;
    if (turned()) { var t = ex; ex = ey; ey = -t; }
    dx = ex;
    if (!dragging && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(ey)) {
      dragging = true;
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    }
    if (dragging) slide.style.transform = 'translateX(' + (dx * .35).toFixed(1) + 'px)';
  });
  var release = function (e) {
    if (px === null) return;
    slide.style.transform = '';
    if (dragging) { if (Math.abs(dx) > Math.max(40, stage.clientWidth * .12)) { if (dx < 0) next(); else prev(); } }
    else if (e.type === 'pointerup' && e.pointerType !== 'mouse' && !isFs()) toggleFs();
    px = null; dragging = false;
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  // Fullscreen, or a fixed "theatre" overlay where the API is missing (iPhone).
  function isFs() { return document.fullscreenElement === viewer || viewer.classList.contains('is-theatre'); }
  // A phone in real fullscreen is asked to turn landscape (Android); where that is refused, the
  // stylesheet turns the body instead and nothing here needs to know.
  function landscape() {
    if (!matchMedia('(max-width: 47.99em)').matches) return;
    try { var p = screen.orientation.lock('landscape'); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  function fsLabel() {
    var on = isFs();
    fsBtn.querySelectorAll('span').forEach(function (s, i) { s.hidden = on ? i === 0 : i === 1; });
    fsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function theatre(on) {
    viewer.classList.toggle('is-theatre', on);
    document.documentElement.classList.toggle('is-theatre', on);
    fsLabel(); relayout();
  }
  function toggleFs() {
    viewer.classList.add('is-tapped');   // retires the "tap to enlarge" badge
    if (document.fullscreenElement === viewer) { document.exitFullscreen(); return; }
    if (viewer.classList.contains('is-theatre')) { theatre(false); return; }
    if (document.fullscreenEnabled && viewer.requestFullscreen) viewer.requestFullscreen().then(landscape, function () { theatre(true); });
    else theatre(true);
  }
  fsBtn.addEventListener('click', toggleFs);
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement) { try { screen.orientation.unlock(); } catch (e) {} }
    fsLabel(); relayout();
  });

  // Resize: redraw the slide in hand at the new width (the old canvas scales meanwhile).
  var rt;
  function relayout() {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var w = stage.clientWidth, n = cur;
      if (!w || w === cacheW || !n) return;
      render(n, w).then(function (c) { if (n === cur) { place(c); prefetch(n); } }).catch(function () {});
    }, 120);
  }
  addEventListener('resize', relayout);

  // ---- Go ----
  var m = /^#s(\d+)$/.exec(location.hash);
  await show(m ? clamp(+m[1], 1, last) : 1);
  if (m) viewer.scrollIntoView({ block: 'start' });
  // A #s<N> link followed inside the page (or the back button) turns to that slide too.
  addEventListener('hashchange', function () {
    var h = /^#s(\d+)$/.exec(location.hash);
    if (h && +h[1] !== cur) show(+h[1]);
  });
}
