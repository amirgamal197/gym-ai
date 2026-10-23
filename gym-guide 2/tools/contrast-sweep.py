#!/usr/bin/env python3
"""
contrast-sweep.py — Phase 6: WCAG 2.x contrast of EVERY rendered text/background pair.

Instead of only checking the design tokens, this drives the real app through all pages and
overlays (expanded cards, selected/unselected chips, ticked sets, Gym Mode steps incl. the
rest timer and finish screen, the alternatives sheet list + confirm view, the toast, the save
indicator, the offline banner, the focused skip-link) and, for each visible text node, composes
the real backdrop (stacked rgba layers, gradient colour stops -> worst case, element opacity)
and compares it with the text colour.

  normal text  >= 4.5:1      large text (>=24px, or >=18.66px bold)  >= 3:1

It also reports which CSS rules that set `color`/`background*` were NEVER matched by any element
in any visited state, so "swept every rule" is a measured claim, not an assumption.

Run from the project root:   python3 tools/contrast-sweep.py        (exit 1 on any failure)
Optional dev tool (pip install playwright && playwright install chromium).
"""
import json, os, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
BASE = f"http://127.0.0.1:{httpd.server_address[1]}/index.html"
threading.Thread(target=httpd.serve_forever, daemon=True).start()

MEASURE_JS = r"""
(label) => {
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top, bot) => {          // composite top over bot (bot opaque)
    const a = top.a;
    return { r: top.r * a + bot.r * (1 - a), g: top.g * a + bot.g * (1 - a), b: top.b * a + bot.b * (1 - a), a: 1 };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  // Backdrop candidates for an element: list of opaque colours (several when gradients are involved).
  function backdrops(el) {
    const layers = [];
    let opacity = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const o = parseFloat(cs.opacity);
      if (!isNaN(o)) opacity *= o;
      const bi = cs.backgroundImage;
      const bc = parse(cs.backgroundColor);
      let stops = null;
      if (bi && bi !== 'none' && /gradient/.test(bi)) {
        stops = (bi.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
      }
      layers.push({ bc, stops });
      if (bc && bc.a >= 1 && !stops) break;
      if (stops && stops.length && stops.every((s) => s.a >= 1) && (!bc || bc.a >= 1 || true)) {
        // opaque gradient covers everything below it
        if (stops.every((s) => s.a >= 1)) break;
      }
    }
    let cands = [{ r: 255, g: 255, b: 255, a: 1 }]; // canvas default; replaced by html/body bg below
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      const next = [];
      for (const base of cands) {
        let cur = base;
        if (L.bc && L.bc.a > 0) cur = over(L.bc, cur);
        if (L.stops && L.stops.length) {
          // gradient: worst case over each stop colour (transparent stops leave the base showing)
          for (const s of L.stops) next.push(s.a > 0 ? over(s, cur) : cur);
        } else next.push(cur);
      }
      // de-duplicate + cap
      const seen = new Set(); cands = [];
      for (const c of next) { const k = hex(c); if (!seen.has(k)) { seen.add(k); cands.push(c); } }
      if (cands.length > 24) cands = cands.slice(0, 24);
    }
    return { cands, opacity };
  }

  function path(el) {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && parts.length < 3; n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      else if (n.classList.length) s += '.' + [...n.classList].slice(0, 2).join('.');
      parts.unshift(s);
    }
    return parts.join(' > ');
  }

  const out = [];
  const seenKey = new Set();
  function record(el, text, fgCss, fontSize, weight, kind) {
    const fg = parse(fgCss);
    if (!fg) return;
    const { cands, opacity } = backdrops(el);
    let worst = Infinity, worstBg = null, worstFg = null;
    for (const bg of cands) {
      const a = fg.a * opacity;
      const f = over({ r: fg.r, g: fg.g, b: fg.b, a }, bg);
      const r = ratio(f, bg);
      if (r < worst) { worst = r; worstBg = bg; worstFg = f; }
    }
    const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const key = [path(el), hex(worstFg), hex(worstBg), kind].join('|');
    if (seenKey.has(key)) return;
    seenKey.add(key);
    out.push({ label, path: path(el), text: text.trim().slice(0, 40), fg: hex(worstFg), bg: hex(worstBg),
               ratio: Math.round(worst * 100) / 100, need, size: Math.round(fontSize * 10) / 10, weight, large, kind,
               opacity: Math.round(opacity * 100) / 100, pass: worst + 1e-9 >= need });
  }

  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;           // sr-only (1px) and empty boxes
    for (let n = el.parentElement; n; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.display === 'none' || c.visibility === 'hidden') return false;
      if (n.hasAttribute('hidden')) return false;
    }
    return true;
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  const els = [];
  for (let n = walker.currentNode; n; n = walker.nextNode()) els.push(n);
  for (const el of els) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'path', 'svg', 'rect', 'circle', 'line', 'polyline'].includes(el.tagName)) continue;
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const disabled = el.disabled || (el.closest && el.closest('[disabled],[aria-disabled="true"]'));
    if (el.tagName === 'text' || el.tagName === 'tspan') {
      const t = el.textContent || '';
      if (t.trim()) record(el, t, cs.fill, parseFloat(cs.fontSize) || 12, parseInt(cs.fontWeight) || 400, 'svg-text');
      continue;
    }
    let own = '';
    for (const c of el.childNodes) if (c.nodeType === 3) own += c.nodeValue;
    const clipText = (cs.webkitBackgroundClip || cs.backgroundClip) === 'text';
    if (own.trim() && !disabled && clipText && /gradient/.test(cs.backgroundImage)) {
      // Gradient-filled text: the text colour IS the gradient; the backdrop is whatever is behind the element.
      const stops = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
      const { cands } = backdrops(el.parentElement);
      let worst = Infinity, wf = null, wb = null;
      for (const s of stops) for (const bg of cands) { const r = ratio(over(s, bg), bg); if (r < worst) { worst = r; wf = over(s, bg); wb = bg; } }
      const fs = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight) || 400, large = fs >= 24 || (fs >= 18.66 && w >= 700);
      out.push({ label, path: path(el), text: own.trim().slice(0, 40), fg: hex(wf), bg: hex(wb), ratio: Math.round(worst * 100) / 100, need: large ? 3 : 4.5,
                 size: Math.round(fs * 10) / 10, weight: w, large, kind: 'gradient-text', opacity: 1, pass: worst + 1e-9 >= (large ? 3 : 4.5) });
    } else if (own.trim() && !disabled) record(el, own, cs.color, parseFloat(cs.fontSize), parseInt(cs.fontWeight) || 400, 'text');
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.placeholder && !el.value && !disabled) {
      const ps = getComputedStyle(el, '::placeholder');
      const o = parseFloat(ps.opacity);
      const col = parse(ps.color);
      if (col) { col.a *= isNaN(o) ? 1 : o; record(el, 'placeholder: ' + el.placeholder, `rgba(${col.r},${col.g},${col.b},${col.a})`, parseFloat(cs.fontSize), 400, 'placeholder'); }
    }
    for (const pseudo of ['::before', '::after']) {
      const ps = getComputedStyle(el, pseudo);
      const c = ps.content;
      if (c && c !== 'none' && c !== 'normal' && /^["'].+["']$/.test(c) && c.replace(/["'\s\u200e\u200f]/g, '').length) {
        record(el, pseudo + ' ' + c, ps.color, parseFloat(ps.fontSize), parseInt(ps.fontWeight) || 400, 'pseudo');
      }
    }
  }
  return out;
}
"""

# Which CSS rules (that set colour / background) match something in the current DOM?
RULES_JS = r"""
() => {
  const hit = [];
  const all = [];
  function walk(rules, ctx) {
    for (const r of rules) {
      if (r.type === 1) {                                   // style rule
        const st = r.style;
        const has = st.color || st.backgroundColor || st.background || st.backgroundImage || st.fill;
        if (!has) continue;
        const sel = r.selectorText;
        all.push(sel);
        // strip dynamic pseudo-classes / pseudo-elements so the base element can still be found
        const base = sel.split(',').map((s) => s.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, (m) => /^::?(not|is|where|has|nth-[a-z-]+|first-child|last-child|first-of-type|last-of-type|only-child|checked|empty)/.test(m) ? m : '')).map((s) => s.trim()).filter(Boolean);
        for (const b of base) { try { if (document.querySelector(b)) { hit.push(sel); break; } } catch (e) { /* ignore */ } }
      } else if (r.cssRules && (r.type === 4 || r.type === 12)) walk(r.cssRules, ctx);   // @media / @supports
    }
  }
  for (const sh of document.styleSheets) { try { walk(sh.cssRules, ''); } catch (e) {} }
  return { all, hit };
}
"""

results = []
matched_rules = set()
all_rules = set()
states = []


def sweep(page, label):
    page.wait_for_timeout(120)
    rows = page.evaluate(MEASURE_JS, label)
    results.extend(rows)
    states.append((label, len(rows)))
    r = page.evaluate(RULES_JS)
    all_rules.update(r["all"])
    matched_rules.update(r["hit"])


def expand_everything(page):
    """Open every collapsible card/group/details so their text is rendered."""
    page.evaluate("""() => {
      document.querySelectorAll('details').forEach(d => d.open = true);
      for (let pass = 0; pass < 3; pass++) {
        document.querySelectorAll('[data-action="toggle-group"], [data-action="toggle-card"]').forEach(b => {
          const exp = b.getAttribute('aria-expanded');
          const open = b.classList.contains('open') || exp === 'true';
          if (!open) b.click();
        });
      }
    }""")


def seed(page_ctx_state):
    return "if(!localStorage.getItem('__s')){localStorage.setItem('gymGuide.state',%s);localStorage.setItem('__s','1');}" % json.dumps(json.dumps(page_ctx_state))


def entry(d, day, vol, rm, name, eid, **kw):
    return dict({"date": d, "dateISO": d, "dayKey": day, "volume": vol, "best1rm": rm, "name": name, "exerciseId": eid}, **kw)


RICH = {
    "version": 1,
    "data": {
        "schedule": {"programId": "ppl6"},
        "programDaysPerWeek": 6,
        "history": {
            "dayPushA-main-0": [entry("2026-10-03", "dayPushA", 1800, 80, "Flat Barbell Bench", "flat-barbell-bench"), entry("2026-10-10", "dayPushA", 2000, 85, "Flat Barbell Bench", "flat-barbell-bench"), entry("2026-10-17", "dayPushA", 2200, 90, "Flat Barbell Bench", "flat-barbell-bench")],
            "dayPullA-main-0": [entry("2026-10-01", "dayPullA", 3000, 60, "Pull-Up", "pull-up"), entry("2026-10-08", "dayPullA", 2500, 55, "Pull-Up", "pull-up"), entry("2026-10-15", "dayPullA", 2000, 50, "Pull-Up", "pull-up")],  # declining -> deload note
            "dayLegsA-main-0": [entry("2026-10-03", "dayLegsA", 2400, 120, "Back Squat", "back-squat"), entry("2026-10-22", "dayLegsA", 2900, 132, "Back Squat", "back-squat")],
            "dayPushA-main-1~incline-db-press": [entry("2026-10-12", "dayPushA", 600, 40, "Incline DB Press", "incline-db-press", partial=True, setsDone=2)],
        },
        "sets": {"dayPushA-main-0": {"0": True, "1": True}, "dayPushA-main-2": {"0": True}},
        "logs": dict(
            {"dayPushA-main-0-%d-%s" % (i, k): v for i in range(5) for k, v in (("w", "60"), ("r", "8"))},      # hit the top of the range -> "increase" tip
            **{"dayPushA-main-1-%d-%s" % (i, k): v for i in range(5) for k, v in (("w", "30"), ("r", "3"))},    # far below the range -> "reduce" tip
            **{"dayPushA-main-2-%d-%s" % (i, k): v for i in range(5) for k, v in (("w", "20"), ("r", "9"))}),   # inside the range -> "hold" tip
        "favorites": {"flat-barbell-bench": True, "back-squat": True},
        "profile": {"gender": "male", "age": 30, "heightCm": 178, "weightKg": 80, "goal": "muscle-gain", "experience": "intermediate",
                    "activityLevel": "moderate", "equipment": ["dumbbells", "bands"], "limitations": ["knee"]},
        "checks": {},
        "fatigue": 7,
    },
}


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 800})
    ctx.add_init_script(seed(RICH))
    page = ctx.new_page()
    page.clock.set_system_time("2026-10-24T12:00:00")
    # Measure the settled colours, not a frame in the middle of a fade/transition.
    page.add_init_script("""document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style');
      s.textContent = '*,*::before,*::after{transition:none !important;animation:none !important;}'; document.head.appendChild(s); });""")
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))

    pages = ["dashboard", "program", "exercises", "support", "tracker", "metrics", "profile", "corrective", "recovery", "nutrition", "injury",
             "day1", "day2", "day3", "dayPushA", "dayPullA", "dayLegsA", "dayPushB", "dayPullB", "dayLegsB"]
    page.goto(BASE + "#dashboard")
    page.wait_for_selector(".dash-today")

    for name in pages:
        page.evaluate(f"location.hash = '#{name}'")
        page.wait_for_timeout(250)
        sweep(page, f"{name}")
        expand_everything(page)
        sweep(page, f"{name} (expanded)")

    # --- interaction states on pages -------------------------------------------------------
    # profile: select one option of every group (selected + unselected chips both exist)
    page.evaluate("location.hash = '#profile'"); page.wait_for_timeout(250)
    page.evaluate("""() => { const seen = new Set(); document.querySelectorAll('[data-action="profile-set-single"],[data-action="profile-toggle-multi"]').forEach(b => { const k = b.dataset.field; if (!seen.has(k)) { seen.add(k); b.click(); } }); }""")
    page.wait_for_timeout(200)
    sweep(page, "profile (chips selected)")

    # metrics: save an entry so the list/delete rows render
    page.evaluate("location.hash = '#metrics'"); page.wait_for_timeout(250)
    page.evaluate("""() => { document.querySelectorAll('#sec-metrics input').forEach((i, n) => { if (i.type === 'number') { i.value = 70 + n; i.dispatchEvent(new Event('input', {bubbles:true})); } }); const b = document.querySelector('[data-action="metric-save"]'); if (b) b.click(); }""")
    page.wait_for_timeout(300)
    sweep(page, "metrics (entry saved)")

    # recovery + nutrition widgets
    page.evaluate("location.hash = '#recovery'"); page.wait_for_timeout(250)
    page.evaluate("document.querySelectorAll('[data-action=\"toggle-check\"]').forEach((b, i) => { if (i % 2 === 0) b.click(); })")
    sweep(page, "recovery (some checks done)")
    page.evaluate("location.hash = '#nutrition'"); page.wait_for_timeout(250)
    page.evaluate("""() => { document.querySelectorAll('#sec-nutrition input').forEach(i => { if (i.type === 'number') { i.value = i.value || 75; i.dispatchEvent(new Event('input', {bubbles:true})); } }); ['calc-protein','calc-calories','calc-hydration'].forEach(a => { const b = document.querySelector('[data-action=\"' + a + '\"]'); if (b) b.click(); }); }""")
    sweep(page, "nutrition (results shown)")

    # exercise library: filters on, favourites, search
    page.evaluate("location.hash = '#exercises'"); page.wait_for_timeout(250)
    page.evaluate("document.querySelectorAll('[data-action=\"ex-filter\"]').forEach((b, i) => { if (i === 1) b.click(); })")
    page.wait_for_timeout(200)
    expand_everything(page)
    sweep(page, "exercises (filter + expanded)")

    # day page: tick every set of the first exercise, so the done styling is visible; save session
    page.evaluate("location.hash = '#dayPushA'"); page.wait_for_timeout(300)
    expand_everything(page)
    page.evaluate("document.querySelectorAll('[data-action=\"toggle-set\"]').forEach((b, i) => { if (i < 6) b.click(); })")
    page.wait_for_timeout(200)
    sweep(page, "dayPushA (sets ticked)")
    page.evaluate("document.querySelectorAll('[data-action=\"save-session\"]').forEach((b, i) => { if (i < 2) b.click(); })")
    page.wait_for_timeout(300)
    sweep(page, "dayPushA (session saved + toast)")

    # offline banner
    ctx.set_offline(True)
    page.evaluate("window.dispatchEvent(new Event('offline'))"); page.wait_for_timeout(200)
    sweep(page, "offline banner")
    ctx.set_offline(False)
    page.evaluate("window.dispatchEvent(new Event('online'))")

    # favourites filter
    page.evaluate("location.hash = '#exercises'"); page.wait_for_timeout(250)
    page.evaluate("document.querySelector('[data-action=\"ex-toggle-fav-filter\"]').click()")
    page.wait_for_timeout(200)
    sweep(page, "exercises (favourites only)")
    page.evaluate("document.querySelector('[data-action=\"ex-toggle-fav-filter\"]').click()")

    # corrective: condition detail + back button
    page.evaluate("location.hash = '#corrective'"); page.wait_for_timeout(250)
    page.evaluate("const c = document.querySelector('[data-action=\"corrective-open\"]:not([aria-disabled=\"true\"])'); if (c) c.click();")
    page.wait_for_timeout(250)
    expand_everything(page)
    sweep(page, "corrective (condition open)")

    # program page: 3-day Full Body (split cards, adjacency advisory) and a full-schedule warning
    page.evaluate("location.hash = '#program'"); page.wait_for_timeout(250)
    page.evaluate("document.querySelector('[data-action=\"program-set-frequency\"][data-days=\"3\"]').click()")
    page.wait_for_timeout(200)
    sweep(page, "program (3 days, split cards)")
    page.evaluate("document.querySelector('[data-action=\"program-set-split\"][data-program=\"fullbody\"]').click()")
    page.wait_for_timeout(200)
    page.evaluate("""() => { const days = [...document.querySelectorAll('[data-action="program-toggle-day"]')];
        days.forEach(b => b.click());                       // try every weekday: removes some, then is refused when full
    }""")
    page.wait_for_timeout(200)
    sweep(page, "program (3-day Full Body, toggled days)")
    page.evaluate("""() => { for (let i = 0; i < 4; i++) { const b = [...document.querySelectorAll('[data-action="program-toggle-day"]')]; b.forEach(x => x.click()); } }""")
    page.wait_for_timeout(200)
    sweep(page, "program (days toggled again)")
    page.evaluate("document.querySelector('[data-action=\"program-reset-schedule\"]') && document.querySelector('[data-action=\"program-reset-schedule\"]').click()")
    page.wait_for_timeout(150)
    page.evaluate("""() => { const off = [...document.querySelectorAll('[data-action="program-toggle-day"]')].find(b => !b.classList.contains('on')); if (off) off.click(); }""")
    page.wait_for_timeout(150)
    sweep(page, "program (full plan: add-day refused)")
    page.evaluate("document.querySelector('[data-action=\"program-set-frequency\"][data-days=\"6\"]').click()")
    page.evaluate("document.querySelector('[data-action=\"program-reset-schedule\"]') && document.querySelector('[data-action=\"program-reset-schedule\"]').click()")
    page.wait_for_timeout(200)

    # a day with every set ticked -> "day complete" banner and a completed program card
    page.evaluate("location.hash = '#dayPullA'"); page.wait_for_timeout(300)
    page.evaluate("document.querySelectorAll('[data-action=\"toggle-set\"]').forEach(b => b.click())")
    page.wait_for_timeout(300)
    page.evaluate("location.hash = '#dashboard'"); page.wait_for_timeout(250)
    page.evaluate("location.hash = '#dayPullA'"); page.wait_for_timeout(300)      # re-render -> "Day complete" banner
    sweep(page, "dayPullA (all sets ticked)")
    page.evaluate("location.hash = '#program'"); page.wait_for_timeout(250)
    sweep(page, "program (a completed day)")

    # skip link focused (it is off-screen until focused)
    page.evaluate("location.hash = '#dashboard'"); page.wait_for_timeout(250)
    page.evaluate("document.querySelector('.skip-link').focus()")
    sweep(page, "skip link focused")
    page.evaluate("document.activeElement.blur()")

    # --- alternatives sheet: list, confirm, filters, partial-only, browse mode --------------
    page.evaluate("location.hash = '#dayPushA'"); page.wait_for_timeout(300)
    page.evaluate("document.querySelector('.alt-btn').click()")
    page.wait_for_selector("#altSheet:not([hidden])")
    sweep(page, "alt sheet (list)")
    page.evaluate("document.querySelectorAll('[data-action=\"alt-filter\"]')[2] && document.querySelectorAll('[data-action=\"alt-filter\"]')[2].click()")
    sweep(page, "alt sheet (filtered)")
    page.evaluate("document.querySelector('[data-action=\"alt-toggle-mine\"]') && document.querySelector('[data-action=\"alt-toggle-mine\"]').click()")
    sweep(page, "alt sheet (all equipment)")
    page.evaluate("document.querySelector('[data-action=\"alt-pick\"]').click()")
    page.wait_for_timeout(200)
    sweep(page, "alt sheet (confirm)")
    page.evaluate("document.querySelector('[data-action=\"alt-confirm\"]').click()")
    page.wait_for_timeout(300)
    sweep(page, "after swap (toast + replaced card)")
    page.wait_for_timeout(300)
    # the replaced slot: the sheet now offers "restore the original" and the swap note
    page.evaluate("document.querySelector('#sec-dayPushA .alt-btn') && document.querySelector('#sec-dayPushA .alt-btn').click()")
    page.wait_for_selector("#altSheet:not([hidden])")
    sweep(page, "alt sheet (replaced slot)")
    # walk every category filter, with and without 'my equipment', to reach an empty-partial-list state
    cats = page.evaluate("[...document.querySelectorAll('[data-action=\"alt-filter\"]')].map(b => b.dataset.cat)")
    for mine in (False, True):
        page.evaluate("document.querySelector('[data-action=\"alt-toggle-mine\"]') && document.querySelector('[data-action=\"alt-toggle-mine\"]').click()")
        for c in cats:
            page.evaluate("(c) => { const b = document.querySelector('[data-action=\"alt-filter\"][data-cat=\"' + c + '\"]'); if (b) b.click(); }", c)
            sweep(page, f"alt sheet (filter {c}, toggled {mine})")
    page.keyboard.press("Escape")
    page.wait_for_timeout(150)

    # partial-only exercise in browse mode from the library (Chest Dip has no close substitute)
    page.evaluate("location.hash = '#exercises'"); page.wait_for_timeout(300)
    page.evaluate("""() => { const i = document.getElementById('exerciseSearch'); i.value = 'dip'; i.dispatchEvent(new Event('input', {bubbles: true})); }""")
    page.wait_for_timeout(600)
    page.evaluate("""() => { const b = document.querySelector('[data-action="alt-open"][data-id="chest-dip"]'); if (b) b.click(); }""")
    page.wait_for_timeout(200)
    sweep(page, "alt sheet (browse, partial-only)")
    page.keyboard.press("Escape")

    # --- Gym Mode: every phase kind, timer running, finish ----------------------------------
    page.evaluate("location.hash = '#dayPushA'"); page.wait_for_timeout(300)
    page.evaluate("document.querySelector('[data-action=\"open-gym\"]').click()")
    page.wait_for_selector("#gymOverlay.active")
    sweep(page, "gym: warm-up step")
    phases_seen = set()
    for i in range(80):
        label = page.evaluate("(document.querySelector('.gym-phase-label')||{}).textContent || ''").strip()
        if label and label not in phases_seen:
            phases_seen.add(label)
            sweep(page, f"gym: {label}")
            if "الأساسية" in label:
                page.evaluate("document.querySelector('[data-action=\"gym-set-done\"]').click()")
                page.wait_for_timeout(200)
                sweep(page, "gym: rest timer running")
        if page.evaluate("!!document.querySelector('[data-action=\"gym-next\"]')"):
            page.evaluate("document.querySelector('[data-action=\"gym-next\"]').click()")
        page.wait_for_timeout(15)
        if page.evaluate("(document.getElementById('gymBody').textContent||'').includes('خلصت اليوم كله')"):
            break
    sweep(page, "gym: finish screen")

    ctx.close()

    # First launch: no saved state at all (empty states of every page, sheet without an equipment profile)
    c0 = browser.new_context(viewport={"width": 390, "height": 800})
    p0 = c0.new_page()
    p0.clock.set_system_time("2026-10-24T12:00:00")
    p0.add_init_script("""document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none !important;animation:none !important;}'; document.head.appendChild(s); });""")
    p0.goto(BASE + "#dashboard")
    p0.wait_for_selector(".dash-week, .dash-cta, .dash-today")
    for name in pages:
        p0.evaluate(f"location.hash = '#{name}'")
        p0.wait_for_timeout(200)
        expand_everything(p0)
        sweep(p0, f"first launch: {name}")
    p0.evaluate("location.hash = '#day1'"); p0.wait_for_timeout(250)
    p0.evaluate("document.querySelector('.alt-btn').click()")
    p0.wait_for_selector("#altSheet:not([hidden])")
    sweep(p0, "first launch: alt sheet (no equipment profile)")
    cats0 = p0.evaluate("[...document.querySelectorAll('[data-action=\"alt-filter\"]')].map(b => b.dataset.cat)")
    for c in cats0:
        p0.evaluate("(c) => { const b = document.querySelector('[data-action=\"alt-filter\"][data-cat=\"' + c + '\"]'); if (b) b.click(); }", c)
        sweep(p0, f"first launch: alt sheet (filter {c})")
    p0.keyboard.press("Escape")
    # partial-only exercise (no like-for-like swap) in the library's browse mode
    p0.evaluate("location.hash = '#exercises'"); p0.wait_for_timeout(250)
    p0.evaluate("""() => { const i = document.getElementById('exerciseSearch'); i.value = 'dip'; i.dispatchEvent(new Event('input', {bubbles: true})); }""")
    p0.wait_for_timeout(600)
    p0.evaluate("""() => { const b = document.querySelector('[data-action="alt-open"][data-id="chest-dip"]'); if (b) b.click(); }""")
    p0.wait_for_timeout(200)
    sweep(p0, "first launch: alt sheet (browse chest-dip, partial-only reason)")
    c0.close()

    # Friday = rest day card; "done today" card (a session saved today)
    for label, when, extra_hist in (
        ("dashboard (rest day)", "2026-10-23T12:00:00", None),
        ("dashboard (done today)", "2026-10-24T12:00:00", {"dayPushA-main-0": [entry("2026-10-24", "dayPushA", 1500, 90, "Flat Barbell Bench", "flat-barbell-bench")]}),
        ("dashboard (3-day Full Body)", "2026-10-24T12:00:00", "fullbody"),
    ):
        st = json.loads(json.dumps(RICH))
        if isinstance(extra_hist, dict):
            st["data"]["history"].update(extra_hist)
        elif extra_hist == "fullbody":
            st["data"]["schedule"] = {"programId": "fullbody"}; st["data"]["programDaysPerWeek"] = 3
        c2 = browser.new_context(viewport={"width": 390, "height": 800})
        c2.add_init_script(seed(st))
        p2 = c2.new_page()
        p2.clock.set_system_time(when)
        p2.add_init_script("""document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none !important;animation:none !important;}'; document.head.appendChild(s); });""")
        p2.goto(BASE + "#dashboard")
        p2.wait_for_selector(".dash-today, .dash-cta, .dash-week")
        sweep(p2, label)
        c2.close()

    browser.close()

# --- report ---------------------------------------------------------------------------------
fails = [r for r in results if not r["pass"]]
print(f"states swept        : {len(states)}")
print(f"text samples        : {len(results)} unique (selector, fg, bg)")
print(f"minimum ratio       : {min(r['ratio'] for r in results):.2f}:1  ({min(results, key=lambda r: r['ratio'])['path']})")
by_kind = {}
for r in results:
    by_kind[r["kind"]] = by_kind.get(r["kind"], 0) + 1
print("by kind             :", by_kind)
unmatched = sorted(all_rules - matched_rules)
print(f"CSS colour rules    : {len(all_rules)} total, {len(all_rules) - len(unmatched)} matched an element in some state, {len(unmatched)} never matched")
if "--list-unmatched" in sys.argv or os.environ.get("SWEEP_VERBOSE"):
    for s in unmatched:
        print("   unmatched:", s)
if errs:
    print("page errors:", errs[:3])
if os.environ.get("SWEEP_JSON"):
    json.dump({"results": results, "unmatched": unmatched, "states": states}, open(os.environ["SWEEP_JSON"], "w"), ensure_ascii=False, indent=1)
if fails:
    import re
    def sig(r):   # collapse generated ids / indices so one CSS problem is reported once
        return (re.sub(r"[#-]?\d+(-\d+)*", "#", re.sub(r"#[A-Za-z0-9_-]+", "", r["path"])), r["fg"], r["bg"], r["kind"])
    groups = {}
    for r in fails:
        g = groups.setdefault(sig(r), {"n": 0, "r": r, "labels": set()})
        g["n"] += 1
        g["labels"].add(r["label"])
    print(f"\nFAIL: {len(fails)} failing samples in {len(groups)} distinct style combinations")
    for k, g in sorted(groups.items(), key=lambda kv: kv[1]["r"]["ratio"]):
        r = g["r"]
        print(f"  {r['ratio']:5.2f} < {r['need']}  {r['fg']} on {r['bg']}  {r['size']}px/{r['weight']}  x{g['n']}  {r['path']}  “{r['text']}”  e.g. [{sorted(g['labels'])[0]}]")
    sys.exit(1)
print("\nOK: every measured text/background pair meets WCAG AA (4.5:1 normal, 3:1 large)")
