(function () {
  // Language: remember an explicit choice so the head redirect (see <head>) respects it.
  document.querySelectorAll('[data-lang-switch]').forEach(function (a) {
    a.addEventListener('click', function () {
      try { localStorage.setItem('lang', a.getAttribute('hreflang') || 'es'); } catch (e) {}
    });
  });
  try {
    // Landing directly on /en/ (search, shared link) counts as a preference too.
    if (/\/en\//.test(location.pathname) && !localStorage.getItem('lang')) localStorage.setItem('lang', 'en');
  } catch (e) {}

  // Lazy images: reveal with a fade once decoded (see style.css `html.js img[loading="lazy"]`).
  document.documentElement.classList.add('js');
  document.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
    var done = function () { img.classList.add('is-loaded'); };
    if (img.complete && img.naturalWidth) done();
    else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
  });

  // Mobile nav
  var nav = document.querySelector('.nav');
  var btn = document.querySelector('.nav__toggle');
  if (btn) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.nav__menu a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); });
    });
  }

  // Scroll reveal
  var els = document.querySelectorAll('.reveal');
  if (els.length) {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(function (e) { e.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      els.forEach(function (e) { io.observe(e); });
    }
  }

  // ---------------------------------------------------------------------------
  // Reactive layer. Everything below is decorative and skipped when the user
  // prefers reduced motion or the device has no fine pointer where relevant.
  // ---------------------------------------------------------------------------
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };

  // Scroll progress hairline
  if (!reduce) {
    var bar = document.createElement('div');
    bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var pTick = false;
    var onScrollP = function () {
      if (pTick) return; pTick = true;
      raf(function () {
        var h = document.documentElement;
        var max = h.scrollHeight - h.clientHeight;
        bar.style.setProperty('--p', max > 0 ? Math.min(1, h.scrollTop / max).toFixed(4) : 0);
        pTick = false;
      });
    };
    addEventListener('scroll', onScrollP, { passive: true }); onScrollP();
  }

  // Plates: parallax on scroll + torch under the pointer
  var plates = Array.prototype.slice.call(document.querySelectorAll('.plate:not(.plate--pin)'));
  if (plates.length && !reduce) {
    var pl = plates.map(function (p) { return { el: p, img: p.querySelector('.plate__img img') }; }).filter(function (o) { return o.img; });
    var plTick = false;
    var onScrollPl = function () {
      if (plTick) return; plTick = true;
      raf(function () {
        var vh = innerHeight;
        pl.forEach(function (o) {
          var r = o.el.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) return;
          // -1 (below viewport) → 1 (above). Range ±6% of the plate height, clamped.
          var t = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
          o.img.style.setProperty('--py', (t * Math.min(r.height * .06, 60)).toFixed(1) + 'px');
        });
        plTick = false;
      });
    };
    addEventListener('scroll', onScrollPl, { passive: true }); addEventListener('resize', onScrollPl); onScrollPl();
  }
  if (fine) {
    document.querySelectorAll('.plate').forEach(function (p) {
      var im = p.querySelector('.plate__img'); if (!im) return;
      p.addEventListener('pointermove', function (e) {
        var r = p.getBoundingClientRect();
        im.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        im.style.setProperty('--my', (e.clientY - r.top) + 'px');
        im.style.setProperty('--torch', 1);
      });
      p.addEventListener('pointerleave', function () { im.style.setProperty('--torch', 0); });
    });
  }

  // Tilt: cards lean toward the pointer
  if (fine && !reduce) {
    document.querySelectorAll('.tilt').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.classList.add('is-tilting');
        c.style.setProperty('--ry', ((x - .5) * 6).toFixed(2) + 'deg');
        c.style.setProperty('--rx', ((.5 - y) * 6).toFixed(2) + 'deg');
        c.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        c.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      });
      c.addEventListener('pointerleave', function () {
        c.classList.remove('is-tilting');
        c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg');
      });
    });
    // Hero key art drifts with the pointer
    var hero = document.querySelector('.hero'), hImg = hero && hero.querySelector('.hero__media img');
    if (hImg) {
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        hImg.style.setProperty('--hx', (((e.clientX - r.left) / r.width - .5) * -18).toFixed(1) + 'px');
        hImg.style.setProperty('--hy', (((e.clientY - r.top) / r.height - .5) * -12).toFixed(1) + 'px');
      });
      hero.addEventListener('pointerleave', function () { hImg.style.setProperty('--hx', '0px'); hImg.style.setProperty('--hy', '0px'); });
    }
  }

  // Home emblem: the seal leans toward whatever the visitor is driving it with; the three black
  // cuts behind it pull the other way (--gx/--gy), and the centre one pulls against the two at
  // the edges. Nothing rotates. Four drivers feed the same two numbers (x, y in -0.5..0.5):
  //   · pointer  — desktop, a fine pointer over the section
  //   · touch    — a finger dragged anywhere over the section (scroll is never blocked)
  //   · tilt     — the device's own gyroscope, where the browser hands it over unprompted
  //   · scroll   — the universal floor: every phone, every browser, no permission, no sensor
  var mark = document.querySelector('.hero--mark .mark');
  if (mark) {
    var markHero = mark.closest('.hero');
    var clamp = function (v) { return v < -.5 ? -.5 : (v > .5 ? .5 : v); };
    // The seal reads --sx/--sy/--srx/--sry, the sigils and the HUD read --gx/--gy.
    var lean = function (x, y) {
      markHero.style.setProperty('--sx', (x * 18).toFixed(1) + 'px');
      markHero.style.setProperty('--sy', (y * 13).toFixed(1) + 'px');
      markHero.style.setProperty('--sry', (x * 9).toFixed(2) + 'deg');
      markHero.style.setProperty('--srx', (-y * 9).toFixed(2) + 'deg');
      markHero.style.setProperty('--gx', (x * -22).toFixed(1) + 'px');
      markHero.style.setProperty('--gy', (y * -16).toFixed(1) + 'px');
    };
    var lx = 0, ly = 0, leanTick = false;
    var aim = function (x, y) {                 // one style write per frame, whoever is driving
      lx = clamp(x); ly = clamp(y);
      if (leanTick) return; leanTick = true;
      raf(function () { lean(lx, ly); leanTick = false; });
    };

    if (fine && !reduce) {
      markHero.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;  // hybrid laptops: the touch driver owns those
        var r = markHero.getBoundingClientRect();
        aim((e.clientX - r.left) / r.width - .5, (e.clientY - r.top) / r.height - .5);
      });
      markHero.addEventListener('pointerleave', function () { aim(0, 0); });
    }

    // Coarse pointer (phones, tablets, anything with a touchscreen). Feature-detected rather
    // than sniffed, so it holds on any browser/OS combination, and it degrades one step at a
    // time: no gyroscope still scrolls, no Pointer Events still gets touch events.
    var touchy = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 ||
                 (window.matchMedia && matchMedia('(pointer: coarse)').matches);
    if (touchy && !reduce) {
      var lastTouch = -1e9;
      var now = function () { return (window.performance && performance.now) ? performance.now() : +new Date(); };
      // Tilt and scroll add up, so a phone lying flat on a table still moves when it is scrolled
      // and a phone held still moves when it is turned. A finger overrides both while it is down.
      var tiltX = 0, tiltY = 0, scrX = 0, scrY = 0;
      var compose = function () {
        if (now() - lastTouch < 1400) return;
        aim(tiltX + scrX, tiltY + scrY);
      };

      // 1. Finger drag. Passive listeners only: the page keeps scrolling underneath.
      var dragAt = function (p) {
        var r = markHero.getBoundingClientRect();
        lastTouch = now();
        markHero.classList.add('is-dragging');   // shortens the transitions: a finger wants no lag
        aim((p.clientX - r.left) / r.width - .5, (p.clientY - r.top) / r.height - .5);
      };
      var drop = function () {
        markHero.classList.remove('is-dragging');
        setTimeout(compose, 1450);               // hand the seal back to tilt/scroll once let go
      };
      if (window.PointerEvent) {
        markHero.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') dragAt(e); }, { passive: true });
        markHero.addEventListener('pointermove', function (e) { if (e.pointerType !== 'mouse') dragAt(e); }, { passive: true });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { markHero.addEventListener(t, drop, { passive: true }); });
      } else {
        markHero.addEventListener('touchstart', function (e) { if (e.touches[0]) dragAt(e.touches[0]); }, { passive: true });
        markHero.addEventListener('touchmove', function (e) { if (e.touches[0]) dragAt(e.touches[0]); }, { passive: true });
        ['touchend', 'touchcancel'].forEach(function (t) { markHero.addEventListener(t, drop, { passive: true }); });
      }

      // 2. Gyroscope, when the browser gives it without asking (Android/Chrome, and iOS once
      //    motion access has been granted). No permission prompt is raised: 3. covers those.
      var base = null, tTick = false;
      var onTilt = function (e) {
        var g = e.gamma, b = e.beta;
        if (g === null || g === undefined || b === null || b === undefined) return;
        if (tTick) return; tTick = true;
        raf(function () {
          tTick = false;
          // Landscape swaps the two axes, so the emblem leans where the phone leans either way.
          var ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
          var x = g, y = b;
          if (ang === 90) { x = b; y = -g; }
          else if (ang === -90 || ang === 270) { x = -b; y = g; }
          if (base === null) base = y;          // calibrate to however the phone is being held
          tiltX = clamp(x / 45) * .7;
          tiltY = clamp((y - base) / 45) * .7;
          compose();
        });
      };
      addEventListener('deviceorientation', onTilt, true);
      // Recalibrate when the phone is turned, so "upright" is wherever it now is.
      addEventListener('orientationchange', function () { base = null; });

      // 3. Scroll. Always there, on every device: the seal drifts as the hero leaves the screen.
      var sTick = false;
      var onScrollMark = function () {
        if (sTick) return; sTick = true;
        raf(function () {
          sTick = false;
          var r = markHero.getBoundingClientRect();
          if (r.bottom < 0 || r.top > innerHeight) return;
          var p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
          scrX = Math.sin(p * Math.PI) * .3;   // sways out and back as the hero passes
          scrY = p * .55;                      // and settles downward: 0 at rest, so it starts still
          compose();
        });
      };
      addEventListener('scroll', onScrollMark, { passive: true });
      addEventListener('resize', onScrollMark);
      onScrollMark();
    }

    // Press it and the seal rings.
    mark.addEventListener('pointerdown', function () {
      if (reduce) return;
      mark.classList.remove('is-pinging');
      void mark.offsetWidth;   // restart the animation on a repeated press
      mark.classList.add('is-pinging');
    });
  }

  // Decode: mono kickers resolve from noise into text the first time they enter view
  if (!reduce && 'IntersectionObserver' in window) {
    var GLYPHS = '▓▒░#%&/<>[]{}=+*·:;0123456789ABCDEFXYZ';
    var kick = document.querySelectorAll('main p.meta, .purpose__credit');
    var dio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        dio.unobserve(en.target);
        var walker = document.createTreeWalker(en.target, NodeFilter.SHOW_TEXT);
        var nodes = [], n;
        while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push({ node: n, text: n.nodeValue });
        var t0 = null, dur = 900;
        var step = function (ts) {
          if (t0 === null) t0 = ts;
          var k = Math.min(1, (ts - t0) / dur);
          nodes.forEach(function (o) {
            var out = '', L = o.text.length, cut = Math.floor(L * k * 1.15);
            for (var i = 0; i < L; i++) {
              var ch = o.text[i];
              out += (i < cut || ch === ' ' || ch === '·') ? ch : GLYPHS[(i * 7 + Math.floor(ts / 40)) % GLYPHS.length];
            }
            o.node.nodeValue = out;
          });
          if (k < 1) raf(step); else nodes.forEach(function (o) { o.node.nodeValue = o.text; });
        };
        raf(step);
      });
    }, { threshold: .4 });
    kick.forEach(function (k) { dio.observe(k); });
  }

  // Subnav: highlight current section
  var sub = document.querySelector('.subnav');
  if (sub && 'IntersectionObserver' in window) {
    var links = Array.prototype.slice.call(sub.querySelectorAll('a[href^="#"]'));
    var map = {};
    links.forEach(function (a) { var t = document.querySelector(a.getAttribute('href')); if (t) map[t.id] = a; });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (a) { a.removeAttribute('aria-current'); });
          map[en.target.id].setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    Object.keys(map).forEach(function (id) { so.observe(document.getElementById(id)); });
  }

  // ---------------------------------------------------------------------------
  // Atribución. El primer toque de la visita (etiquetas UTM, click ids,
  // referente, página de entrada) se guarda en sessionStorage y se adjunta al
  // formulario que el visitante envíe, de modo que un publisher que llega por
  // un enlace de pitch se identifica en la bandeja. Sin cookies, sin terceros,
  // sin nada que sobreviva a la pestaña.
  // ---------------------------------------------------------------------------
  var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                   'ref', 'gclid', 'fbclid', 'msclkid', 'ttclid'];
  var attribution = (function () {
    var STORE = 'iterum.attr', saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch (e) {}

    var q = new URLSearchParams(location.search), fresh = {}, tagged = false;
    ATTR_KEYS.forEach(function (k) {
      var v = q.get(k);
      if (v) { fresh[k] = v.slice(0, 120); tagged = true; }
    });

    // First touch wins: sólo se sobreescribe si este hit trae etiquetas nuevas.
    if (!saved || tagged) {
      saved = fresh;
      saved.landing = (location.pathname + location.search).slice(0, 300);
      var r = document.referrer || '';
      saved.referrer = r && r.indexOf(location.origin) !== 0 ? r.slice(0, 300) : '';
      try { sessionStorage.setItem(STORE, JSON.stringify(saved)); } catch (e) {}
    }
    return saved;
  })();

  document.querySelectorAll('form[data-attribution]').forEach(function (form) {
    form.addEventListener('submit', function () {
      var set = function (name, value) {
        var el = form.querySelector('input[type="hidden"][name="' + name + '"]');
        if (el) el.value = value || '';
      };
      set('origen', ATTR_KEYS.map(function (k) {
        return attribution[k] ? k.replace(/^utm_/, '') + '=' + attribution[k] : null;
      }).filter(Boolean).join(' · ') || 'directo');
      set('referente', attribution.referrer || (document.referrer ? '' : 'sin referente'));
      set('entrada', attribution.landing);
      set('pagina', location.pathname);
      set('idioma', document.documentElement.lang || '');
    }, true);
  });
})();
