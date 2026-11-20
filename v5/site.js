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
      f.title = a.getAttribute('data-title') || 'Video from Komter\'s YouTube channel';
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
    [rb, rl, rm, $('.road-pulse', road)].forEach(function (p) { if (p) p.setAttribute('d', d); });
    roadLen = rm.getTotalLength();
  }
  function nodesOn(all) { nodes.forEach(function (n, i) { if (all || i === 0) n.classList.add('on'); }); if (all && road) road.classList.add('flow'); }
  function fontsThen(fn) { if (D.fonts && D.fonts.ready) D.fonts.ready.then(fn); else addEventListener('load', fn); }
  if (road) { buildRoad(); fontsThen(buildRoad); }

  /* ================= version 5: turntables, the showroom parade, airflow =================
     Plain script, above the GSAP gate, so all of it runs with the CDN blocked too. Reduced motion: static. */
  var RM = reduceMq.matches;
  var fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var watch = function (el, fn, opt) { if (!el) return; if (!hasIO) { fn(true, el); return; } new IntersectionObserver(function (es) { es.forEach(function (e) { fn(e.isIntersecting, e.target); }); }, opt).observe(el); };

  /* ---------- turntable: CSS swings it; a pointer or a finger takes over and a spring hands it back ---------- */
  var held = [], springRaf = 0, springT = 0;
  function angleOf(el) {
    var m = /matrix3d\(([^)]+)\)/.exec(getComputedStyle(el).transform || '');
    if (!m) return 0;
    var v = m[1].split(',').map(parseFloat);
    return Math.atan2(-v[2], v[0]) * 180 / Math.PI;
  }
  function TT(el) {
    var o = { el: el, spin: $('.spin', el), sh: $('.sheen i', el), fl: $('.tt-floor', el), img: $('img', el), a: 0, v: 0, target: 0, held: false, back: false };
    // the sheen is masked by the machine's own image: the file already loaded, so it costs no extra download
    var mask = function () { var u = o.img.currentSrc || o.img.src; if (u) { el.style.setProperty('--m', 'url("' + u + '")'); el.classList.add('has-m'); } };
    if (o.img.complete && o.img.naturalWidth) mask(); else o.img.addEventListener('load', mask);
    el.__tt = o;
    return o;
  }
  function ttLive(o, on) { if (o) o.el.classList.toggle('live', !!on && !RM); }
  function ttApply(o) {
    var p = Math.max(0, Math.min(1, (o.a + 22) / 44));
    o.spin.style.transform = 'rotateY(' + o.a.toFixed(2) + 'deg)';
    if (o.sh) o.sh.style.transform = 'translateX(' + (-110 + p * 340).toFixed(1) + '%)';
    if (o.fl) o.fl.style.transform = 'translateX(' + (5 - p * 10).toFixed(2) + '%) scaleX(.92)';
  }
  function ttHold(o) {
    o.back = false;
    if (o.held) return;
    o.a = angleOf(o.spin); o.v = 0; o.target = o.a; o.held = true;
    o.el.classList.add('held'); ttApply(o);
    held.push(o); spring();
  }
  function ttRelease(o) { if (o && o.held) { o.target = 0; o.back = true; spring(); } }
  function spring() { if (!springRaf) { springT = performance.now(); springRaf = requestAnimationFrame(springStep); } }
  function springStep(now) {
    var dt = Math.min(0.05, (now - springT) / 1000); springT = now; springRaf = 0;
    held = held.filter(function (o) {
      o.v += (90 * (o.target - o.a) - 15 * o.v) * dt; o.a += o.v * dt;
      ttApply(o);
      if (o.back && Math.abs(o.a) < 0.5 && Math.abs(o.v) < 4) {
        // back at 0 deg: the CSS swing restarts from its mid point, which is 0 deg, so nothing jumps
        o.held = false; o.back = false; o.spin.style.transform = ''; if (o.sh) o.sh.style.transform = ''; if (o.fl) o.fl.style.transform = '';
        o.el.classList.remove('held');
        return false;
      }
      return true;
    });
    if (held.length) springRaf = requestAnimationFrame(springStep);
  }
  // fine pointer: the angle follows the pointer across `zone` (+-28 deg). Touch (opt.drag): a sideways drag turns it,
  // vertical scrolling is left to the browser (touch-action: pan-y).
  function ttInput(zone, get, opt) {
    if (RM || !zone) return;
    opt = opt || {};
    if (fine) {
      zone.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var o = get(); if (!o) return;
        var r = o.el.getBoundingClientRect(), x = (e.clientX - (r.left + r.width / 2)) / Math.max(120, r.width / 2);
        ttHold(o); o.target = Math.max(-28, Math.min(28, x * 28));
      });
      zone.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') ttRelease(get()); });
    }
    if (!opt.drag) return;
    var ds = null;
    zone.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') ds = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false }; });
    zone.addEventListener('pointermove', function (e) {
      if (!ds || e.pointerId !== ds.id) return;
      var dx = e.clientX - ds.x, dy = e.clientY - ds.y, o = get();
      if (!ds.on) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2 && o) { ds.on = true; ttHold(o); ds.a0 = o.a; ds.o = o; if (opt.start) opt.start(); }
        else if (Math.abs(dy) > 12) ds = null;
        return;
      }
      ds.o.target = Math.max(-28, Math.min(28, ds.a0 + dx * 0.3));
    });
    var end = function (e) {
      if (!ds) return;
      var d = ds; ds = null;
      if (!d.on) return;
      ttRelease(d.o);
      if (opt.end) opt.end(e.clientX - d.x);
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  }

  /* ---------- hero: the showroom parade, all 14 lines one by one ---------- */
  // Controls: Prev, Pause/Play and Next buttons (arrow keys move while they have focus). The tick strip is a visual
  // indicator only (hidden from screen readers, out of the tab order) that pointer users can still tap.
  var show = $('[data-show]'), stage = $('[data-stage]');
  if (show && stage) (function () {
    var caps = $$('[data-cap]', show), ticks = $$('.tick', show), n = caps.length, cur = 0, items = [], seen = false, hold = 4200;
    var first = $('[data-pm]', stage), sizes = $('img', first).getAttribute('sizes'), ring = $('.stage-ring', stage);
    var bPrev = $('[data-prev]', show), bPlay = $('[data-play]', show), bNext = $('[data-next]', show), ctl = $('.show-ctl', show);
    show.style.setProperty('--hold', hold + 'ms');
    items[0] = { fig: first, tt: TT($('.tt', first)), ready: Promise.resolve() };
    // the rest are created only just ahead of their turn, and shown only once decoded
    function make(i) {
      if (items[i]) return items[i];
      var c = caps[i], w = +c.getAttribute('data-w'), h = +c.getAttribute('data-h'), fig = D.createElement('figure');
      fig.className = 'pm'; fig.setAttribute('data-pm', '');
      fig.innerHTML = '<div class="pm-par"><span class="tt tt-hero" style="--ar:' + (w / h).toFixed(4) + ';--nw:' + w + '">' +
        '<span class="tt-floor" aria-hidden="true"></span><span class="spin"><img width="' + w + '" height="' + h + '" decoding="async"><span class="sheen" aria-hidden="true"><i></i></span></span></span></div>';
      var img = $('img', fig);
      img.alt = c.getAttribute('data-alt'); img.crossOrigin = 'anonymous'; img.sizes = sizes; img.srcset = c.getAttribute('data-srcset');
      stage.appendChild(fig);
      var it = { fig: fig, tt: TT($('.tt', fig)) };
      it.ready = (img.decode ? img.decode() : Promise.resolve()).catch(function () {});
      return (items[i] = it);
    }
    function live() { items.forEach(function (o, k) { if (o) ttLive(o.tt, k === cur && seen && !show._user); }); }
    var ahead = 0, glowT = 0;
    function go(i) {
      i = (i + n) % n;
      if (i === cur) return;
      cur = i;
      var it = make(i);
      it.ready.then(function () {
        if (cur !== i) return;
        // one handover: the outgoing machine leaves first (.3 s), the next one sets down on the same turntable after it
        items.forEach(function (o, k) {
          if (!o || k === i || !o.fig.classList.contains('is-on')) return;
          o.fig.classList.remove('is-on'); o.fig.classList.add('is-out');
          setTimeout(function () { o.fig.classList.remove('is-out'); }, 700);
        });
        it.fig.classList.remove('is-out'); it.fig.classList.add('is-on');
        if (ring && !RM) { ring.classList.add('glow'); clearTimeout(glowT); glowT = setTimeout(function () { ring.classList.remove('glow'); }, 400); }
        caps.forEach(function (c, k) { c.classList.toggle('is-on', k === i); if (k === i) c.removeAttribute('aria-hidden'); else c.setAttribute('aria-hidden', 'true'); });
        ticks.forEach(function (t, k) { t.classList.toggle('is-on', k === i); t.classList.toggle('done', k < i); });
        live();
        clearTimeout(ahead); ahead = setTimeout(function () { make((i + 1) % n); }, hold * 0.45);
      });
    }
    ticks.forEach(function (t, k) { t.addEventListener('click', function () { go(k); }); });
    if (bPrev) bPrev.addEventListener('click', function () { go(cur - 1); });
    if (bNext) bNext.addEventListener('click', function () { go(cur + 1); });
    if (ctl) ctl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); go(cur + (e.key === 'ArrowLeft' ? -1 : 1)); }
    });
    // the strip's fill is the clock: when the current tick is full, the next machine comes in
    show.addEventListener('animationend', function (e) { if (e.animationName === 'fill' && e.target.parentNode.parentNode === ticks[cur]) go(cur + 1); });
    var pause = function (on, why) { show['_' + why] = on; show.classList.toggle('paused', !!(show._hover || show._focus || show._drag || show._user)); };
    if (bPlay) bPlay.addEventListener('click', function () {
      var on = !show._user;
      pause(on, 'user');
      bPlay.setAttribute('aria-pressed', String(on));
      bPlay.setAttribute('aria-label', on ? 'Play the machines' : 'Pause the machines');
      bPlay.classList.toggle('is-paused', on);
      live();   // a paused showroom also stops the turning
    });
    if (fine) { show.addEventListener('mouseenter', function () { pause(true, 'hover'); }); show.addEventListener('mouseleave', function () { pause(false, 'hover'); }); }
    show.addEventListener('focusin', function () { pause(true, 'focus'); });
    show.addEventListener('focusout', function (e) { if (!show.contains(e.relatedTarget)) pause(false, 'focus'); });
    watch(hero, function (on) { seen = on; live(); });
    // the whole showroom (stage, caption, controls) takes the swipe; vertical scroll stays with the page (touch-action: pan-y)
    ttInput(show, function () { return items[cur] && items[cur].tt; }, {
      drag: true,
      start: function () { pause(true, 'drag'); },
      end: function (dx) { pause(false, 'drag'); if (Math.abs(dx) > 56) go(cur + (dx < 0 ? 1 : -1)); }
    });
    addEventListener('load', function () { setTimeout(function () { make(1); }, hold * 0.7); });
  })();

  /* ---------- range cards and the drivetrain machine ---------- */
  var vpR = $('[data-range-vp]'), cardOs = [], centreOn = null;
  $$('.card .tt').forEach(function (el) {
    var o = TT(el), card = el.closest('.card');
    cardOs.push(o);
    if (fine) {
      card.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { o.hover = true; ttLive(o, true); } });
      card.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { o.hover = false; ttLive(o, o === centreOn); } });
      ttInput(card, function () { return o; });
    } else {
      // phones: the card in the middle of the swipe row turns
      watch(card, function (on) { ttLive(o, on); }, { root: vpR, rootMargin: '0px -30% 0px -30%', threshold: 0.5 });
    }
  });
  // desktop: the card nearest the middle of the screen turns as the pinned track moves, so the range is never still
  if (fine && !RM && cardOs.length) {
    var crq = 0;
    var pickCentre = function () {
      crq = 0;
      var best = null, bd = 1e9, cx = innerWidth / 2, vh = innerHeight;
      cardOs.forEach(function (o) {
        var r = o.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > innerWidth) return;
        var d = Math.abs(r.left + r.width / 2 - cx); if (d < bd) { bd = d; best = o; }
      });
      if (best === centreOn) return;
      if (centreOn && !centreOn.hover) ttLive(centreOn, false);
      centreOn = best; if (best) ttLive(best, true);
    };
    addEventListener('scroll', function () { if (!crq) crq = requestAnimationFrame(pickCentre); }, { passive: true });
    addEventListener('load', pickCentre);
  }
  var dtt = $('.tt-drive');
  if (dtt) { var dO = TT(dtt); watch(dtt, function (on) { ttLive(dO, on); }, { threshold: 0.1 }); ttInput(dtt, function () { return dO; }, { drag: true }); }

  // any other turntable (range page hero, scenes, compact cards): turns while in view, pointer follows, finger drags
  $$('.tt[data-tt-view]').forEach(function (el) {
    var o = TT(el);
    // turns only while mostly in view, so at most two or three swing at once (each is a 3D layer)
    watch(el, function (on) { ttLive(o, on); }, { threshold: 0.6 });
    ttInput(el.closest('.sc, .cc, .show-stage') || el, function () { return o; }, { drag: true });
  });

  /* ---------- loops that only run while on screen ---------- */
  $$('[data-marq]').forEach(function (m) { watch(m, function (on) { m.classList.toggle('off', !on); }); });
  watch($('.vids'), function (on, el) { el.classList.toggle('off', !on); });
  watch(road, function (on, el) { el.classList.toggle('off', !on); });
  // video cards tilt under a mouse
  if (fine && !RM) $$('.vidbox').forEach(function (b) {
    b.addEventListener('pointermove', function (e) {
      var r = b.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      b.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg'); b.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg');
    });
    b.addEventListener('pointerleave', function () { b.style.setProperty('--ry', '0deg'); b.style.setProperty('--rx', '0deg'); });
  });

  /* ---------- airflow: thin streams and particles drifting like air through pipes, behind the content ---------- */
  // Never switches itself off: slow frames step the particle count down (to a floor of 16 per canvas, drawn every
  // second frame); about 10 s of good frames step it back up. Strokes are batched into 4 alpha buckets per canvas.
  (function () {
    var cvs = $$('canvas[data-air]');
    if (!cvs.length || !cvs[0].getContext) return;
    var small = matchMedia('(max-width:767px), (pointer:coarse)').matches;
    // 1x everywhere: the lines are thin and soft by design, and a 1.5x full-viewport canvas doubled the paint cost on laptops
    var DPR = 1, TRAIL = small ? 10 : 18;
    var KIND = {
      page: { rgb: '21,112,184', a: 0.32, n: small ? 38 : 100, sp: 1 },
      navy: { rgb: '46,168,228', a: 0.5, n: small ? 32 : 60, sp: 1.1 },
      band: { rgb: '255,255,255', a: 0.26, n: small ? 22 : 56, sp: 0.55 }
    };
    var SCALE = [1, 0.6, 0.36, 0.2], level = 0;
    var airs = cvs.map(function (cv) {
      var k = KIND[cv.getAttribute('data-air')] || KIND.page;
      return { cv: cv, ctx: cv.getContext('2d'), k: k, n: k.n, ps: [], w: 0, h: 0, on: cv.classList.contains('air-page'), fixed: cv.classList.contains('air-page'), tick: 0 };
    });
    var T = Math.random() * 100, B = [[], [], [], []];
    function field(x, y, t) {
      // mostly rightward, with slow waves along x and y, so a stream bends gently like air through a pipe run
      return 0.42 * Math.sin(x * 0.0085 + y * 0.0035 + t * 0.5) + 0.28 * Math.sin(y * 0.011 - t * 0.3) + 0.12 * Math.sin(x * 0.002 - t * 0.17);
    }
    function spawn(o, p, anywhere) {
      p.x = anywhere ? Math.random() * o.w : -10 - Math.random() * 80; p.y = Math.random() * o.h;
      p.life = 0; p.max = 260 + Math.random() * 420; p.s = 0.7 + Math.random() * 0.6; p.al = 0.45 + Math.random() * 0.55;
      p.tx = []; p.ty = []; for (var i = 0; i < TRAIL; i++) { p.tx.push(p.x); p.ty.push(p.y); } p.ti = 0; p.f = 0;
    }
    function fill(o) {   // match the particle count to the current level
      o.n = Math.max(16, Math.round(o.k.n * SCALE[level]));
      if (o.ps.length > o.n) o.ps.length = o.n;
      while (o.w && o.ps.length < o.n) { var p = {}; spawn(o, p, true); o.ps.push(p); }
    }
    function size(o) {
      var w = o.cv.clientWidth, h = o.cv.clientHeight;
      if (!w || !h || (w === o.w && (o.fixed || Math.abs(h - o.h) < 2))) return;
      // scene canvases are large and sit on dark ground where thin lines read fine at 1x: only the page canvas uses the higher DPR
      var r = o.fixed ? DPR : 1;
      o.w = w; o.h = h; o.cv.width = Math.round(w * r); o.cv.height = Math.round(h * r);
      o.ctx.setTransform(r, 0, 0, r, 0, 0);
      o.ps = []; fill(o);
    }
    function step(o, dt, dy) {
      var boost = 1 + Math.min(Math.abs(dy) / 30, 1.4), par = o.fixed ? dy * 0.3 : 0, every = small ? 4 : 3;
      for (var i = 0; i < o.ps.length; i++) {
        var p = o.ps[i], ang = field(p.x, p.y, T), v = 70 * o.k.sp * p.s;
        p.x += (Math.cos(ang) * v + 16) * dt * boost; p.y += Math.sin(ang) * v * dt - par;
        if (++p.f % every === 0) { p.ti = (p.ti + 1) % TRAIL; p.tx[p.ti] = p.x; p.ty[p.ti] = p.y; }
        if (++p.life > p.max || p.x > o.w + 40 || p.y < -60 || p.y > o.h + 60) spawn(o, p, false);
      }
    }
    function draw(o) {
      var c = o.ctx, b, i, j, p, q, list;
      c.clearRect(0, 0, o.w, o.h);
      c.strokeStyle = c.fillStyle = 'rgb(' + o.k.rgb + ')'; c.lineWidth = 1.15; c.lineCap = 'round';
      for (b = 0; b < 4; b++) B[b].length = 0;
      for (i = 0; i < o.ps.length; i++) {
        p = o.ps[i];
        var v = Math.min(1, p.life / 50, (p.max - p.life) / 50) * p.al;
        if (v > 0.05) B[Math.min(3, (v * 4) | 0)].push(p);
      }
      for (b = 0; b < 4; b++) {
        list = B[b]; if (!list.length) continue;
        c.globalAlpha = o.k.a * (b + 0.6) / 4;
        c.beginPath();
        for (i = 0; i < list.length; i++) {
          p = list[i];
          for (j = 1; j <= TRAIL; j++) { q = (p.ti + j) % TRAIL; if (j === 1) c.moveTo(p.tx[q], p.ty[q]); else c.lineTo(p.tx[q], p.ty[q]); }
          c.lineTo(p.x, p.y);
        }
        c.stroke();
        c.beginPath();
        for (i = 0; i < list.length; i++) c.rect(list[i].x - 1.1, list[i].y - 1.1, 2.2, 2.2);
        c.fill();
      }
      c.globalAlpha = 1;
    }
    airs.forEach(function (o) { if (!o.fixed) watch(o.cv.parentNode, function (on) { o.on = on; if (on) { size(o); if (RM) { draw(o); } else run(); } }); });
    if (RM) {   // reduced motion: one still frame of the field, no loop
      airs.forEach(function (o) { size(o); for (var i = 0; i < 160; i++) { T += 0.016; step(o, 0.016, 0); } draw(o); });
      addEventListener('resize', function () { airs.forEach(function (o) { o.w = 0; size(o); for (var i = 0; i < 160; i++) step(o, 0.016, 0); draw(o); }); });
      return;
    }
    var raf = 0, last = 0, lastWork = 0, lastY = pageYOffset, frames = 0, slow = 0, good = 0, odd = 0, lowest = 0;
    window.__air = { level: function () { return level; }, lowest: function () { return lowest; }, stopped: function () { return false; },
      count: function () { return airs.reduce(function (s, o) { return s + (o.on ? o.ps.length : 0); }, 0); } };
    function setLevel(l) { level = l; lowest = Math.max(lowest, l); airs.forEach(fill); }
    function frame(now) {
      raf = 0;
      var gap = last ? now - last : 16.7; last = now;
      // watchdog on the share of slow frames, so one long frame (a pin, an image decode) does not trip it
      frames++; if (gap > 24) slow++;
      if (frames >= 90) {
        if (slow > 45) { good = 0; if (level < 3) setLevel(level + 1); }
        else if (slow < 9) { good += frames; if (good >= 600 && level > 0) { setLevel(level - 1); good = 0; } }
        else good = 0;
        frames = 0; slow = 0;
      }
      // the air drifts slowly, so on large screens 30 updates a second look the same and halve the paint cost;
      // the lowest level draws every second frame everywhere
      if ((level >= 3 || !small) && (odd ^= 1)) { run(); return; }
      var dt = Math.min(0.05, (lastWork ? now - lastWork : 16.7) / 1000); lastWork = now;
      var y = pageYOffset, dy = y - lastY; lastY = y; T += dt;
      airs.forEach(function (o) { if (!o.on) return; if (++o.tick % 30 === 1) size(o); step(o, dt, dy); draw(o); });
      run();
    }
    function run() { if (!raf && !D.hidden) raf = requestAnimationFrame(frame); }
    D.addEventListener('visibilitychange', function () { if (D.hidden) { cancelAnimationFrame(raf); raf = 0; } else { last = 0; lastWork = 0; frames = 0; slow = 0; run(); } });
    addEventListener('resize', function () { airs.forEach(function (o) { if (o.on) size(o); }); });
    airs.forEach(function (o) { if (o.fixed) size(o); });
    run();
  })();

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

    /* hero: the headline drifts slower than the page (fine pointers). The machine is never scaled by scroll: it stays whole. */
    var h1 = $('.h1');
    if (hero && c.fine) {
      g.to(h1, { y: function () { return hero.offsetHeight * 0.1; }, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 }, invalidateOnRefresh: true });
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
    var drive = $('[data-drive]'), dm = $('[data-dm-par]'), specs = $$('[data-specs] .spec');
    if (drive && c.wide) {
      drive.classList.add('is-pinned');
      var dist = function () { return Math.round(innerHeight * 1.7); };
      var marks = [0.06, 0.24, 0.42, 0.6];
      ST.create({
        trigger: drive, start: function () { return 'top ' + hdrH(); }, end: function () { return '+=' + dist(); }, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: function (s) { specs.forEach(function (el, i) { if (s.progress >= marks[i]) el.classList.add('in'); }); }
      });
      // the scroll scale lives on its own wrapper (the turntable turns inside it) and tops out at 1, so the machine stays whole
      if (dm) g.fromTo(dm, { scale: 0.88, yPercent: 4 }, { scale: 1, yPercent: 0, ease: 'none',
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
          onUpdate: function (s) { nodes.forEach(function (n, i) { if (s.progress >= th[i]) n.classList.add('on'); }); if (s.progress > 0.985) road.classList.add('flow'); } } });
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

    /* fine pointers: magnetic WhatsApp pills (range cards turn their machine instead of tilting, see the turntable) */
    if (c.fine) {
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
