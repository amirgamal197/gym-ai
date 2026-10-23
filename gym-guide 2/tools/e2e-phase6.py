#!/usr/bin/env python3
"""
e2e-phase6.py — real-browser checks for Phase 6 (final release).
  A. Cards inside collapsible groups are never clipped (warm-up / mobility / activation /
     cool-down / recovery) and opening a card closes every other open card on the page.
  B. Service worker: install, offline reload, upgrade 1.16.0 -> current, failed upgrade keeps old cache.
  C. Gym Mode keyboard + focus behaviour (inert background, Tab trap, Esc, focus restore).
  D. Backward compatibility: saved states from older versions (tools/fixtures/) still load.
  E. A full user flow (open day, expand card, tick set, log, save session, see it in the tracker).
Optional dev tool (pip install playwright && playwright install chromium). Run from the project root:
    python3 tools/e2e-phase6.py
"""
import json, os, re, shutil, sys, tempfile, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FIX = os.path.join(ROOT, "tools", "fixtures")
passed, failed = 0, []


def check(name, cond, detail=""):
    global passed
    if cond:
        passed += 1
    else:
        failed.append(name + (f" — {detail}" if detail else ""))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    # Threaded on purpose: Chromium opens idle speculative connections, which would block a
    # single-threaded server and make requests (and service-worker fetches) hang at random.
    allow_reuse_address = True
    daemon_threads = True


class Site:
    """A static server that can be stopped and restarted on the same port (a real network outage)."""

    def __init__(self, directory):
        self.directory, self.port, self.httpd = directory, 0, None
        self.start()
        self.base = f"http://127.0.0.1:{self.port}/"

    def start(self):
        self.httpd = Server(("127.0.0.1", self.port), functools.partial(Quiet, directory=self.directory))
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()


def serve(directory):
    s = Site(directory)
    return s, s.base


def new_page(browser, base, state=None, width=390, height=844, errors=None):
    ctx = browser.new_context(viewport={"width": width, "height": height}, service_workers="block")
    if state is None:
        # A brand-new install opens on the first-run setup (js/modules/onboarding.js). These checks are
        # about the workout pages, so start from "the person already skipped the setup".
        state = {"version": 1, "data": {"onboarding": {"done": True, "skipped": True}}}
    ctx.add_init_script("if(!localStorage.getItem('__s')){localStorage.setItem('gymGuide.state',%s);localStorage.setItem('__s','1');}" % json.dumps(json.dumps(state)))
    pg = ctx.new_page()
    if errors is not None:
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    return ctx, pg


# Measures whether an opened card is fully visible, i.e. no clipping ancestor cuts its inner content.
CARD_FULL_JS = """(id)=>{
  const c=document.getElementById('card-'+id); if(!c) return {missing:true};
  const inner=c.querySelector('.ex-body-inner'); const ib=inner.getBoundingClientRect();
  const body=c.querySelector('.ex-body').getBoundingClientRect();
  const clipped=[];
  let n=c.querySelector('.ex-body');
  while(n && n.id!=='mainContent'){
    const cs=getComputedStyle(n);
    if(cs.overflow!=='visible' || cs.overflowY!=='visible'){
      if(n.getBoundingClientRect().bottom < ib.bottom-1) clipped.push(n.id||n.className);
    }
    n=n.parentElement;
  }
  return {bodyH:Math.round(body.height), innerH:Math.round(ib.height), clipped};
}"""
OPEN_IDS_JS = "()=>[...document.querySelectorAll('.ex-card.open')].map(c=>c.id)"


def part_a(browser, base):
    errs = []
    ctx, pg = new_page(browser, base, errors=errs)
    pg.goto(base + "index.html#day1")
    pg.wait_for_selector("#sec-day1 .group-head")
    for grp in ("cardio", "mob", "act", "cooldown"):
        pg.click(f'[data-action="toggle-group"][data-group="day1-{grp}"]')
        pg.wait_for_timeout(520)
        n = pg.locator(f'#group-day1-{grp} .ex-card').count()
        check(f"A: group {grp} has cards", n >= 1, str(n))
        # open the FIRST and the LAST card of the group: the last one is the one a stale max-height cuts
        for idx in sorted({0, n - 1}):
            key = f"day1-{grp}-{idx}"
            pg.click(f'[data-action="toggle-card"][data-key="{key}"]')
            pg.wait_for_timeout(700)
            r = pg.evaluate(CARD_FULL_JS, key)
            check(f"A: {key} fully visible", not r.get("clipped") and r.get("bodyH", 0) >= r.get("innerH", 1) - 1, json.dumps(r))
        mh = pg.evaluate(f"document.getElementById('group-day1-{grp}').style.maxHeight")
        check(f"A: group {grp} cap released after opening", mh in ("none", ""), mh)
    # accordion is page-wide: only the card just opened stays open
    pg.click('[data-action="toggle-card"][data-key="day1-main-0"]')
    pg.wait_for_timeout(700)
    check("A: only one card open after opening a main exercise", pg.evaluate(OPEN_IDS_JS) == ["card-day1-main-0"], str(pg.evaluate(OPEN_IDS_JS)))
    r = pg.evaluate(CARD_FULL_JS, "day1-main-0")
    check("A: main exercise fully visible", not r.get("clipped") and r["bodyH"] >= r["innerH"] - 1, json.dumps(r))
    # tapping the open card closes it
    pg.click('[data-action="toggle-card"][data-key="day1-main-0"]')
    pg.wait_for_timeout(500)
    check("A: tapping an open card closes it", pg.evaluate(OPEN_IDS_JS) == [])
    # opened card scrolls into view
    pg.click('[data-action="toggle-card"][data-key="day1-cooldown-0"]')
    pg.wait_for_timeout(1100)
    top = pg.evaluate("document.querySelector('[data-action=\"toggle-card\"][data-key=\"day1-cooldown-0\"]').getBoundingClientRect().top")
    check("A: opened card header is on screen", 0 <= top <= 844, str(top))
    # group can be closed again and reopened (cap round trip)
    pg.click('[data-action="toggle-group"][data-group="day1-cooldown"]')
    pg.wait_for_timeout(600)
    h = pg.evaluate("document.getElementById('group-day1-cooldown').getBoundingClientRect().height")
    check("A: group collapses fully", h < 2, str(h))
    pg.click('[data-action="toggle-group"][data-group="day1-cooldown"]')
    pg.wait_for_timeout(600)
    h = pg.evaluate("document.getElementById('group-day1-cooldown').getBoundingClientRect().height")
    check("A: group reopens", h > 50, str(h))
    # recovery page
    pg.goto(base + "index.html#recovery")
    pg.wait_for_selector('[data-key="rec-flex-0"]')
    n = pg.locator('[id^="card-rec-flex-"]').count()
    pg.click(f'[data-action="toggle-card"][data-key="rec-flex-{n-1}"]')
    pg.wait_for_timeout(900)
    r = pg.evaluate(CARD_FULL_JS, f"rec-flex-{n-1}")
    check("A: last recovery stretch fully visible", not r.get("clipped") and r["bodyH"] >= r["innerH"] - 1, json.dumps(r))
    pg.click('[data-action="toggle-card"][data-key="rec-flex-0"]')
    pg.wait_for_timeout(700)
    check("A: recovery accordion keeps one open", pg.evaluate(OPEN_IDS_JS) == ["card-rec-flex-0"], str(pg.evaluate(OPEN_IDS_JS)))
    check("A: no console errors", not errs, "; ".join(errs[:3]))
    ctx.close()



def shell_files():
    """Every file the service worker is expected to precache = APP_SHELL parsed from the worker itself."""
    src = open(os.path.join(ROOT, "service-worker.js"), encoding="utf-8").read()
    block = re.search(r"const APP_SHELL = \[(.*?)\];", src, re.S).group(1)
    return re.findall(r'"([^"]+)"', block)


def cache_state(pg):
    return pg.evaluate("""async()=>{const out={};for(const k of await caches.keys()){const c=await caches.open(k);out[k]=(await c.keys()).length;}return out;}""")


def wait_caches(pg, pred, timeout=8000):
    step, t = 250, 0
    while t < timeout:
        st = cache_state(pg)
        if pred(st):
            return st
        pg.wait_for_timeout(step)
        t += step
    return cache_state(pg)


def renders_after(pg, action, timeout=8000):
    """Run a navigation (reload/goto) and report whether the app actually rendered; never raises."""
    try:
        action()
        pg.wait_for_selector("#mainContent section", timeout=timeout)
        return True
    except Exception as e:  # offline without a working service worker lands here
        return False


def part_b(browser):
    """Service worker lifecycle, using a throw-away copy of the project so files can be swapped under it."""
    tmp = tempfile.mkdtemp(prefix="gg-sw-")
    site = os.path.join(tmp, "site")
    shutil.copytree(ROOT, site, ignore=shutil.ignore_patterns("tools", "*.zip", ".git"))
    sw_path = os.path.join(site, "service-worker.js")
    real_sw = open(sw_path, encoding="utf-8").read()
    m = re.search(r'const CACHE_NAME = "(gym-guide-shell-v[^"]+)"', real_sw)
    check("B: CACHE_NAME is a well-formed versioned name", bool(m and re.fullmatch(r"gym-guide-shell-v\d+\.\d+\.\d+", m.group(1))), real_sw[:0])
    cur = m.group(1)
    old = "gym-guide-shell-v1.16.0"
    check("B: shipped cache name differs from 1.16.0", cur != old, cur)
    shell = shell_files()
    on_disk = sorted("./" + os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, "/")
                     for d, _, fs in os.walk(os.path.join(ROOT, "js")) for f in fs)
    check("B: every js file is precached", all(f in shell for f in on_disk), str([f for f in on_disk if f not in shell]))
    check("B: every precached file exists", all(os.path.exists(os.path.join(ROOT, f)) for f in shell if f != "./"), str([f for f in shell if f != "./" and not os.path.exists(os.path.join(ROOT, f))]))

    # 1) pretend the visitor has the previous release installed
    open(sw_path, "w", encoding="utf-8").write(real_sw.replace(cur, old))
    srv, base = serve(site)

    def go_offline():
        ctx.set_offline(True)
        srv.stop()  # a real outage: also covers the service worker's own fetches

    def go_online():
        srv.start()
        ctx.set_offline(False)

    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(base + "index.html")
    pg.evaluate("navigator.serviceWorker.ready.then(()=>1)")
    st = wait_caches(pg, lambda s: s.get(old, 0) >= len(shell) - 0)
    check("B: install precaches the whole shell", st.get(old, 0) >= len(shell) - 1, json.dumps(st))  # "./" and "./index.html" share one cache entry key at most
    pg.reload()
    pg.wait_for_selector("#mainContent section")
    check("B: page is controlled after reload", pg.evaluate("!!navigator.serviceWorker.controller"))

    # 2) offline
    go_offline()
    check("B: offline reload renders the app", renders_after(pg, pg.reload) and pg.locator("#tabs button").count() == 4)
    ok = renders_after(pg, lambda: pg.goto(base + "index.html#day1")) and pg.locator("#sec-day1 .ex-card").count() >= 4
    check("B: offline day page renders", ok)
    go_online()

    # 3) upgrade 1.16.0 -> current
    open(sw_path, "w", encoding="utf-8").write(real_sw)
    pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
    st = wait_caches(pg, lambda s: list(s.keys()) == [cur])
    check("B: upgrade removes the old cache and keeps only the new one", list(st.keys()) == [cur], json.dumps(st))
    check("B: new cache holds the whole shell", st.get(cur, 0) >= len(shell) - 1, json.dumps(st))
    go_offline()
    check("B: offline after upgrade still works", renders_after(pg, pg.reload) and pg.locator("#tabs button").count() == 4)
    go_online()

    # 4) failed upgrade (one precached file 404s) must leave the working version in place
    bad = real_sw.replace(cur, "gym-guide-shell-v9.9.9-bad")
    open(sw_path, "w", encoding="utf-8").write(bad)
    hidden = os.path.join(site, "js", "modules", "support.js")
    os.rename(hidden, hidden + ".gone")
    pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update().catch(()=>0))")
    pg.wait_for_timeout(2500)
    st = cache_state(pg)
    check("B: failed upgrade keeps the old cache complete", st.get(cur, 0) >= len(shell) - 1, json.dumps(st))
    # the half-opened cache of the failed install stays empty (addAll is all-or-nothing) and is swept at the next activation
    check("B: failed upgrade stores nothing in the new cache", st.get("gym-guide-shell-v9.9.9-bad", 0) == 0, json.dumps(st))
    go_offline()
    check("B: offline after failed upgrade still works", renders_after(pg, pg.reload) and pg.locator("#tabs button").count() == 4)
    go_online()
    os.rename(hidden + ".gone", hidden)
    check("B: no page errors during the service-worker run", not errs, "; ".join(errs[:3]))
    ctx.close()
    srv.stop()
    shutil.rmtree(tmp, ignore_errors=True)


def part_c(browser, base):
    errs = []
    ctx, pg = new_page(browser, base, errors=errs)
    pg.goto(base + "index.html#day1")
    pg.wait_for_selector('[data-action="open-gym"]')
    pg.focus('[data-action="open-gym"]')
    pg.keyboard.press("Enter")
    pg.wait_for_selector("#gymOverlay.active")
    pg.wait_for_timeout(400)
    inside = lambda: pg.evaluate("document.getElementById('gymOverlay').contains(document.activeElement)")
    check("C: focus moves into Gym Mode", inside())
    inerts = pg.evaluate("[...document.body.children].filter(e=>e.hasAttribute('inert')).map(e=>e.tagName+'#'+e.id)")
    check("C: page behind is inert", any(x.startswith("MAIN") for x in inerts) and any(x.startswith("HEADER") for x in inerts), str(inerts))
    check("C: Gym Mode overlay itself is not inert", not pg.evaluate("document.getElementById('gymOverlay').hasAttribute('inert')"))
    check("C: #gymStatus is a polite live region", pg.evaluate("(e=>e.getAttribute('role')==='status'&&e.getAttribute('aria-live')==='polite')(document.getElementById('gymStatus'))"))
    ok = True
    for _ in range(14):
        pg.keyboard.press("Tab")
        ok = ok and inside()
    check("C: Tab never leaves Gym Mode (14 presses)", ok)
    ok = True
    for _ in range(14):
        pg.keyboard.press("Shift+Tab")
        ok = ok and inside()
    check("C: Shift+Tab never leaves Gym Mode (14 presses)", ok)
    live = pg.evaluate("[...document.querySelectorAll('#gymOverlay [aria-live]')].map(e=>e.id||e.className)")
    check("C: only #gymStatus is aria-live inside Gym Mode (timer is not read every second)", live == ["gymStatus"], str(live))
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    check("C: Esc closes Gym Mode", not pg.evaluate("document.getElementById('gymOverlay').classList.contains('active')"))
    check("C: inert removed after closing", pg.evaluate("document.querySelectorAll('[inert]').length") == 0)
    check("C: focus returns to the button that opened Gym Mode", pg.evaluate("document.activeElement.getAttribute('data-action')") == "open-gym")
    check("C: no console errors", not errs, "; ".join(errs[:3]))
    ctx.close()


def part_d(browser, base):
    for name in sorted(os.listdir(FIX)):
        if not name.endswith(".json"):
            continue
        st = json.load(open(os.path.join(FIX, name), encoding="utf-8"))
        errs = []
        ctx, pg = new_page(browser, base, state=st, errors=errs)
        pg.goto(base + "index.html")
        pg.wait_for_selector("#mainContent section")
        pg.wait_for_timeout(500)
        for tab in ("dashboard", "program", "exercises", "support", "tracker", "recovery", "nutrition", "injury", "metrics", "corrective", "profile", "day1"):
            pg.goto(base + f"index.html#{tab}")
            pg.wait_for_selector(f"#sec-{tab}", timeout=5000)
        check(f"D[{name}]: every page renders", True)
        check(f"D[{name}]: no console errors", not errs, "; ".join(errs[:3]))
        # saved sets on day1 are still ticked
        sets = st["data"].get("sets", {})
        if "day1-main-0" in sets:
            pg.goto(base + "index.html#day1")
            pg.wait_for_selector("#sec-day1 .set-box")
            done = pg.evaluate("document.querySelectorAll('[data-key=\"day1-main-0\"].set-box.done, [data-key=\"day1-main-0\"].set-box.active').length")
            check(f"D[{name}]: previously ticked sets still show as done", done == len([k for k, v in sets["day1-main-0"].items() if v]), str(done))
        # history reaches the tracker
        if st["data"].get("history"):
            pg.goto(base + "index.html#tracker")
            pg.wait_for_selector("#sec-tracker")
            txt = pg.inner_text("#sec-tracker")
            names = {e[-1].get("name") for e in st["data"]["history"].values() if e}
            check(f"D[{name}]: tracker lists saved exercises", all(n in txt for n in names if n), txt[:120].replace("\n", " "))
        # state survives a write cycle without losing unknown/legacy keys
        pg.goto(base + "index.html#day1")
        pg.wait_for_selector("#sec-day1 .set-box")
        pg.evaluate("document.querySelector('#sec-day1 .set-box').click()")
        pg.wait_for_timeout(900)
        saved = json.loads(pg.evaluate("localStorage.getItem('gymGuide.state')"))["data"]
        lost = [k for k in st["data"] if k not in saved]
        check(f"D[{name}]: no saved key lost after the app writes", not lost, str(lost))
        ctx.close()


def part_e(browser, base):
    errs = []
    ctx, pg = new_page(browser, base, errors=errs)
    pg.goto(base + "index.html")
    pg.wait_for_selector("#mainContent section")
    # A brand-new install now opens on the first-run setup (js/modules/onboarding.js); a real
    # user either answers it or skips it. This flow skips, then carries on with the defaults.
    if pg.is_visible("#onboarding"):
        pg.click('[data-action="ob-skip"]')
    pg.click('#tabs button[data-tab="program"]')
    pg.wait_for_selector("#sec-program")
    link = pg.locator('#sec-program a[href^="#day"]').first
    check("E: program page links to a workout day", link.count() == 1)
    link.click()
    pg.wait_for_selector("#sec-day1 .ex-card, #sec-dayPushA .ex-card, [id^='sec-day'] .ex-card")
    sec = pg.evaluate("document.querySelector('#mainContent section').id")
    key = sec.replace("sec-", "")
    pg.wait_for_timeout(600)
    # arriving on a day page auto-opens the next unfinished exercise (workout.js focusNextExercise)
    check("E: next unfinished exercise is open on arrival", pg.evaluate(f"document.getElementById('card-{key}-main-0').classList.contains('open')"))
    pg.click(f'[data-action="toggle-set"][data-key="{key}-main-0"][data-set="0"]')
    pg.fill(f'#log-{key}-main-0-0-w', "60")
    pg.fill(f'#log-{key}-main-0-0-r', "10")
    pg.wait_for_timeout(700)
    pg.click(f'[data-action="save-session"][data-key="{key}-main-0"]')
    pg.wait_for_timeout(800)
    st = json.loads(pg.evaluate("localStorage.getItem('gymGuide.state')"))["data"]
    check("E: set tick persisted", st.get("sets", {}).get(f"{key}-main-0", {}).get("0") is True, json.dumps(st.get("sets", {}))[:120])
    hist = st.get("history", {}).get(f"{key}-main-0", [])
    check("E: saved session is in history with volume 600", bool(hist) and float(hist[-1].get("volume")) == 600, json.dumps(hist)[:160])
    pg.reload()
    pg.wait_for_selector("#mainContent section")
    pg.goto(base + "index.html#tracker")
    pg.wait_for_selector("#sec-tracker")
    check("E: tracker shows the saved session after reload", "600" in pg.inner_text("#sec-tracker"))
    check("E: no console errors", not errs, "; ".join(errs[:3]))
    ctx.close()

def main():
    site, base = serve(ROOT)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        part_a(browser, base)
        part_c(browser, base)
        part_d(browser, base)
        part_e(browser, base)
        part_b(browser)
        browser.close()
    print(f"passed {passed}, failed {len(failed)}")
    for f in failed:
        print("  FAIL:", f)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
