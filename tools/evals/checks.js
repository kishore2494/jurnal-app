/* Layout eval probe — injected into the live app, returns structured findings.
   Purpose: catch the class of bug a human only notices by squinting at a phone —
   text escaping its container, chips overflowing, tap targets too small, content
   wider than the viewport. Every finding names a selector so it's actionable. */
(function () {
  const VW = window.innerWidth, VH = window.innerHeight;
  const out = [];
  const seen = new Set();
  const add = (type, el, detail, sev) => {
    const sel = path(el);
    const k = type + '|' + sel + '|' + detail;
    if (seen.has(k)) return; seen.add(k);
    out.push({ type, sel, detail, sev: sev || 'warn' });
  };
  function path(el) {
    if (!el || el === document.body) return 'body';
    let s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    const cls = (el.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 3);
    if (cls.length) s += '.' + cls.join('.');
    const p = el.parentElement;
    if (p && p !== document.body) {
      const pc = (p.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 2);
      s = (p.id ? '#' + p.id : p.tagName.toLowerCase() + (pc.length ? '.' + pc.join('.') : '')) + ' > ' + s;
    }
    return s;
  }
  const vis = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  /* When a full-screen overlay is open it — not the screen behind it — is what the user
     is looking at, so it becomes the probe root. Without this, opening the share sheet
     re-measured the Stats screen underneath and reported those findings under the
     overlay's name: duplicated noise, and the overlay's own elements never checked at all. */
  const OVERLAYS = ['#sharesheet.on', '#milestone.on', '.tour.on', '.ob.on'];
  const overlay = OVERLAYS.map(sel => document.querySelector(sel)).find(el => el && el.offsetHeight > 0);
  const screenEl = overlay || document.querySelector('.screen.on') || document.body;
  const all = Array.from(screenEl.querySelectorAll('*')).filter(vis);

  // 1 — page must never scroll horizontally
  const de = document.documentElement;
  if (de.scrollWidth > VW + 1) add('page-hscroll', de, `scrollWidth ${de.scrollWidth} > viewport ${VW}`, 'error');

  // 2 — nothing may extend past the right edge of the viewport.
  //     EXCEPT inside a deliberate horizontal scroller. A tab strip or carousel with
  //     `overflow-x: auto` is SUPPOSED to have children outside the viewport — that is what
  //     makes it swipeable, and it is the sanctioned way to handle content too wide for the
  //     screen. Flagging those produced 66 bogus errors the moment the Stats tab row was
  //     made scrollable. The page-level check above still catches real horizontal scroll.
  const inHScroller = (el) => {
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };
  all.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return;
    if (inHScroller(el)) return;
    if (r.right > VW + 1.5) add('past-viewport', el, `right edge ${Math.round(r.right)} > ${VW}`, 'error');
    if (r.left < -1.5) add('past-viewport-left', el, `left edge ${Math.round(r.left)}`, 'warn');
  });

  // 3 — text clipped inside its own box (the "skipped overflows the button" class of bug).
  //     IMPORTANT: an element with `text-overflow: ellipsis` is SUPPOSED to have
  //     scrollWidth > clientWidth — that is how ellipsis works, not a bug. Flagging it
  //     was a false positive in the first version of this probe. For those we instead
  //     report `label-squeezed` when so little width is left that the text is unreadable.
  all.forEach(el => {
    if (!el.childNodes.length) return;
    const hasText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) return;
    const cs = getComputedStyle(el);
    if (cs.overflow === 'auto' || cs.overflow === 'scroll' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') return;
    if (!(el.scrollWidth > el.clientWidth + 1) || el.clientWidth <= 0) return;
    const ellipsising = cs.textOverflow === 'ellipsis' && (cs.overflowX === 'hidden' || cs.overflow === 'hidden');
    if (ellipsising) {
      const chars = (el.textContent || '').trim().length;
      const shown = el.clientWidth / Math.max(1, el.scrollWidth / Math.max(1, chars));
      if (el.clientWidth < 56 || shown < 6) {
        add('label-squeezed', el, `only ${el.clientWidth}px for ${chars} chars (~${Math.floor(shown)} visible)`, 'error');
      }
    } else {
      add('text-clipped', el, `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`, 'error');
    }
  });

  // 4 — a child escaping its parent's padding box
  all.forEach(el => {
    const p = el.parentElement; if (!p || p === document.body) return;
    const cs = getComputedStyle(p);
    if (cs.overflow !== 'visible' || cs.position === 'absolute' || cs.position === 'fixed') return;
    if (getComputedStyle(el).position === 'absolute' || getComputedStyle(el).position === 'fixed') return;
    const r = el.getBoundingClientRect(), pr = p.getBoundingClientRect();
    if (pr.width <= 0) return;
    const padR = parseFloat(cs.paddingRight) || 0, padL = parseFloat(cs.paddingLeft) || 0;
    if (r.right > pr.right - padR + 1.5) add('escapes-parent', el, `right ${Math.round(r.right)} beyond parent content edge ${Math.round(pr.right - padR)}`, 'error');
    // negative margins are how you grow a tap target without moving layout — not an escape
    const ecs = getComputedStyle(el);
    const negL = (parseFloat(ecs.marginLeft) || 0) < 0;
    if (!negL && r.left < pr.left + padL - 1.5) add('escapes-parent-left', el, `left ${Math.round(r.left)} before parent content edge ${Math.round(pr.left + padL)}`, 'warn');
  });

  // 5 — tap targets (Android guidance is 48dp; flag under 44)
  const TAPPABLE = 'button,a,input,select,textarea,[data-habit],[data-mm],[data-mmword],[data-scale],[data-jt],[data-yp],[role=button],.habit,.mode-btn,.seg-btn';
  Array.from(screenEl.querySelectorAll(TAPPABLE)).filter(vis).forEach(el => {
    // An input wrapped in a <label> inherits the label's whole clickable area — measuring
    // the 18px checkbox alone was a false positive.
    let target = el;
    if (/^(INPUT|SELECT)$/.test(el.tagName)) {
      const lab = el.closest('label');
      if (lab && vis(lab)) target = lab;
    }
    const r = target.getBoundingClientRect();
    const small = Math.min(r.width, r.height);
    if (small < 24) add('tap-tiny', el, `${Math.round(r.width)}x${Math.round(r.height)}`, 'error');
    else if (small < 44) add('tap-small', el, `${Math.round(r.width)}x${Math.round(r.height)}`, 'warn');
  });

  // 6 — content hidden under the fixed bottom nav (it overlays the scroll area)
  const nav = document.getElementById('nav');
  if (nav && vis(nav)) {
    const nr = nav.getBoundingClientRect();
    const last = Array.from(screenEl.children).filter(vis).pop();
    if (last) {
      const lr = last.getBoundingClientRect();
      const docH = de.scrollHeight, scrolled = window.scrollY + VH;
      if (docH - scrolled < 2 && lr.bottom > nr.top + 2) {
        add('under-nav', last, `last element bottom ${Math.round(lr.bottom)} under nav top ${Math.round(nr.top)} at page end`, 'warn');
      }
    }
  }

  // 6b — CONTRAST. A reported bug had white text on a near-white background (the alarm
  //      overlay's snooze button, from a theme rule out-specifying the overlay rule).
  //      Nothing but a real luminance check catches that, so compute WCAG contrast for
  //      every visible text node against its nearest opaque ancestor background.
  const lum = (r, g, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const parseRGB = c => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null;
    const p = m[1].split(',').map(x => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  // Returns the nearest opaque background colour, or null when it cannot be known.
  // A gradient (background-image) reports backgroundColor: transparent, so the first
  // version of this check walked past it to the card behind and reported white-on-white
  // 1.00:1 for every gradient button in the app — 19 false errors. If any ancestor up to
  // the text's own background paints an image/gradient, we cannot compute a ratio, so we
  // skip rather than lie.
  const hasImage = n => { const bi = getComputedStyle(n).backgroundImage; return bi && bi !== 'none'; };
  /* Translucent layers are COMPOSITED, not skipped. The previous version ignored any
     background with alpha < 0.9 and walked past it, so a chip painted
     rgba(255,255,255,.07) over an rgba(6,10,20,.82) scrim was compared against the light
     page body far below — reporting 1.10:1 for text that is actually near-white on
     near-black. Same false-positive family as the gradient case above: when the probe
     cannot see the real ground it must either compute it properly or say nothing. */
  const bgOf = el => {
    const layers = []; let n = el;
    while (n && n !== document.documentElement) {
      if (hasImage(n)) return null;                      // unknowable — skip this node
      const c = parseRGB(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.001) { layers.push(c); if (c.a >= 0.999) break; }
      n = n.parentElement;
    }
    const rootBg = parseRGB(getComputedStyle(document.documentElement).backgroundColor);
    const bodyBg = parseRGB(getComputedStyle(document.body).backgroundColor);
    let cur = (bodyBg && bodyBg.a >= 0.999) ? bodyBg
            : (rootBg && rootBg.a >= 0.999) ? rootBg : { r: 255, g: 255, b: 255, a: 1 };
    if (layers.length && layers[layers.length - 1].a >= 0.999) cur = layers.pop();
    for (let i = layers.length - 1; i >= 0; i--) {       // deepest first, upward
      const L = layers[i];
      cur = { r: L.r * L.a + cur.r * (1 - L.a), g: L.g * L.a + cur.g * (1 - L.a),
              b: L.b * L.a + cur.b * (1 - L.a), a: 1 };
    }
    return cur;
  };
  all.forEach(el => {
    const txt = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (!txt) return;
    const cs = getComputedStyle(el);
    const fg = parseRGB(cs.color); if (!fg || fg.a < 0.5) return;
    const bg = bgOf(el);
    if (!bg) return;                                     // gradient/image behind the text
    // flatten a translucent foreground onto its background before comparing
    const mix = (f, b, a) => f * a + b * (1 - a);
    const fr = mix(fg.r, bg.r, fg.a), fg2 = mix(fg.g, bg.g, fg.a), fb = mix(fg.b, bg.b, fg.a);
    const L1 = lum(fr, fg2, fb) + 0.05, L2 = lum(bg.r, bg.g, bg.b) + 0.05;
    const ratio = L1 > L2 ? L1 / L2 : L2 / L1;
    const px = parseFloat(cs.fontSize) || 14;
    const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3.0 : 4.5;
    if (ratio < need) {
      add(ratio < 1.6 ? 'contrast-invisible' : 'contrast-low', el,
          `${ratio.toFixed(2)}:1 (needs ${need}) "${txt.slice(0, 22)}"`, ratio < 1.6 ? 'error' : 'warn');
    }
  });

  // ACCEPTED, by design — reported but not treated as fixable:
  //   .yp cells are 5x9 because a year is 31 columns wide (Daylio's grid has the same
  //     constraint). The mosaic is a visualisation; tapping a day is a convenience, and
  //     the same day is reachable from Calendar and History.
  //   .scale buttons are ~23px wide at 320px because ten of them share one row. Their
  //     40px HEIGHT is the dimension that matters for a horizontal digit strip.

  // 7 — vertical density: how much scrolling this screen costs
  const screens = de.scrollHeight / VH;

  return JSON.stringify({ vw: VW, vh: VH, screensTall: +screens.toFixed(2), findings: out });
})();
