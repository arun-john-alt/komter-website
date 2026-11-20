/* KOMTER v2: shared behaviour. Plain script. GSAP, ScrollTrigger and Lenis are optional: without them (blocked CDN,
   reduced motion) every section stays visible and static, the range is a swipe row and links still work. */
(function () {
  'use strict';
  window.__komter = 1;
  var D = document, root = D.documentElement;
  root.classList.add('ready');   // fields and controls that need this script show only once it runs
  var $ = function (s, c) { return (c || D).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || D).querySelectorAll(s)); };
  var WA = '919840867322';
  var hdrH = function () { return parseFloat(getComputedStyle(root).getPropertyValue('--hdr')) || 60; };
  var wideMq = matchMedia('(min-width:1024px) and (prefers-reduced-motion:no-preference)');

  /* ---------- header: gradient blur and hairline after 8px ---------- */
  var hdr = $('[data-hdr]');
  function stuck() { if (hdr) hdr.classList.toggle('is-stuck', (window.pageYOffset || root.scrollTop) > 8); }
  addEventListener('scroll', stuck, { passive: true });
  stuck();

  /* ---------- menu (a details element, so it works without JS) ---------- */
  var menu = $('[data-menu]');
  if (menu) {
    var sum = $('summary', menu);
    // the open menu is a modal: everything behind it is inert, Tab wraps inside it, Escape closes and returns focus
    var behind = function () { return [$('main'), $('footer'), $('.util'), $('.skip')].concat($$('[data-hdr] > *:not([data-menu])')); };
    var setInert = function (on) { behind().forEach(function (e) { if (e) { if (on) e.setAttribute('inert', ''); else e.removeAttribute('inert'); } }); };
    var closeMenu = function () {
      menu.open = false; root.classList.remove('menu-open'); setInert(false);
      if (window.__lenis) window.__lenis.start();
    };
    menu.addEventListener('toggle', function () {
      root.classList.toggle('menu-open', menu.open); setInert(menu.open);
      if (window.__lenis) { if (menu.open) window.__lenis.stop(); else window.__lenis.start(); }
    });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', closeMenu); });
    D.addEventListener('keydown', function (e) {
      if (!menu.open) return;
      if (e.key === 'Escape') { closeMenu(); if (sum) sum.focus(); return; }
      if (e.key !== 'Tab') return;
      var links = $$('.menu-panel a', menu), first = sum, last = links[links.length - 1];
      if (!e.shiftKey && D.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && D.activeElement === first) { e.preventDefault(); last.focus(); }
    });
  }

  /* ---------- in-page anchors: one place decides where a link lands ---------- */
  // A pinned section (range, drivetrain) is reached at the START of its pin, never the end; other targets sit under the
  // sticky header (and the family bar on the range page). Works with Lenis, with native scroll, from any scroll position.
  var reduceMq = matchMedia('(prefers-reduced-motion:reduce)');
  var onIndex = /(^|\/)(index\.html)?$/.test(location.pathname);
  function pinFor(t) {
    var ST = window.ScrollTrigger; if (!ST) return null;
    var all = ST.getAll();
    for (var i = 0; i < all.length; i++) if (all[i].pin && all[i].trigger === t) return all[i];
    return null;
  }
  function targetY(t) {
    if (!t) return 0;
    var s = pinFor(t); if (s) return Math.max(0, s.start - 12);
    var jb = $('[data-jump]');
    // layout position, not the on-screen rect: a section still waiting to be revealed is shifted by its entrance transform
    var y = 0, n = t; while (n) { y += n.offsetTop; n = n.offsetParent; }
    return Math.max(0, y - (hdrH() + (jb ? jb.offsetHeight : 0) + 8));
  }
  function go(t, instant) {
    var y = targetY(t);
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: !!instant || reduceMq.matches, force: true, duration: 1.4 });
    else scrollTo({ top: y, behavior: (instant || reduceMq.matches) ? 'auto' : 'smooth' });
  }
  D.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    var href = a.getAttribute('href'), hash = null;
    if (href.charAt(0) === '#') hash = href;
    else if (onIndex && href.indexOf('index.html#') === 0) hash = href.slice(10);
    if (hash === null) return;
    var id = hash.slice(1), t = id ? D.getElementById(id) : null;
    if (id && !t) return;
    e.preventDefault();
    go(t, false);
    try { history.pushState(null, '', id ? '#' + id : location.pathname + location.search); } catch (x) { /* file or sandbox */ }
  });
  addEventListener('hashchange', function () { var t = location.hash.length > 1 && D.getElementById(location.hash.slice(1)); if (t) go(t, true); });

  /* ---------- reveals: one way, never hidden again ---------- */
  $$('[data-stagger]').forEach(function (p) {
    $$('.rv', p).forEach(function (c, i) { c.style.setProperty('--d', Math.min(i, 7) * 70 + 'ms'); });
  });
  // elements in a staggered group (a swipe row, the videos) all arrive when their group does, so none wait off screen
  var groups = $$('[data-stagger]');
  var rvs = $$('.rv').filter(function (e) { return !groups.some(function (g) { return g.contains(e); }); });
  if (!('IntersectionObserver' in window)) {
    $$('.rv').forEach(function (e) { e.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in'); if (e.target.hasAttribute('data-stagger')) $$('.rv', e.target).forEach(function (c) { c.classList.add('in'); });
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    groups.forEach(function (gr) { io.observe(gr); });
    rvs.forEach(function (e) {
      if (e.hasAttribute('data-pin') && wideMq.matches) return;   // the pinned drivetrain scene reveals these by scroll progress
      io.observe(e);
    });
  }

  /* ---------- hero: pause the loops when it is off screen ---------- */
  var hero = $('[data-hero]');
  if ('IntersectionObserver' in window) {
    [hero, $('[data-drive]')].forEach(function (el) {
      if (el) new IntersectionObserver(function (es) { el.classList.toggle('off', !es[0].isIntersecting); }).observe(el);
    });
  }

  /* ---------- video facades: the YouTube player loads only on tap ---------- */
  $$('.vid').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var box = a.parentNode, f = D.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + a.getAttribute('data-id') + '?autoplay=1&rel=0';
      f.title = a.getAttribute('data-title') || 'Customer video';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.setAttribute('allowfullscreen', '');
      box.replaceChild(f, a);
      f.focus();
    });
  });

  /* ---------- logo marquee: a pause control (hover and focus also pause, in CSS) ---------- */
  var mp = $('[data-marq-pause]');
  if (mp) {
    mp.addEventListener('click', function () {
      var on = mp.getAttribute('aria-pressed') !== 'true';
      mp.setAttribute('aria-pressed', String(on));
      mp.textContent = on ? 'Play logos' : 'Pause logos';
      $$('[data-marq]').forEach(function (m) { m.classList.toggle('paused', on); });
    });
  }

  /* ---------- WhatsApp enquiry builder ---------- */
  var form = $('#enq');
  if (form) {
    var line = $('#enq-line'), req = $('#enq-req'), loc = $('#enq-loc'), send = $('#enq-send'), note = $('#enq-preview');
    var clean = function (s) { return (s || '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, ''); };
    var build = function () {
      var l = clean(line.value), r = clean(req.value), p = clean(loc.value);
      var msg = l ? 'Hello Komter, I\'d like a quote for ' + l + '.' : 'Hello Komter, I\'d like help choosing an air compressor.';
      if (r) msg += ' Requirement: ' + r + '.';
      if (p) msg += ' Location: ' + p + '.';
      send.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg);
      note.textContent = 'Your message: ' + msg;
    };
    [line, req, loc].forEach(function (el) { el.addEventListener('input', build); el.addEventListener('change', build); });
    form.addEventListener('submit', function (e) { e.preventDefault(); build(); window.open(send.href, '_blank', 'noopener'); });
    build();
  }

  /* ---------- the way-of-working path, built from the node positions ---------- */
  var road = $('[data-road]'), nodes = road ? $$('.node', road) : [];
  var rb = road && $('.road-base', road), rl = road && $('.road-lit', road), rm = road && $('.road-m', road);
  var roadLen = 0;
  function buildRoad() {
    if (!road || !rb) return;
    var box = road.getBoundingClientRect(), vertical = getComputedStyle(road.querySelector('.nodes')).display !== 'grid' || getComputedStyle(road.querySelector('.nodes')).gridTemplateColumns.split(' ').length < 3;
    var pts = nodes.map(function (n) {
      var r = $('.dot', n).getBoundingClientRect();
      return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
    });
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      if (vertical) { var my = (a[1] + b[1]) / 2; d += ' C' + a[0].toFixed(1) + ' ' + my.toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + my.toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1); }
      else { var mx = (a[0] + b[0]) / 2; d += ' C' + mx.toFixed(1) + ' ' + a[1].toFixed(1) + ' ' + mx.toFixed(1) + ' ' + b[1].toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1); }
    }
    [rb, rl, rm].forEach(function (p) { p.setAttribute('d', d); });
    roadLen = rm.getTotalLength();
  }
  function nodesOn(all) { nodes.forEach(function (n, i) { if (all || i === 0) n.classList.add('on'); }); }
  function fontsThen(fn) { if (D.fonts && D.fonts.ready) D.fonts.ready.then(fn); else addEventListener('load', fn); }
  if (road) { buildRoad(); fontsThen(buildRoad); }

  /* ---------- GSAP layer ---------- */
  var g = window.gsap, ST = window.ScrollTrigger;
  if (!g || !ST || matchMedia('(prefers-reduced-motion:reduce)').matches) { nodesOn(true); $$('[data-pin]').forEach(function (e) { e.classList.add('in'); }); if (!g || !ST) return; }
  g.registerPlugin(ST);
  var mm = g.matchMedia();

  mm.add({ ok: '(prefers-reduced-motion:no-preference)', wide: '(min-width:1024px)', fine: '(hover:hover) and (pointer:fine)' }, function (ctx) {
    var c = ctx.conditions, undo = [];
    if (!c.ok) { nodesOn(true); return; }

    /* smooth inertial scroll on desktop mice and trackpads only */
    var lenis = null;
    if (c.wide && c.fine && window.Lenis) {
      lenis = new window.Lenis({ duration: 1.1, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
      window.__lenis = lenis;
      lenis.on('scroll', ST.update);
      var tick = function (t) { lenis.raf(t * 1000); };
      g.ticker.add(tick); g.ticker.lagSmoothing(0);
      undo.push(function () { g.ticker.remove(tick); lenis.destroy(); window.__lenis = null; });
    }
    var jump = function (y) { if (lenis) lenis.scrollTo(y, { immediate: true }); else scrollTo(0, y); };

    /* hero: the machine rises and grows as you scroll past; the headline drifts slower */
    var hm = $('[data-hero-mach]'), h1 = $('.h1');
    if (hero && hm) {
      // momentum scrolling on touch fights a smoothed scrub, so touch scrubs 1:1 and only the machine moves
      var base = { trigger: hero, start: 'top top', end: 'bottom top', scrub: c.fine ? 0.6 : true };
      g.fromTo(hm, { y: 0, scale: 1 }, { y: function () { return -hero.offsetHeight * 0.16; }, scale: 1.16, ease: 'none', scrollTrigger: base, invalidateOnRefresh: true });
      if (c.fine) g.to(h1, { y: function () { return hero.offsetHeight * 0.1; }, ease: 'none', scrollTrigger: base, invalidateOnRefresh: true });
    }

    /* range: tall cards on a track pinned and driven by vertical scroll (desktop); a swipe row elsewhere */
    var range = $('[data-range]'), track = $('[data-track]'), prog = $('[data-prog]');
    if (range && track && c.wide) {
      range.classList.add('is-pinned');
      var vp = $('.range-vp', range);
      var travel = function () { return Math.max(0, track.scrollWidth - vp.clientWidth); };
      var rt = g.to(track, {
        x: function () { return -travel(); }, ease: 'none',
        scrollTrigger: {
          trigger: range, start: function () { return 'top ' + hdrH(); }, end: function () { return '+=' + Math.round(travel() * 0.8); },
          pin: true, scrub: lenis ? true : 0.5, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: function (s) { if (prog) prog.style.transform = 'scaleX(' + s.progress.toFixed(4) + ')'; }
        }
      });
      var st = rt.scrollTrigger;
      /* keyboard: focusing a card that is off screen moves the page to where the track shows it */
      var onFocus = function (e) {
        var li = e.target.closest && e.target.closest('.track>li');
        if (!li || !travel()) return;
        var want = Math.min(travel(), Math.max(0, li.offsetLeft - parseFloat(getComputedStyle(root).getPropertyValue('--gut') || 40)));
        jump(st.start + (want / travel()) * (st.end - st.start));
      };
      track.addEventListener('focusin', onFocus);
      undo.push(function () {
        track.removeEventListener('focusin', onFocus);
        range.classList.remove('is-pinned'); if (prog) prog.style.transform = '';
      });
    }

    /* drivetrain scene: pinned on desktop; the machine grows, the four spec cards arrive one by one and stay */
    var drive = $('[data-drive]'), dm = $('[data-drive-mach] img'), specs = $$('[data-specs] .spec');
    if (drive && c.wide) {
      drive.classList.add('is-pinned');
      var dist = function () { return Math.round(innerHeight * 1.7); };
      var marks = [0.06, 0.24, 0.42, 0.6];
      ST.create({
        trigger: drive, start: function () { return 'top ' + hdrH(); }, end: function () { return '+=' + dist(); }, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: function (s) { specs.forEach(function (el, i) { if (s.progress >= marks[i]) el.classList.add('in'); }); }
      });
      if (dm) g.fromTo(dm, { scale: 0.9, xPercent: 5 }, { scale: 1.07, xPercent: -2, ease: 'none',
        scrollTrigger: { trigger: drive, start: function () { return 'top ' + hdrH(); }, end: function () { return '+=' + dist(); }, scrub: 0.6, invalidateOnRefresh: true } });
      undo.push(function () { drive.classList.remove('is-pinned'); specs.forEach(function (el) { el.classList.add('in'); }); });
    }

    /* way of working: the dashed path draws itself, nodes pop as it reaches them */
    if (road && rm) {
      nodesOn(false);
      var th = nodes.map(function (n, i) { return i / (nodes.length - 1) * 0.97; });
      var draw = function () { rm.style.strokeDasharray = roadLen + ' ' + roadLen; };
      draw();
      ST.addEventListener('refreshInit', function () { buildRoad(); draw(); });
      g.fromTo(rm, { strokeDashoffset: function () { return roadLen; } }, { strokeDashoffset: 0, ease: 'none',
        scrollTrigger: { trigger: road, start: 'top 68%', end: function () { return 'bottom ' + (c.wide ? '62%' : '58%'); }, scrub: 0.5, invalidateOnRefresh: true,
          onUpdate: function (s) { nodes.forEach(function (n, i) { if (s.progress >= th[i]) n.classList.add('on'); }); } } });
      undo.push(function () { rm.style.strokeDasharray = ''; rm.style.strokeDashoffset = ''; nodesOn(true); });
    }

    /* numbers count up once */
    $$('.count').forEach(function (el) {
      var to = +el.getAttribute('data-to'), o = { v: 0 };
      var from = Math.floor(to * 0.35);   // the real value stays in the page; the count starts near it, never blank
      ST.create({ trigger: el, start: 'top 88%', once: true, onEnter: function () {
        o.v = from; el.textContent = from;
        g.to(o, { v: to, duration: 1.9, ease: 'power3.out', onUpdate: function () { el.textContent = Math.round(o.v); }, onComplete: function () { el.textContent = to; } });
      } });
      undo.push(function () { el.textContent = to; });
    });

    /* fine pointers: soft tilt on range cards, magnetic WhatsApp pills */
    if (c.fine) {
      $$('.card').forEach(function (card) {
        if (card.classList.contains('card-end')) return;
        var raf = 0, ev;
        var move = function (e) {
          ev = e; if (raf) return;
          raf = requestAnimationFrame(function () {
            raf = 0; var r = card.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
            card.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg'); card.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg');
          });
        };
        var leave = function () { card.style.setProperty('--ry', '0deg'); card.style.setProperty('--rx', '0deg'); };
        card.addEventListener('pointermove', move); card.addEventListener('pointerleave', leave);
        undo.push(function () { card.removeEventListener('pointermove', move); card.removeEventListener('pointerleave', leave); leave(); });
      });
      $$('.pill-mag').forEach(function (p) {
        var qx = g.quickTo(p, 'x', { duration: 0.5, ease: 'power3.out' }), qy = g.quickTo(p, 'y', { duration: 0.5, ease: 'power3.out' });
        var m = function (e) {
          var r = p.getBoundingClientRect();
          qx(Math.max(-9, Math.min(9, (e.clientX - (r.left + r.width / 2)) * 0.22)));
          qy(Math.max(-7, Math.min(7, (e.clientY - (r.top + r.height / 2)) * 0.28)));
        };
        var out = function () { qx(0); qy(0); };
        p.addEventListener('pointermove', m); p.addEventListener('pointerleave', out);
        undo.push(function () { p.removeEventListener('pointermove', m); p.removeEventListener('pointerleave', out); out(); });
      });
    }

    return function () { undo.forEach(function (f) { f(); }); };
  });

  /* a direct link with a #hash: land once the pins exist, then again after late layout */
  addEventListener('load', function () {
    ST.refresh();
    var t = location.hash.length > 1 && D.getElementById(location.hash.slice(1));
    if (t) { setTimeout(function () { go(t, true); }, 60); setTimeout(function () { ST.refresh(); go(t, true); }, 600); }
  });
})();
