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
    var tapped = -1;       // a tapped chip stays lit until the page stops scrolling
    var release = null;
    var light = function (idx) {
      if (idx === current) return;
      current = idx;
      chips.forEach(function (a, i) {
        if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
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
})();
