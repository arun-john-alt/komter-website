/* Komter range catalogue: the thumb index and the order coupon. Plain script, no library.
   Without it every link still works: tabs are in-page anchors, WhatsApp links carry a written message. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- thumb index: light the tab of the family being read ---------- */
  var tabs = [].slice.call(document.querySelectorAll('.thumbs a[href^="#"]'));
  var pairs = tabs.map(function (t) {
    return { tab: t, el: document.getElementById(t.getAttribute('href').slice(1)) };
  }).filter(function (p) { return p.el; });
  var holdUntil = 0;
  var chosen = null;   // the tab last tapped: kept lit while its family is still on the reading line

  // the red highlight: one block that glides to the lit tab (exponential smoothing in rAF, like the portfolio
  // pages). Reduced motion, or a missing rail, keeps the plain red tab and never creates it.
  var rail = document.querySelector('.thumbs');
  var hi = null, hy = 0, hh = 0, ty = 0, th = 0, hiRaf = 0, hiT = 0;
  if (rail && tabs.length && !reduce.matches) {
    hi = document.createElement('span');
    hi.className = 'thumb-hi';
    hi.setAttribute('aria-hidden', 'true');
    hi.style.transform = 'translate3d(0,0,0) scaleY(0)';
    rail.insertBefore(hi, rail.firstChild);
    rail.classList.add('slide');
  }
  function hiDraw() { hi.style.transform = 'translate3d(0,' + hy.toFixed(2) + 'px,0) scaleY(' + (hh / 100).toFixed(4) + ')'; }
  function hiStep(now) {
    var dt = Math.min(64, now - hiT); hiT = now;
    var k = 1 - Math.exp(-dt / 55);
    hy += (ty - hy) * k; hh += (th - hh) * k;
    if (Math.abs(ty - hy) < 0.25 && Math.abs(th - hh) < 0.25) { hy = ty; hh = th; hiRaf = 0; } else hiRaf = requestAnimationFrame(hiStep);
    hiDraw();
  }
  function hiTo(tab, snap) {
    if (!hi) return;
    if (tab) { ty = tab.offsetTop; th = tab.offsetHeight; } else { th = 0; }
    if (snap || (hh === 0 && !tab)) { hy = ty; hh = th; cancelAnimationFrame(hiRaf); hiRaf = 0; hiDraw(); return; }
    if (hh === 0) { hy = ty; }   // coming from nothing: grow in place rather than fly in from the old spot
    if (!hiRaf) { hiT = performance.now(); hiRaf = requestAnimationFrame(hiStep); }
  }
  var hiFirst = true;
  window.addEventListener('resize', function () {
    var on = tabs.filter(function (t) { return t.classList.contains('lit'); })[0];
    hiTo(on || null, true);
  });

  function light(tab) {
    hiTo(tab, hiFirst); hiFirst = false;
    tabs.forEach(function (t) {
      var on = t === tab;
      t.classList.toggle('lit', on);
      if (on) t.setAttribute('aria-current', 'location');
      else t.removeAttribute('aria-current');
    });
  }

  // The reading line sits a fifth of the way down the screen. Of the families crossing it, the tapped one stays
  // lit if it is there, otherwise the one that started most recently (ties go to page order). Between families
  // the last one started stays lit; above the first family the first tab is lit (the page opens on it); past
  // every family nothing is. One tab carries aria-current at most.
  function pick() {
    if (!pairs.length || Date.now() < holdUntil) return;
    var line = window.innerHeight * 0.2, crossing = [], started = null, startedTop = -Infinity, end = -Infinity;
    // a tapped family stays lit while it has started and is still on screen, even when it is shorter than the
    // reading line (a one-line family scrolled to the top of a tall screen)
    var held = chosen && pairs.filter(function (p) { return p.tab === chosen; })[0];
    if (held) {
      var hr = held.el.getBoundingClientRect();
      if (hr.top <= line && hr.bottom > 60) { light(chosen); return; }
      chosen = null;
    }
    pairs.forEach(function (p) {
      var r = p.el.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) crossing.push({ tab: p.tab, top: r.top });
      if (r.top <= line && r.top > startedTop) { started = p.tab; startedTop = r.top; }
      end = Math.max(end, r.bottom);
    });
    var cur;
    if (crossing.length) {
      cur = crossing.reduce(function (a, c) { return c.top > a.top ? c : a; }).tab;
    } else {
      cur = end <= line ? null : started;
    }
    if (pairs[0].el.getBoundingClientRect().top > line) cur = pairs[0].tab;
    light(cur);
  }

  if (pairs.length) {
    var hasScrollend = 'onscrollend' in window;
    if ('IntersectionObserver' in window) {
      // the observer's band sits on the same line pick() reads (20% down), so crossings and readings agree
      var io = new IntersectionObserver(pick, { rootMargin: '-20% 0px -79% 0px' });
      pairs.forEach(function (p) { io.observe(p.el); });
    }
    if (!hasScrollend || !('IntersectionObserver' in window)) {
      // browsers without scrollend (older iOS Safari): read once a frame while scrolling, and treat a short
      // pause as the end of the scroll
      var ticking = false, idle = 0;
      window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; pick(); }); }
        clearTimeout(idle);
        idle = setTimeout(function () { holdUntil = 0; pick(); }, 140);
      }, { passive: true });
    }
    pick();
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        chosen = t;
        light(t);
        // keep the tapped tab lit while the page thumbs through the families on its way there
        holdUntil = Date.now() + (reduce.matches ? 150 : 1400);
      });
    });
    // once a scroll settles (a tab's jump, the end key, a scrollbar drag) release the hold first, then re-read
    window.addEventListener('scrollend', function () { holdUntil = 0; pick(); });
  }

  /* ---------- the WhatsApp tab stands down only while another WhatsApp action is fully on screen ---------- */
  // (the coupon's Send button, or the back cover's WhatsApp link), so some WhatsApp action is always in view
  var bar = document.querySelector('.wa-bar');
  var spots = [document.getElementById('c-send'), document.querySelector('.back a[href*="wa.me"]')].filter(Boolean);
  if (bar && spots.length && 'IntersectionObserver' in window) {
    var whole = [];
    var watch = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = whole.indexOf(e.target), full = e.intersectionRatio >= 0.99;
        if (full && i < 0) whole.push(e.target);
        if (!full && i > -1) whole.splice(i, 1);
      });
      var away = whole.length > 0;
      bar.classList.toggle('away', away);
      if (away) bar.setAttribute('tabindex', '-1'); else bar.removeAttribute('tabindex');
    }, { threshold: [0, 1] });
    spots.forEach(function (el) { watch.observe(el); });
  }

  /* ---------- heavy rules draw in as their section arrives ---------- */
  // Only rules that start below the fold are marked, so nothing on the first screen waits on this. If the observer
  // never answers, a 2.5 s check shows every rule that is on screen anyway.
  if ('IntersectionObserver' in window && !reduce.matches) {
    var rules = [].slice.call(document.querySelectorAll('.sec-hd, .fam, .fam-band, .steps')).filter(function (el) {
      return el.getBoundingClientRect().top > window.innerHeight * 0.92;
    });
    if (rules.length) {
      var rio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -12% 0px' });
      rules.forEach(function (el) { el.classList.add('rv'); rio.observe(el); });
      setTimeout(function () {
        rules.forEach(function (el) {
          if (!el.classList.contains('in') && el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in');
        });
      }, 2500);
    }
  }

  /* ---------- the order coupon: the message sets itself as a line of type ---------- */
  var form = document.getElementById('coupon');
  if (!form) return;
  var sel = form.querySelector('#c-line');
  var req = form.querySelector('#c-req');
  var from = form.querySelector('#c-from');
  var send = document.getElementById('c-send');
  var mail = document.getElementById('c-mail');
  var msg = document.getElementById('c-msg');
  var out = {
    line: msg.querySelector('.pl-line'),
    req: msg.querySelector('.pl-req'),
    from: msg.querySelector('.pl-from')
  };
  var WA = 'https://wa.me/919840867322?text=';
  var typing = 0;

  // ruled underline: an ink rule under the last printed line, as long as the text on it (plus the caret). It lengthens
  // while the line is being set and glides to the next line when the message wraps.
  var rule = null, rx = 0, ry = 0, tx = 0, tyy = 0, rRaf = 0, rT = 0, rKeep = 0;
  if (msg) {
    rule = document.createElement('span');
    rule.className = 'pl-rule';
    rule.setAttribute('aria-hidden', 'true');
    msg.appendChild(rule);
  }
  function ruleTarget() {
    var rg = document.createRange();
    rg.setStartBefore(msg.firstChild); rg.setEndAfter(out.from);   // the printed words, not the rule itself
    var rs = rg.getClientRects(), box = msg.getBoundingClientRect(), last = null, i;
    for (i = 0; i < rs.length; i++) {
      if (rs[i].width > 0 && (!last || rs[i].bottom > last.bottom - 2)) last = rs[i];
    }
    if (!last) return;
    tyy = Math.floor((last.top - box.top + 14) / 28) * 28 + 26;
    tx = Math.min(box.width, last.right - box.left + 6);
  }
  function ruleDraw() {
    rule.style.transform = 'translate3d(0,' + ry.toFixed(1) + 'px,0) scaleX(' + (rx / Math.max(1, msg.clientWidth)).toFixed(4) + ')';
  }
  function ruleStep(now) {
    var dt = Math.min(64, now - rT); rT = now;
    ruleTarget();
    var k = 1 - Math.exp(-dt / 60);
    rx += (tx - rx) * k; ry += (tyy - ry) * k;
    var done = Math.abs(tx - rx) < 0.4 && Math.abs(tyy - ry) < 0.4;
    if (done) { rx = tx; ry = tyy; }
    ruleDraw();
    // keep reading while the line is still being set (typeset runs for up to a few frames after each change)
    if (!done || now < rKeep) rRaf = requestAnimationFrame(ruleStep); else rRaf = 0;
  }
  function ruleKick(snap) {
    if (!rule) return;
    if (snap || reduce.matches) {
      cancelAnimationFrame(rRaf); rRaf = 0;
      ruleTarget(); rx = tx; ry = tyy; ruleDraw();
      return;
    }
    rKeep = performance.now() + 700;
    if (!rRaf) { rT = performance.now(); rRaf = requestAnimationFrame(ruleStep); }
  }

  function tidy(v) {
    return v.replace(/\s+/g, ' ').trim().replace(/[\s.,;:]+$/, '');
  }

  function lineText() {
    if (sel.value === 'unsure') return "I'd like a quote. I'm not sure yet which product line I need.";
    var opt = sel.options[sel.selectedIndex];
    var phrase = opt && opt.getAttribute('data-phrase');
    return phrase ? "I'd like a quote for " + phrase + '.' : "I'd like a quote.";
  }

  function message() {
    var r = tidy(req.value), f = tidy(from.value);
    return 'Hello Komter, ' + lineText() + (r ? ' Requirement: ' + r + '.' : '') + (f ? ' From: ' + f + '.' : '');
  }

  // set a phrase a few letters per frame, like a line coming off the press
  function typeset(node, text) {
    cancelAnimationFrame(typing);
    if (reduce.matches) { node.textContent = text; return; }
    var i = 0;
    (function step() {
      i = Math.min(text.length, i + 3);
      node.textContent = text.slice(0, i);
      if (i < text.length) typing = requestAnimationFrame(step);
    })();
  }

  function update(e) {
    var r = tidy(req.value), f = tidy(from.value);
    if (e && e.target === sel) typeset(out.line, lineText());
    else if (!e) out.line.textContent = lineText();
    out.req.textContent = r ? ' Requirement: ' + r + '.' : '';
    out.from.textContent = f ? ' From: ' + f + '.' : '';
    var text = message();
    ruleKick(!e || e.type === 'pageshow');
    send.href = WA + encodeURIComponent(text);
    mail.href = 'mailto:info@komter.in?subject=' + encodeURIComponent('Quote request') + '&body=' + encodeURIComponent(text);
  }

  sel.addEventListener('change', update);
  req.addEventListener('input', update);
  from.addEventListener('input', update);
  // Enter walks the coupon: requirement to town, then town sends
  req.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); from.focus(); }
  });
  from.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); update(); send.click(); }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    update();
    window.open(send.href, '_blank', 'noopener');
  });
  // a browser may restore typed values on back navigation: print what is there
  window.addEventListener('pageshow', function () { update(); });
  window.addEventListener('resize', function () { ruleKick(true); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ruleKick(true); });
  update();
})();
