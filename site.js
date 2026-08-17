(function () {
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
})();
