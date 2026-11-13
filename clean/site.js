/* KOMTER, clean version: the little JS the site needs. Everything works without it:
   every WhatsApp link already carries a message in the HTML; this file only writes the enquiry
   builder's message, closes the phone menu, marks the current family on the range page and runs
   the short fade-in. */
(function () {
  'use strict';
  var WA = 'https://wa.me/919840867322?text=';
  var doc = document;
  window.komterReady = true;

  /* Arriving on a #link: the web font can change line lengths after the first jump, so line the
     target up again once fonts and images are in, unless the visitor has already started scrolling.
     Smooth scrolling is switched on only after that. */
  var hashTarget = location.hash.length > 1 && doc.getElementById(decodeURIComponent(location.hash.slice(1)));
  var moved = false;
  ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
    addEventListener(ev, function () { moved = true; }, { once: true, passive: true });
  });
  var realign = function () { if (hashTarget && !moved) hashTarget.scrollIntoView({ block: 'start' }); };
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(realign);
  addEventListener('load', function () {
    realign();
    doc.documentElement.classList.add('smooth');
  });

  /* Phone menu (a <details>, so it opens without JS): close it after a pick, on Escape and on an outside tap */
  var menu = doc.querySelector('.menu');
  if (menu) {
    var close = function () { menu.removeAttribute('open'); };
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.hasAttribute('open')) { close(); menu.querySelector('summary').focus(); }
    });
    doc.addEventListener('click', function (e) { if (menu.hasAttribute('open') && !menu.contains(e.target)) close(); });
  }

  /* Enquiry builder: line + requirement + town/company -> a message that reads like a person wrote it.
     Empty fields are left out. */
  var form = doc.getElementById('wa-form');
  if (form) {
    var line = doc.getElementById('f-line');
    var need = doc.getElementById('f-need');
    var from = doc.getElementById('f-from');
    var out = doc.getElementById('wa-preview');
    var send = doc.getElementById('wa-send');
    var tidy = function (s) { return (s || '').replace(/\s+/g, ' ').trim(); };
    var stop = function (s) { return /[.!?]$/.test(s) ? s : s + '.'; };
    var message = function () {
      var opt = line.options[line.selectedIndex];
      var what = (opt && opt.getAttribute('data-q')) || 'an air compressor';
      var parts = ["Hello Komter, I'd like a quote for " + what + '.'];
      var n = tidy(need.value);
      var f = tidy(from.value);
      if (n) parts.push('Requirement: ' + stop(n));
      if (f) parts.push('From: ' + stop(f));
      return parts.join(' ');
    };
    var update = function () {
      var msg = message();
      out.textContent = msg;
      send.href = WA + encodeURIComponent(msg);
    };
    var pick = /[?&]line=([a-z-]+)/.exec(location.search);
    if (pick && line.querySelector('option[value="' + pick[1] + '"]')) line.value = pick[1];
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', function (e) { e.preventDefault(); update(); send.click(); });
    update();
  }

  /* Range page: highlight the family in view and keep its chip visible */
  var chipBar = doc.querySelector('.chips ul');
  if (chipBar) {
    var still = matchMedia('(prefers-reduced-motion: reduce)');
    var chips = [].slice.call(chipBar.querySelectorAll('a'));
    var secs = chips.map(function (a) { return doc.getElementById(a.hash.slice(1)); });
    var current = null;
    // the lit chip slides: one navy block moved with transform (translate + scaleX), no layout properties
    var lit = null;
    if (!still.matches) {
      lit = doc.createElement('span');
      lit.className = 'chip-lit';
      lit.setAttribute('aria-hidden', 'true');
      chipBar.insertBefore(lit, chipBar.firstChild);
      chipBar.classList.add('has-lit');
    }
    var slide = function (idx) {
      if (!lit) return;
      if (idx < 0) { lit.style.opacity = 0; return; }
      var a = chips[idx];
      lit.style.transform = 'translateX(' + a.offsetLeft + 'px) scaleX(' + (a.offsetWidth / 100) + ')';
      lit.style.opacity = 1;
      if (!lit.classList.contains('ready')) requestAnimationFrame(function () { requestAnimationFrame(function () { lit.classList.add('ready'); }); });
    };
    var tapped = -1;       // a tapped chip stays lit until the page stops scrolling
    var release = null;
    var light = function (idx) {
      if (idx === current) return;
      current = idx;
      chips.forEach(function (a, i) {
        if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      slide(idx);
      if (idx >= 0) {
        var li = chips[idx].parentNode;
        var target = li.offsetLeft - parseFloat(getComputedStyle(chipBar).paddingLeft);
        if (Math.abs(chipBar.scrollLeft - target) > 4) {
          chipBar.scrollTo({ left: target, behavior: still.matches ? 'auto' : 'smooth' });
        }
      }
    };
    var mark = function () {
      if (tapped >= 0) return;
      var edge = chipBar.getBoundingClientRect().bottom + 24;
      var idx = -1;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top <= edge) idx = i; });
      light(idx);
    };
    var settle = function () {
      clearTimeout(release);
      release = setTimeout(function () {
        var keep = tapped;
        tapped = -1;
        mark();
        // the last families can't scroll to the top of the page: keep the tapped one lit if it is in view
        var s = secs[keep];
        if (keep > current && s && s.getBoundingClientRect().top < innerHeight * 0.6) light(keep);
      }, 160);
    };
    chips.forEach(function (a, i) {
      a.addEventListener('click', function () { tapped = i; light(i); settle(); });
    });
    var ticking = false;
    addEventListener('scroll', function () {
      if (tapped >= 0) { settle(); return; }
      if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; mark(); }); }
    }, { passive: true });
    mark();
  }

  /* Fade-in on entry. Hidden only while html has .js; the head script shows everything after 2.5 s
     if this file never ran. */
  var pending = [].slice.call(doc.querySelectorAll('.reveal'));
  if (pending.length) {
    var check = function () {
      var limit = innerHeight * 0.92;
      pending = pending.filter(function (el) {
        if (el.getBoundingClientRect().top < limit) { el.classList.add('is-in'); return false; }
        return true;
      });
      if (!pending.length) removeEventListener('scroll', onScroll);
    };
    var waiting = false;
    var onScroll = function () {
      if (!waiting) { waiting = true; requestAnimationFrame(function () { waiting = false; check(); }); }
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    check();
  }

  /* ---- Motion pass: all of it off for prefers-reduced-motion (checked once, as on the reference site) ---- */
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var head = doc.querySelector('.site-head');

  /* Header gets its hairline and shadow after the first few px */
  if (head) {
    var stuck = false;
    var edge = function () {
      var on = (window.pageYOffset || doc.documentElement.scrollTop) > 8;
      if (on !== stuck) { stuck = on; head.classList.toggle('is-stuck', on); }
    };
    addEventListener('scroll', edge, { passive: true });
    edge();
  }

  if (!calm && 'IntersectionObserver' in window) {
    var once = function (els, fn, margin) {
      var io = new IntersectionObserver(function (list) {
        list.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } });
      }, { rootMargin: margin || '0px 0px -8% 0px', threshold: 0.12 });
      els.forEach(function (el) { io.observe(el); });
    };
    var below = function (el) { return el.getBoundingClientRect().top > innerHeight * 0.92; };

    // machines settle once as each section enters; ones already on screen at load stay put
    var stages = [].slice.call(doc.querySelectorAll('.fam .stage, .band-media .stage, .line .stage')).filter(below);
    stages.forEach(function (el) { el.classList.add('rise'); });
    once(stages, function (el) { el.classList.add('is-set'); });

    // desktop lineup, left to right (its images are hidden from first paint by CSS, so show it right away if in view)
    var lineup = doc.querySelector('.lineup');
    if (lineup) once([lineup], function (el) { el.classList.add('is-set'); }, '0px');

    // company figures count up once; the final value is already in the HTML
    var figs = [].slice.call(doc.querySelectorAll('.figs dd'));
    var run = function (dd) {
      var m = /^(\d+)(\D*)$/.exec(dd.textContent.trim());
      if (!m) return;
      var end = +m[1], t0 = null;
      var step = function (t) {
        if (t0 === null) t0 = t;
        var k = Math.min(1, (t - t0) / 1100);
        dd.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + m[2];
        if (k < 1) requestAnimationFrame(step);
      };
      dd.textContent = '0' + m[2];
      requestAnimationFrame(step);
    };
    once(figs, run, '0px');
  }

  /* Team photo: a smoothed scroll-linked lift (about 8 px and 1.2 degrees at most) */
  var team = doc.querySelector('.team img');
  if (team && !calm) {
    var cur = 0, goal = 0, last = 0, spinning = false;
    var aim = function () {
      var r = team.getBoundingClientRect();
      var p = (innerHeight - r.top) / (innerHeight + r.height);
      goal = Math.max(-1, Math.min(1, p * 2 - 1));
    };
    var frame = function (now) {
      var dt = Math.min(64, now - last); last = now;
      cur += (goal - cur) * (1 - Math.exp(-dt / 150));
      team.style.transform = 'perspective(900px) translateY(' + (-cur * 8).toFixed(2) + 'px) rotateX(' + (cur * 1.2).toFixed(3) + 'deg)';
      if (Math.abs(goal - cur) > 0.002) requestAnimationFrame(frame); else spinning = false;
    };
    var wake = function () {
      aim();
      if (!spinning) { spinning = true; last = performance.now(); requestAnimationFrame(frame); }
    };
    addEventListener('scroll', wake, { passive: true });
    addEventListener('resize', wake, { passive: true });
    aim(); cur = goal;
  }
})();
