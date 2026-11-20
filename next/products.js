/* KOMTER v2: range page behaviour. Runs after site.js. Without GSAP the page still works: the family bar lights, scenes reveal by CSS. */
(function () {
  'use strict';
  var D = document, root = D.documentElement;
  var $ = function (s, c) { return (c || D).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || D).querySelectorAll(s)); };
  var bar = $('[data-jump]'), row = $('[data-jump-row]');
  var chips = $$('.chip', row), scenes = $$('[data-sc]');
  if (!bar || !chips.length) return;
  var hdrH = function () { return parseFloat(getComputedStyle(root).getPropertyValue('--hdr')) || 60; };

  /* lit chips: every scene crossing a one-pixel line just under the two sticky bars (two cards share a row on desktop, so two chips
     can light). A tapped chip stays lit until the page stops moving. The chip row moves by setting scrollLeft: a smooth scroll on the
     row makes Chromium cancel the page's own smooth scroll, which stalled taps on phones. */
  var crossing = {}, held = null, holdTimer = 0;
  function paint(ids) {
    var on = {};
    ids.forEach(function (i) { on[i] = 1; });
    chips.forEach(function (c) {
      var id = c.getAttribute('href').slice(1);
      if (on[id]) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
    });
    var first = chips.filter(function (c) { return on[c.getAttribute('href').slice(1)]; })[0];
    if (first && row.scrollWidth > row.clientWidth) {
      row.scrollLeft = Math.max(0, first.offsetLeft - (row.clientWidth - first.offsetWidth) / 2);
    }
  }
  function refresh() { paint(held ? [held] : Object.keys(crossing)); }
  function release() { held = null; clearTimeout(holdTimer); refresh(); }
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      held = c.getAttribute('href').slice(1); refresh();
      clearTimeout(holdTimer); holdTimer = setTimeout(release, 2600);
    });
  });
  addEventListener('scrollend', function () { if (held) { clearTimeout(holdTimer); holdTimer = setTimeout(release, 250); } });
  function lineTop() { return hdrH() + bar.offsetHeight + Math.round(innerHeight * 0.22); }
  var lineIo = null;
  function watch() {
    if (!('IntersectionObserver' in window)) return;
    if (lineIo) lineIo.disconnect();
    crossing = {};
    var top = lineTop();
    lineIo = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) crossing[e.target.id] = 1; else delete crossing[e.target.id]; });
      refresh();
    }, { rootMargin: '-' + top + 'px 0px -' + Math.max(0, innerHeight - top - 1) + 'px 0px' });
    scenes.forEach(function (s) { lineIo.observe(s); });
  }
  watch();
  addEventListener('resize', watch);

  /* machine loops run only while their scene is on screen */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('live', e.isIntersecting); }); }, { rootMargin: '10% 0px' });
    scenes.forEach(function (s) { io.observe(s); });
  }

  /* gentle parallax: each machine drifts a little against the scroll (transform only, off for reduced motion) */
  addEventListener('load', function () {
    var g = window.gsap, ST = window.ScrollTrigger;
    if (!g || !ST) return;
    g.matchMedia().add('(prefers-reduced-motion:no-preference) and (min-width:1024px)', function () {
      scenes.forEach(function (s) {
        var p = $('[data-par]', s);
        if (!p) return;
        g.fromTo(p, { yPercent: 7 }, { yPercent: -7, ease: 'none', scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
      });
    });
    ST.refresh();
  });
})();
