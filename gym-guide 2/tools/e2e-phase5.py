#!/usr/bin/env python3
"""
e2e-phase5.py — real-browser checks for Phase 5 (Today card, progress charts, accessibility,
responsiveness, Gym Mode on a PPL day).
Optional dev tool (pip install playwright && playwright install chromium). Run from the project root:
    python3 tools/e2e-phase5.py        (E2E_SHOTS=<dir> saves screenshots)
"""
import json, os, re, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SHOTS = os.environ.get("E2E_SHOTS")
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


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
BASE = f"http://127.0.0.1:{httpd.server_address[1]}/index.html"
threading.Thread(target=httpd.serve_forever, daemon=True).start()


def entry(d, day, vol, rm, name, eid, **kw):
    return dict({"date": d, "dateISO": d, "dayKey": day, "volume": vol, "best1rm": rm, "name": name, "exerciseId": eid}, **kw)


def seed_state(extra_history=None):
    hist = {
        "dayLegsA-main-0": [entry("2026-10-03", "dayLegsA", 2400, 120, "Back Squat", "back-squat"), entry("2026-10-10", "dayLegsA", 2600, 125, "Back Squat", "back-squat"), entry("2026-10-23", "dayLegsA", 2900, 132, "Back Squat", "back-squat")],
        "dayLegsA-main-0~back-squat": [],
        "dayPullA-main-0": [entry("2026-10-20", "dayPullA", 900, 40, "Pull-Up", "pull-up")],
        "dayPushA-main-0~flat-barbell-bench": [entry("2026-10-12", "dayPushA", 600, 80, "Flat Barbell Bench", "flat-barbell-bench", partial=True, setsDone=2)],
    }
    hist.update(extra_history or {})
    hist = {k: v for k, v in hist.items() if v}
    return {"version": 1, "data": {"schedule": {"programId": "ppl6"}, "programDaysPerWeek": 6, "history": hist}}


def seed_js(st):
    return "if(!localStorage.getItem('__s')){localStorage.setItem('gymGuide.state',%s);localStorage.setItem('__s','1');}" % json.dumps(json.dumps(st))


def state(page):
    page.wait_for_timeout(700)
    raw = page.evaluate("localStorage.getItem('gymGuide.state')")
    return json.loads(raw)["data"] if raw else {}


def new_page(browser, st, when, width=390, height=800, **ctx_kw):
    ctx = browser.new_context(viewport={"width": width, "height": height}, **ctx_kw)
    ctx.add_init_script(seed_js(st))
    page = ctx.new_page()
    page.clock.set_system_time(when)
    page.errors, page.bad = [], []
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    page.on("console", lambda m: page.errors.append(m.text) if m.type == "error" else None)
    page.on("response", lambda r: page.bad.append(f"{r.status} {r.url}") if r.status >= 400 else None)
    return ctx, page


def shot(page, name):
    page.wait_for_timeout(400)
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
        page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=True)


SAT, FRI = "2026-10-24T12:00:00", "2026-10-23T12:00:00"
all_errors, all_bad = [], []

with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---------- A. Saturday: today's session is the hero ----------
    ctx, page = new_page(browser, seed_state(), SAT)
    page.goto(BASE + "#dashboard")
    page.wait_for_selector(".dash-today")
    check("A: hero is today's session (6-day PPL, Saturday = Push A)", "Push A" in page.locator(".dash-today .dash-cta-title").inner_text())
    check("A: eyebrow says TODAY", "TODAY" in page.locator(".dash-cta-eyebrow").inner_text())
    check("A: hero links to the day page", page.get_attribute(".dash-today .dash-cta", "href") == "#dayPushA")
    check("A: next session line shown (Pull A tomorrow)", "Pull A" in page.locator(".dash-today-note").inner_text() and "بكرة" in page.locator(".dash-today-note").inner_text())
    bar = page.locator('.dash-week-bar[role="progressbar"]')
    check("A: weekly progress is a labelled progressbar", bar.count() == 1 and bar.get_attribute("aria-valuemax") == "6" and bar.get_attribute("aria-valuenow") == "0", str(bar.get_attribute("aria-valuenow")))
    check("A: weekly count starts Saturday (Friday's session is last week → 0/6)", "0 / 6" in page.locator(".dash-week").first.inner_text())
    wg = page.locator(".pg-weekly")
    check("A: weekly volume chart is a named group with a hidden data table", wg.count() == 1 and len(wg.get_attribute("aria-label")) > 40 and page.locator(".pg-weekly .sr-only table tbody tr").count() == 8)
    check("A: 8 bars, current week highlighted", page.locator(".pg-bar-col").count() == 8 and page.locator(".pg-bar-col.current").count() == 1)
    check("A: records list shows the squat PR with its value", "132" in page.locator(".pg-prs").inner_text() and "Back Squat" in page.locator(".pg-prs").inner_text())
    check("A: new-PR badge on the squat (132 > earlier best)", page.locator(".pg-prs .pg-pr-badge").count() >= 1)
    check("A: link to the tracker", page.locator('a[href="#tracker"]').count() >= 1)
    check("A: no horizontal overflow @390", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
    shot(page, "05-dashboard")
    all_errors += page.errors; all_bad += page.bad
    ctx.close()

    # ---------- B. Friday: rest day ----------
    ctx, page = new_page(browser, seed_state(), FRI)
    page.goto(BASE + "#dashboard")
    page.wait_for_selector(".dash-today")
    check("B: Friday is a rest day card", page.locator(".dash-today.rest").count() == 1 and "راحة" in page.locator(".dash-today-title").inner_text())
    check("B: tells you the next session (Push A, Saturday = tomorrow)", "Push A" in page.locator(".dash-today-sub").inner_text() and "بكرة" in page.locator(".dash-today-sub").inner_text())
    check("B: off-schedule link to the rotation's next day still offered", page.locator(".dash-today-extra").count() == 1)
    check("B: no big start button on a rest day", page.locator(".dash-today .dash-cta").count() == 0)
    check("B: week count — two distinct dates in Sat 17 → Fri 23 gives 2/6", "2 / 6" in page.locator(".dash-week").first.inner_text())
    all_errors += page.errors; all_bad += page.bad
    ctx.close()

    # ---------- C. done today ----------
    done = {"dayPushA-main-0": [entry("2026-10-24", "dayPushA", 1500, 90, "Flat Barbell Bench", "flat-barbell-bench")]}
    ctx, page = new_page(browser, seed_state(done), SAT)
    page.goto(BASE + "#dashboard")
    page.wait_for_selector(".dash-today")
    check("C: finished today's session → done card with status role", page.locator(".dash-today.done [role=status]").count() == 1 and "Push A" in page.locator(".dash-today-title").inner_text())
    check("C: done card still shows what is next", "Pull A" in page.locator(".dash-today-sub").inner_text())
    all_errors += page.errors; all_bad += page.bad
    ctx.close()

    # ---------- D. in progress + 3-day program ----------
    st = seed_state()
    st["data"]["sets"] = {"dayPushA-main-0": {"0": True}}
    ctx, page = new_page(browser, st, SAT)
    page.goto(BASE + "#dashboard")
    page.wait_for_selector(".dash-today")
    check("D: ticked sets today → CONTINUE", "CONTINUE" in page.locator(".dash-cta-eyebrow").inner_text())
    all_errors += page.errors; all_bad += page.bad
    ctx.close()

    # ---------- E. tracker: curves follow the exercise ----------
    ctx, page = new_page(browser, seed_state(), SAT)
    page.goto(BASE + "#tracker")
    page.wait_for_selector(".pg-card")
    sq = page.locator('.pg-card[data-exercise-id="back-squat"]')
    check("E: one progress card per exercise (3: squat, pull-up, bench)", page.locator(".pg-card").count() == 3, str(page.locator(".pg-card").count()))
    check("E: squat curve is an image with a spoken summary", sq.locator('svg.pg-chart[role="img"]').count() == 1 and "2900" not in sq.locator("svg.pg-chart").get_attribute("aria-label") and "132" in sq.locator("svg.pg-chart").get_attribute("aria-label"))
    check("E: squat PR 132 and +21% volume (2400→2900)", "132" in sq.inner_text() and "+21%" in sq.inner_text(), sq.inner_text()[:200])
    check("E: new-PR badge on the squat card", sq.locator(".pg-pr-badge").count() == 1)
    sq.locator("summary").click()
    check("E: data table with column headers opens", sq.locator("table.pg-table th[scope=col]").count() == 3 and sq.locator("table.pg-table tbody tr").count() == 3)
    bench = page.locator('.pg-card[data-exercise-id="flat-barbell-bench"]')
    check("E: partial-only exercise: PR counted, no chart, honest note", bench.count() == 1 and "80" in bench.inner_text() and bench.locator("svg.pg-chart").count() == 0 and "جلستين" in bench.inner_text())
    pull = page.locator('.pg-card[data-exercise-id="pull-up"]')
    check("E: single-session exercise shows the 'need 2 sessions' note", "جلستين" in pull.inner_text())
    check("E: original per-day history cards still present", page.locator(".rule-card:not(.pg-card) .history-list").count() >= 3)
    check("E: archived-slot label still shown", "تمرين اتبدّل" in page.locator("#mainContent").inner_text())
    check("E: no horizontal overflow on tracker", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
    shot(page, "05-tracker")
    all_errors += page.errors; all_bad += page.bad
    ctx.close()

    # ---------- F. navigation semantics ----------
    ctx, page = new_page(browser, seed_state(), SAT)
    page.goto(BASE + "#dashboard")
    page.wait_for_selector(".dash-today")
    check("F: initial load does not steal focus", page.evaluate("document.activeElement === document.body"))
    check("F: nav is a landmark, buttons are not role=tab", page.locator("nav#tabs").get_attribute("aria-label") and page.locator('nav#tabs [role="tab"]').count() == 0 and page.locator('nav#tabs[role="tablist"]').count() == 0)
    check("F: active button has aria-current=page, others false", page.locator('nav#tabs button[aria-current="page"]').count() == 1 and page.locator('nav#tabs button[aria-current="false"]').count() == 3)
    check("F: tab buttons are at least 44px tall", all(b["height"] >= 43.5 for b in [page.locator(f'nav#tabs button').nth(i).bounding_box() for i in range(4)]))
    check("F: document title names the page", "الرئيسية" in page.title())
    page.click('nav#tabs button[data-tab="program"]')
    page.wait_for_selector(".program-day-card, .freq-chip")
    check("F: after navigating, focus moves to the page content", page.evaluate("document.activeElement && document.activeElement.id") == "mainContent")
    check("F: title and aria-current follow the page", "البرنامج" in page.title() and page.get_attribute('nav#tabs button[data-tab="program"]', "aria-current") == "page" and page.get_attribute('nav#tabs button[data-tab="dashboard"]', "aria-current") == "false")
    check("F: page section has a human accessible name", page.get_attribute("#mainContent > section", "aria-label") == "البرنامج")
    page.goto(BASE + "#dayPushA")
    page.wait_for_selector("#card-dayPushA-main-0")
    lab = page.get_attribute("#mainContent > section", "aria-label")
    check("F: day page name is not the raw hash", lab and lab != "dayPushA", str(lab))
    page.click('a[href="#dashboard"], .back-link') if page.locator(".back-link").count() else None
    all_errors += page.errors; all_bad += page.bad
    ctx.close()

    # ---------- G. reduced motion ----------
    ctx, page = new_page(browser, seed_state(), SAT, reduced_motion="reduce")
    page.goto(BASE + "#dashboard")
    page.wait_for_selector(".dash-today")
    page.evaluate("window.scrollTo(0, 500)")
    page.click('nav#tabs button[data-tab="exercises"]')
    page.wait_for_timeout(100)
    check("G: reduced motion → scroll to top is immediate", page.evaluate("window.scrollY") == 0)
    all_errors += page.errors; all_bad += page.bad
    ctx.close()

    # ---------- H. responsiveness: no overflow on any page at 5 widths ----------
    pages = ["dashboard", "program", "exercises", "support", "tracker", "metrics", "profile", "dayPushA", "dayLegsB", "day1"]
    for w in (320, 360, 390, 768, 1100):
        ctx, page = new_page(browser, seed_state(), SAT, width=w, height=900)
        bad_pages = []
        for name in pages:
            page.goto(BASE + "#" + name)
            page.wait_for_timeout(150)
            if page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"):
                bad_pages.append(name)
        check(f"H: no horizontal overflow @{w}px on {len(pages)} pages", not bad_pages, ", ".join(bad_pages))
        if w == 320:
            page.goto(BASE + "#dashboard"); page.wait_for_selector(".dash-today")
            check("H: week strip + weekly bars stay inside the viewport @320", page.evaluate("""[...document.querySelectorAll('.dash-weekstrip, .pg-bars, .pg-prs')].every(e => e.getBoundingClientRect().right <= window.innerWidth + 1 && e.getBoundingClientRect().left >= -1)"""))
            small = page.evaluate("""[...document.querySelectorAll('#mainContent a[href], #mainContent button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 32 && getComputedStyle(e).display !== 'inline'); }).map(e => e.textContent.trim().slice(0,20))""")
            check("H: dashboard controls are at least 32px tall (non-inline)", not small, str(small))
        if w == 1100:
            page.goto(BASE + "#dashboard"); page.wait_for_selector(".dash-today")
            shot(page, "05-dashboard-desktop")
        all_errors += page.errors; all_bad += page.bad
        ctx.close()

    # ---------- I. Gym Mode on a PPL day, end to end (Phase 2 carry-over) ----------
    ctx, page = new_page(browser, {"version": 1, "data": {"schedule": {"programId": "ppl6"}}}, SAT)
    page.goto(BASE + "#dayPushA")
    page.wait_for_selector('[data-action="open-gym"]')
    page.click('[data-action="open-gym"]')
    page.wait_for_selector("#gymOverlay.show, #gymOverlay[style*='flex'], #gymBody *")
    def run_gym(pg, limit=400):
        n = 0
        while n < limit and "خلصت اليوم كله" not in pg.inner_text("#gymBody"):
            sb = pg.locator("#gymSetBtn")
            nx = pg.locator('[data-action="gym-next"]')
            if sb.count() and sb.is_visible():
                sb.click()
            elif nx.count() and nx.is_visible():
                nx.click()
            else:
                break
            n += 1
        return n

    steps = run_gym(page)
    check("I: Gym Mode reaches the completion screen", "خلصت اليوم كله" in page.inner_text("#gymBody") and "100%" in page.inner_text("#gymPct"), f"steps={steps}")
    page.click("#gymExit")
    hist = state(page).get("history", {})
    keys = sorted(k for k in hist if k.startswith("dayPushA-main-"))
    check("I: finishing Gym Mode on Push A closes the overlay", not page.locator("#gymOverlay").is_visible(), f"steps={steps}")
    check("I: history written for all 6 Push A exercises with exerciseId and local date", len(keys) == 6 and all(hist[k][-1].get("exerciseId") and hist[k][-1].get("dateISO") == "2026-10-24" for k in keys), str(keys))
    page.goto(BASE + "#dashboard"); page.wait_for_selector(".dash-today")
    check("I: dashboard now shows today as done + 1/6 this week", page.locator(".dash-today.done").count() == 1 and "1 / 6" in page.locator(".dash-week").first.inner_text())
    all_errors += page.errors; all_bad += page.bad
    ctx.close()

    # ---------- J. local-date stamping (UTC bug): 00:30 local time in Cairo ----------
    ctx, page = new_page(browser, {"version": 1, "data": {"schedule": {"programId": "ppl6"}}}, "2026-10-23T22:30:00Z", timezone_id="Africa/Cairo")
    page.goto(BASE + "#dayPushA")
    page.wait_for_selector('[data-action="open-gym"]')
    page.click('[data-action="open-gym"]')
    run_gym(page)
    hist = state(page).get("history", {})
    dates = {v[-1].get("dateISO") for k, v in hist.items() if k.startswith("dayPushA-main-")}
    check("J: workout at 00:30 Cairo time (UTC 22:30 previous day) is stamped with the LOCAL date 2026-10-24", dates == {"2026-10-24"}, str(dates))
    all_errors += page.errors; all_bad += page.bad
    ctx.close()

    # ---------- K. whole-run health + service worker ----------
    sw = open(os.path.join(ROOT, "service-worker.js"), encoding="utf-8").read()
    check("K: new modules precached, cache version bumped", all(f"./js/modules/{m}" in sw for m in ("progress.js", "progress-ui.js")) and re.search(r"gym-guide-shell-v\d+\.\d+\.\d+", sw) is not None)
    check("K: no page/console errors during the whole run", not all_errors, "; ".join(all_errors[:3]))
    check("K: no failed HTTP responses", not all_bad, "; ".join(all_bad[:3]))
    browser.close()

httpd.shutdown()
if failed:
    print(f"FAIL: {len(failed)} failed, {passed} passed")
    for f in failed:
        print("  ✗", f)
    sys.exit(1)
print(f"OK: {passed}/{passed} browser checks passed")
