/* KOMTER, market version: the menu dialog, the two sliders, the WhatsApp enquiry and the product filter.
   Plain JS, no library. Every link already works without this file; it only adds behaviour on top. */
(function () {
  'use strict';

  var WA = 'https://wa.me/919840867322';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

  /* ---------- header: separates from the hero once the page moves ----------
     is-scrolled adds the hairline and shadow and lets the bar settle (CSS: transform, opacity and a pseudo-element only). */
  var bar = document.querySelector('.bar');
  if (bar) {
    var scrolled = null;
    var onBarScroll = function () {
      var s = (window.pageYOffset || document.documentElement.scrollTop || 0) > 8;
      if (s !== scrolled) { scrolled = s; bar.classList.toggle('is-scrolled', s); }
    };
    window.addEventListener('scroll', onBarScroll, { passive: true });
    onBarScroll();
  }

  /* ---------- full-screen menu: a real modal dialog ----------
     Without JS the MENU cell is a link to the site map in the footer. */
  var dlg = document.getElementById('menu');
  var opener = document.querySelector('[data-menu-open]');
  if (dlg && opener && typeof dlg.showModal === 'function') {
    var leaving = false;
    opener.setAttribute('role', 'button');
    opener.setAttribute('aria-haspopup', 'dialog');
    opener.setAttribute('aria-controls', 'menu');
    opener.setAttribute('aria-expanded', 'false');
    var openMenu = function (e) {
      if (e) e.preventDefault();
      leaving = false;
      dlg.showModal();
      document.documentElement.classList.add('menu-open');
      opener.setAttribute('aria-expanded', 'true');
      var first = dlg.querySelector('[data-menu-close]');
      if (first) first.focus();
    };
    opener.addEventListener('click', openMenu);
    opener.addEventListener('keydown', function (e) { if (e.key === ' ') openMenu(e); });
    dlg.addEventListener('close', function () {
      document.documentElement.classList.remove('menu-open');
      opener.setAttribute('aria-expanded', 'false');
      if (!leaving) opener.focus();
    });
    dlg.addEventListener('click', function (e) {
      if (e.target.closest('[data-menu-close]')) { dlg.close(); return; }
      if (e.target.closest('a[href]')) { leaving = true; dlg.close(); }  // let the link navigate
    });
  }

  /* ---------- sliders: hero card and range carousel ----------
     Both are plain scroll-snap rows that swipe without JS; the arrow buttons are hidden until this runs. */
  each(document.querySelectorAll('[data-slider]'), function (root) {
    var track = root.querySelector('[data-track]');
    var loop = root.hasAttribute('data-loop');
    if (!track) return;
    var prevs = root.querySelectorAll('[data-prev]');
    var nexts = root.querySelectorAll('[data-next]');
    each(root.querySelectorAll('[data-arrows]'), function (el) { el.hidden = false; });
    var step = function () {
      var item = track.firstElementChild;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return item ? item.getBoundingClientRect().width + gap : track.clientWidth;
    };
    var atEnd = function () { return track.scrollLeft >= track.scrollWidth - track.clientWidth - 4; };
    var go = function (dir) {
      var behavior = reduce ? 'auto' : 'smooth';
      if (loop && dir > 0 && atEnd()) { track.scrollTo({ left: 0, behavior: behavior }); return; }
      if (loop && dir < 0 && track.scrollLeft <= 4) { track.scrollTo({ left: track.scrollWidth, behavior: behavior }); return; }
      track.scrollBy({ left: dir * step(), behavior: behavior });
    };
    var update = function () {
      if (loop) return;
      var start = track.scrollLeft <= 4, end = atEnd();
      each(prevs, function (b) { b.disabled = start; });
      each(nexts, function (b) { b.disabled = end; });
    };
    each(prevs, function (b) { b.addEventListener('click', function () { go(-1); }); });
    each(nexts, function (b) { b.addEventListener('click', function () { go(1); }); });
    var raf = 0;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = window.requestAnimationFrame(function () { raf = 0; update(); });
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* ---------- WhatsApp enquiry builder ----------
     Without JS the send link carries a generic message. With JS it carries what the visitor picked and typed;
     empty fields are left out. */
  // Tidy what was typed: one space between words, no trailing comma or colon.
  var clean = function (s) { return (s || '').replace(/\s+/g, ' ').trim().replace(/[\s,;:]+$/, ''); };
  // End with a full stop only when the visitor didn't already end with . ? or !
  var stop = function (s) { return /[.?!]$/.test(s) ? s : s + '.'; };
  var buildMessage = function (lineValue, phrase, requirement, from) {
    var parts = [];
    if (phrase) parts.push('Hello Komter, I\'d like a quote for ' + phrase + '.');
    else if (lineValue === 'not-sure') parts.push('Hello Komter, I\'d like a quote. I\'m not sure which product line fits yet.');
    else parts.push('Hello Komter, I\'d like a quote.');
    var r = clean(requirement), f = clean(from);
    if (r) parts.push('Requirement: ' + stop(r));
    if (f) parts.push('From: ' + stop(f));
    return parts.join(' ');
  };
  window.komterMessage = buildMessage;  // exposed for the enquiry test

  each(document.querySelectorAll('[data-wa-form]'), function (form) {
    var sel = form.querySelector('[name="line"]');
    var req = form.querySelector('[name="requirement"]');
    var from = form.querySelector('[name="from"]');
    var send = form.querySelector('[data-wa-send]');
    var preview = form.querySelector('[data-wa-preview]');
    if (!sel || !send) return;
    var wrap = form.querySelector('[data-wa-preview-wrap]');
    if (wrap) wrap.hidden = false;
    var update = function () {
      var opt = sel.options[sel.selectedIndex];
      var msg = buildMessage(sel.value, opt ? opt.getAttribute('data-wa') : '', req && req.value, from && from.value);
      send.href = WA + '?text=' + encodeURIComponent(msg);
      if (preview) preview.textContent = msg;
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', function (e) { e.preventDefault(); update(); send.click(); });
    // Two text fields and no submit button means Enter/Go would do nothing: send from either field.
    each([req, from], function (field) {
      if (!field) return;
      field.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.isComposing) return;
        e.preventDefault();
        update();
        send.click();
      });
    });
    // "Enquire" links elsewhere on the page can preselect a line: <a href="#enquire" data-pick="laser">
    each(document.querySelectorAll('[data-pick]'), function (a) {
      a.addEventListener('click', function () { sel.value = a.getAttribute('data-pick'); update(); });
    });
    update();
  });

  /* ---------- footer link groups ----------
     The HTML has plain headings over open lists (right for wide screens, and for phones without JS).
     On phones each group becomes a folded <details>, so the footer is four short rows; back to headings
     when the screen widens. */
  var foot = document.querySelector('.foot-cols');
  if (foot && window.matchMedia) {
    var wide = window.matchMedia('(min-width: 768px)');
    var toPhone = function (g) {
      var d = document.createElement('details');
      d.className = g.className;
      var s = document.createElement('summary');
      s.textContent = g.querySelector('.foot-h').textContent;
      d.appendChild(s);
      d.appendChild(g.querySelector('ul'));
      g.parentNode.replaceChild(d, g);
    };
    var toWide = function (d) {
      var g = document.createElement('div');
      g.className = d.className;
      var h = document.createElement('h2');
      h.className = 'foot-h';
      h.textContent = d.querySelector('summary').textContent;
      g.appendChild(h);
      g.appendChild(d.querySelector('ul'));
      d.parentNode.replaceChild(g, d);
    };
    var setGroups = function () {
      if (wide.matches) each(foot.querySelectorAll('details.foot-group'), toWide);
      else each(foot.querySelectorAll('div.foot-group'), toPhone);
    };
    if (wide.addEventListener) wide.addEventListener('change', setGroups);
    setGroups();
  }

  /* ---------- products page: family filter ----------
     Without JS the chips are links to each family; with JS they filter the cards. */
  var chips = document.querySelectorAll('[data-filter]');
  if (chips.length) {
    var cards = document.querySelectorAll('[data-fam]');
    var status = document.querySelector('[data-filter-status]');
    var families = {};
    each(chips, function (c) { families[c.getAttribute('data-filter')] = true; });
    var apply = function (key, announce) {
      var n = 0;
      each(cards, function (card) {
        var show = key === 'all' || card.getAttribute('data-fam') === key;
        card.hidden = !show;
        if (show) n += 1;
      });
      each(chips, function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === key)); });
      if (status && announce) status.textContent = 'Showing ' + n + (n === 1 ? ' line' : ' lines') + '.';
    };
    each(chips, function (c) {
      c.setAttribute('role', 'button');
      c.addEventListener('click', function (e) {
        e.preventDefault();
        var key = c.getAttribute('data-filter');
        apply(key, true);
        if (window.history && history.replaceState) {
          history.replaceState(null, '', key === 'all' ? location.pathname : '#' + key);
        }
      });
      c.addEventListener('keydown', function (e) { if (e.key === ' ') { e.preventDefault(); c.click(); } });
    });
    var fromHash = function () {
      var h = decodeURIComponent(location.hash.slice(1));
      apply(families[h] ? h : 'all', false);
      if (h) {
        var target = document.getElementById(h);
        if (target) {
          // jump, don't glide: the page was just filtered under the visitor's finger
          var root = document.documentElement, was = root.style.scrollBehavior;
          root.style.scrollBehavior = 'auto';
          target.scrollIntoView({ block: 'start' });
          root.style.scrollBehavior = was;
        }
      }
    };
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }
  /* ---------- motion: calm panel feel ----------
     Skipped with reduced motion. Everything stays visible if this fails: only things below the first screen are
     hidden, and a 2.5 s failsafe lifts the hiding if the observer never reports. */
  if (!reduce && 'IntersectionObserver' in window) {
    var html = document.documentElement;
    html.classList.add('mo');
    var seen = false;
    window.setTimeout(function () { if (!seen) html.classList.remove('mo'); }, 2500);
    var vh = window.innerHeight || 700;

    // number cards count up once when they land
    var countUp = function (card, delay) {
      var n = card.querySelector('.num-n');
      var t = n && n.firstChild;
      if (!t || t.nodeType !== 3) return;
      var end = parseInt(t.nodeValue, 10);
      if (isNaN(end)) return;
      t.nodeValue = '0';
      var t0 = null;
      var step = function (now) {
        if (t0 === null) t0 = now;
        var k = Math.min(1, Math.max(0, (now - t0 - delay) / 900));
        t.nodeValue = String(Math.round(end * (1 - Math.pow(1 - k, 3))));
        if (k < 1) window.requestAnimationFrame(step); else t.nodeValue = String(end);
      };
      window.requestAnimationFrame(step);
    };

    var io = new IntersectionObserver(function (entries) {
      seen = true;
      var n = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, d = Math.min(n, 4) * 70;
        n += 1;
        io.unobserve(el);
        el.style.transitionDelay = d + 'ms';
        if (el.classList.contains('num')) countUp(el, d);
        el.classList.add('in');
        window.setTimeout(function () {   // hand the element back to its own hover/press transitions
          el.classList.remove('rv', 'in');
          el.style.transitionDelay = '';
        }, 600 + d);
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    each(document.querySelectorAll('.panel, .about-head, .about-grid, .fam-list > .fam, .num, .line, .words, .foot'), function (el) {
      if (el.getBoundingClientRect().top < vh * 0.98) return;   // first screen (and anything above it) is never gated
      el.classList.add('rv');
      io.observe(el);
    });

    // hero corner card: mark the slide that is in view
    each(document.querySelectorAll('.hcard-track'), function (track) {
      var slides = track.querySelectorAll('.hslide');
      if (!slides.length) return;
      slides[0].classList.add('is-on');
      var sio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.target.classList.toggle('is-on', e.isIntersecting); });
      }, { root: track, threshold: 0.6 });
      each(slides, function (s) { sio.observe(s); });
    });

    // range carousel: the card nearest the middle of the row
    var rtrack = document.querySelector('.range-track');
    if (rtrack) {
      var near = null, rr = 0;
      var markNear = function () {
        rr = 0;
        var tr = rtrack.getBoundingClientRect(), mid = tr.left + tr.width / 2, best = null, bd = 1e9;
        each(rtrack.children, function (c) {
          var r = c.getBoundingClientRect(), dd = Math.abs(r.left + r.width / 2 - mid);
          if (dd < bd) { bd = dd; best = c; }
        });
        if (best !== near) {
          if (near) near.classList.remove('is-near');
          if (best) best.classList.add('is-near');
          near = best;
        }
      };
      rtrack.addEventListener('scroll', function () { if (!rr) rr = window.requestAnimationFrame(markNear); }, { passive: true });
      markNear();
    }

    // family words: drift a few px with the page's scroll, smoothed (the exponential ease Swathi's portfolio uses)
    var words = document.querySelector('.words-list');
    if (words) {
      var target = 0, cur = 0, last = 0, running = false, inView = false;
      var measure = function () {
        var h = window.innerHeight || vh, r = words.getBoundingClientRect();
        var p = ((r.top + r.height / 2) - h / 2) / h;
        target = Math.max(-1, Math.min(1, p)) * 14;
      };
      var tick = function (now) {
        var dt = Math.min(now - last, 64); last = now;
        cur += (target - cur) * (1 - Math.exp(-dt / 150));
        words.style.setProperty('--wd', cur.toFixed(2) + 'px');
        if (inView || Math.abs(target - cur) > 0.05) window.requestAnimationFrame(tick); else running = false;
      };
      var kick = function () { if (!running) { running = true; last = window.performance.now(); window.requestAnimationFrame(tick); } };
      var wio = new IntersectionObserver(function (es) {
        inView = es[es.length - 1].isIntersecting;
        if (inView) { measure(); kick(); }
      });
      wio.observe(words);
      window.addEventListener('scroll', function () { if (inView) { measure(); kick(); } }, { passive: true });
    }
  }
})();
